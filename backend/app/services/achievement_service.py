import json
import logging
from typing import Any
import httpx
from google import genai
from app.core.cache import cache
from app.core.config import settings
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
                    key=lambda c: int(c.get("order", 999)),
                )
                for cat in sorted_cats:
                    cat_id = str(cat.get("id", ""))
                    cat_name = cat.get("name", "General")
                    cat_order = int(cat.get("order", 0))
                    ach_map: dict[str, Any] = cat.get("achievementList") or {}
                    cat_count = 0

                    sorted_achs = sorted(
                        ach_map.values(),
                        key=lambda a: int(a.get("order", 9999)),
                    )
                    for ach in sorted_achs:
                        version = str(ach.get("version") or "")
                        for tier in ach.get("details") or []:
                            tier_id = int(tier.get("id", ach.get("id", 0)))
                            rewards = tier.get("rewards") or {}
                            primo = int((rewards.get("201") or {}).get("count", 5))
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

    try:
        client = genai.Client(api_key=settings.GEMINI_API_KEY)
        prompt = (
            "You are a concise Genshin Impact achievement guide.\n"
            f"Achievement: {req.title}\n"
            f"Category: {req.categoryName}\n"
            f"Description: {req.description}\n\n"
            "Return ONLY valid JSON matching:\n"
            '{"steps": ["step 1", "step 2", "step 3"], "tip": "one short practical tip"}'
        )
        res = client.models.generate_content(
            model="gemini-3.8-flash",
            contents=prompt,
        )
        text = (res.text or "").strip()
        if text.startswith("```"):
            text = text.strip("`").removeprefix("json").strip()
        parsed = json.loads(text)
        result = AchievementGuideResponse(
            title=req.title,
            steps=parsed.get("steps", [])[:4],
            tip=parsed.get("tip", ""),
            poweredBy="gemini-3.8-flash",
        )
        await cache.set(cache_key, result, ttl_seconds=GUIDE_TTL)
        return result
    except Exception as exc:
        logger.warning(f"Achievement guide Gemini fallback triggered: {exc}")
        return _deterministic_guide(req)
