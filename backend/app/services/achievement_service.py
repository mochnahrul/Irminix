import logging
from typing import Any
from app.core.cache import cache
from app.core.config import settings
from app.core.constants import safe_int
from app.core.gemini import GEMINI_MODEL_ID, generate_gemini_json
from app.core.http import get_http_client
from app.schemas.achievement import (
    AchievementCatalogResponse,
    AchievementCategory,
    AchievementGuideRequest,
    AchievementGuideResponse,
    AchievementItem,
)

logger = logging.getLogger(__name__)

ACHIEVEMENT_CACHE_KEY = "irminsul:yatta:achievements"
ACHIEVEMENT_TTL = 60 * 60 * 6  # 6 hours
GUIDE_TTL = 60 * 60 * 24  # 24 hours


async def get_achievement_catalog() -> AchievementCatalogResponse:
    """Fetch and normalize all Genshin Impact achievements from gi.yatta.moe."""
    cached = await cache.get(ACHIEVEMENT_CACHE_KEY)
    if cached is not None:
        return cached

    categories: list[AchievementCategory] = []
    items: list[AchievementItem] = []

    try:
        client = get_http_client()
        res = await client.get(f"{settings.GENSHIN_API_BASE}/achievement")
        if res.status_code == 200:
                raw_cats: dict[str, Any] = res.json().get("data", {})
                sorted_cats = sorted(
                    raw_cats.values(),
                    key=lambda c: safe_int(c.get("order"), 999),
                )
                for cat in sorted_cats:
                    cat_id = str(cat.get("id") or "")
                    cat_name = cat.get("name") or "General"
                    cat_order = safe_int(cat.get("order"), 0)
                    ach_map: dict[str, Any] = cat.get("achievementList") or {}
                    cat_count = 0

                    sorted_achs = sorted(
                        ach_map.values(),
                        key=lambda a: safe_int(a.get("order"), 9999),
                    )
                    for ach in sorted_achs:
                        version = str(ach.get("version") or "")
                        for tier in ach.get("details") or []:
                            tier_id = safe_int(tier.get("id"), safe_int(ach.get("id"), 0))
                            rewards = tier.get("rewards") or {}
                            primo = safe_int((rewards.get("201") or {}).get("count"), 5)
                            items.append(
                                AchievementItem(
                                    id=tier_id,
                                    title=tier.get("title", "Hidden Achievement"),
                                    description=tier.get("description", ""),
                                    categoryId=cat_id,
                                    categoryName=cat_name,
                                    primogems=primo,
                                    version=version,
                                )
                            )
                            cat_count += 1

                    if cat_count > 0:
                        categories.append(
                            AchievementCategory(
                                id=cat_id,
                                name=cat_name,
                                order=cat_order,
                                count=cat_count,
                            )
                        )
    except Exception as exc:
        logger.warning(f"Failed to fetch achievements from gi.yatta.moe: {exc}")

    response = AchievementCatalogResponse(
        total=len(items),
        categories=categories,
        items=items,
    )
    if items:
        await cache.set(ACHIEVEMENT_CACHE_KEY, response, ttl_seconds=ACHIEVEMENT_TTL)
    return response


def _deterministic_guide(req: AchievementGuideRequest) -> AchievementGuideResponse:
    desc = req.description.strip()
    steps = [
        f"Requirement: {desc}" if desc else f"Complete the objective for '{req.title}'.",
        f"Check the '{req.categoryName}' section in your in-game Achievements menu to track progress.",
        "If this is a commission- or boss-gated achievement, prioritize the relevant region or co-op setup.",
    ]
    return AchievementGuideResponse(
        title=req.title,
        steps=steps,
        tip="Track this achievement in Irminsul once completed to keep your count aligned with your UID.",
        poweredBy="irminsul-local-engine",
    )


async def generate_achievement_guide(
    req: AchievementGuideRequest,
) -> AchievementGuideResponse:
    """Provide concise unlock steps via Gemini 2.5 Flash with local deterministic fallback."""
    cache_key = f"irminsul:ach_guide:{req.title.lower()}"
    cached = await cache.get(cache_key)
    if cached is not None:
        return cached

    if not settings.GEMINI_API_KEY:
        result = _deterministic_guide(req)
        await cache.set(cache_key, result, ttl_seconds=GUIDE_TTL)
        return result

    prompt = (
        "You are a concise Genshin Impact achievement guide.\n"
        f"Achievement: {req.title}\n"
        f"Category: {req.categoryName}\n"
        f"Description: {req.description}\n\n"
        "Return ONLY valid JSON matching:\n"
        '{"steps": ["step 1", "step 2", "step 3"], "tip": "one short practical tip"}'
    )
    parsed = await generate_gemini_json(prompt)
    if parsed is not None:
        raw_steps = parsed.get("steps")
        steps = [str(s) for s in raw_steps[:4]] if isinstance(raw_steps, list) else []
        tip = parsed.get("tip")
        if steps:
            result = AchievementGuideResponse(
                title=req.title,
                steps=steps,
                tip=str(tip) if tip is not None else "",
                poweredBy=GEMINI_MODEL_ID,
            )
            await cache.set(cache_key, result, ttl_seconds=GUIDE_TTL)
            return result

    return _deterministic_guide(req)
