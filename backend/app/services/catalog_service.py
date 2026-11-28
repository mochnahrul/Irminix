import asyncio
import logging
import re
from typing import Any, Optional
from app.core.cache import cache
from app.core.constants import (
    ELEMENT_MAP,
    WEAPON_TYPE_MAP,
    fetch_yatta_json,
    safe_int,
    yatta_icon_url,
)
from app.schemas.character import (
    CharacterBuildGuide,
    CharacterDetail,
    CharacterSummary,
)
from app.services.community_builds_service import (
    fetch_community_builds,
    get_helper_team_index,
)
from app.services.yatta_service import clean_hoyo_text, enrich_builds_with_yatta

logger = logging.getLogger(__name__)

CATALOG_CACHE_KEY = "irminsul:catalog:all"
YATTA_AVATARS_KEY = "irminsul:yatta:avatars"
CATALOG_TTL = 60 * 60 * 6  # 6 hours

REGION_MAP = {
    "MONDSTADT": "Mondstadt",
    "LIYUE": "Liyue",
    "INAZUMA": "Inazuma",
    "SUMERU": "Sumeru",
    "FONTAINE": "Fontaine",
    "NATLAN": "Natlan",
    "SNEZHNAYA": "Snezhnaya",
    "MAINACTOR": "Teyvat",
    "RANGER": "Teyvat",
}

YATTA_SLUG_ALIASES = {
    "sangonomiya-kokomi": "kokomi",
    "kujou-sara": "sara",
}


def slugify_name(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


async def _fetch_yatta_avatars() -> dict[str, dict[str, Any]]:
    """Fetch all live characters from gi.yatta.moe in a single request."""
    from app.core.config import settings

    data = await fetch_yatta_json(
        YATTA_AVATARS_KEY,
        f"{settings.GENSHIN_API_BASE}/avatar",
        ttl_seconds=CATALOG_TTL,
    )
    items = (data or {}).get("items") or {}
    return items if isinstance(items, dict) else {}


async def _fetch_yatta_detail(avatar_id: str | int) -> Optional[dict[str, Any]]:
    from app.core.config import settings

    return await fetch_yatta_json(
        f"irminsul:yatta:detail:{avatar_id}",
        f"{settings.GENSHIN_API_BASE}/avatar/{avatar_id}",
        ttl_seconds=CATALOG_TTL,
    )


async def get_all_characters() -> list[CharacterSummary]:
    """Return merged catalog of Helper Team builds + live gi.yatta.moe characters."""
    cached = await cache.get(CATALOG_CACHE_KEY)
    if cached is not None:
        return cached

    curated_by_slug: dict[str, CharacterSummary] = {}
    helper_index, yatta_items = await asyncio.gather(
        get_helper_team_index(),
        _fetch_yatta_avatars(),
    )
    for av in yatta_items.values():
        name = av.get("name", "")
        if not name or name in ("Manekin", "Manekina") or name == "Traveler":
            continue
        norm = slugify_name(name)
        norm = YATTA_SLUG_ALIASES.get(norm, norm)
        yatta_image_url = yatta_icon_url(av.get("icon"))

        vision_name = ELEMENT_MAP.get(av.get("element", ""), av.get("element", "Unknown"))
        weapon_name = WEAPON_TYPE_MAP.get(av.get("weaponType", ""), "Sword")
        region_name = REGION_MAP.get(str(av.get("region", "")).upper(), "Teyvat")
        helper_meta = helper_index.get(norm)

        curated_by_slug[norm] = CharacterSummary(
            id=norm,
            name=name,
            weapon=weapon_name,
            region=region_name,
            rarity=safe_int(av.get("rank"), 5),
            vision=vision_name,
            visionImage="",
            image=yatta_image_url,
            hasCuratedBuild=helper_meta is not None,
            roles=(
                [r.replace("-", " ").upper() for r in helper_meta["roles"]]
                if helper_meta
                else ["LIVE ARCHIVE"]
            ),
            source="helper-team+yatta" if helper_meta else "yatta-live",
        )

    result = sorted(curated_by_slug.values(), key=lambda c: (-c.rarity, c.name.lower()))
    if result:
        await cache.set(CATALOG_CACHE_KEY, result, ttl_seconds=CATALOG_TTL)
    return result


async def get_character_detail(identifier: str) -> Optional[CharacterDetail]:
    """Resolve character detail by slug or name, merging Helper Team builds with gi.yatta.moe metadata."""
    raw_slug = slugify_name(identifier)
    target_slug = YATTA_SLUG_ALIASES.get(raw_slug, raw_slug)
    detail_cache_key = f"irminsul:char_detail_v10:{target_slug}"
    cached_detail = await cache.get(detail_cache_key)
    if cached_detail is not None:
        return cached_detail

    yatta_items, build_bundle = await asyncio.gather(
        _fetch_yatta_avatars(),
        fetch_community_builds(target_slug),
    )
    community_builds, build_last_updated, version_released = build_bundle
    yatta_summary = next(
        (
            av
            for av in yatta_items.values()
            if YATTA_SLUG_ALIASES.get(slugify_name(av.get("name", "")), slugify_name(av.get("name", "")))
            == target_slug
        ),
        None,
    )
    live_data = (
        await _fetch_yatta_detail(yatta_summary["id"])
        if yatta_summary and "id" in yatta_summary
        else None
    )

    if not live_data and not yatta_summary:
        return None

    meta = live_data or yatta_summary or {}
    vision_name = ELEMENT_MAP.get(meta.get("element", ""), "Unknown")
    weapon_name = WEAPON_TYPE_MAP.get(meta.get("weaponType", ""), "Sword")
    region_name = REGION_MAP.get(str(meta.get("region", "")).upper(), "Teyvat")
    builds = community_builds or [
        CharacterBuildGuide(
            role="RECOMMENDED GENERAL BUILD",
            weapons=[],
            artifacts=[],
            mainStats=[
                "Sands - ATK% / Energy Recharge",
                f"Goblet - {vision_name} DMG Bonus",
                "Circlet - Crit Rate / Crit DMG",
            ],
            subStats=["Crit Rate / Crit DMG", "ATK%", "Energy Recharge", "Elemental Mastery"],
            talentPriority=["Elemental Burst", "Elemental Skill", "Normal Attack"],
        )
    ]
    summary_kwargs = dict(
        id=target_slug,
        name=meta.get("name", identifier),
        weapon=weapon_name,
        region=region_name,
        rarity=safe_int(meta.get("rank"), 5),
        vision=vision_name,
        visionImage="",
        image=yatta_icon_url(meta.get("icon")),
        hasCuratedBuild=community_builds is not None,
        roles=[b.role for b in builds],
        source="helper-team+yatta" if community_builds else "yatta-live",
    )

    talents: list[dict[str, str]] = []
    constellations: list[dict[str, str]] = []
    fetter = (live_data or {}).get("fetter") or {}
    birthday_arr = (live_data or {}).get("birthday")
    birthday_str = (
        f"{birthday_arr[0]}/{birthday_arr[1]}"
        if isinstance(birthday_arr, list) and len(birthday_arr) == 2
        else None
    )

    for t in ((live_data or {}).get("talent") or {}).values():
        if isinstance(t, dict) and t.get("name"):
            talents.append({
                "name": t.get("name", ""),
                "unlock": str(t.get("type", "")),
                "description": clean_hoyo_text(t.get("description", "")),
                "icon": yatta_icon_url(t.get("icon")),
            })
    for c in ((live_data or {}).get("constellation") or {}).values():
        if isinstance(c, dict) and c.get("name"):
            constellations.append({
                "name": c.get("name", ""),
                "unlock": "",
                "description": clean_hoyo_text(c.get("description", "")),
                "icon": yatta_icon_url(c.get("icon")),
            })

    enriched_builds = await enrich_builds_with_yatta(builds)

    detail = CharacterDetail(
        **summary_kwargs,
        title=fetter.get("title"),
        description=clean_hoyo_text(fetter.get("detail")),
        constellation=fetter.get("constellation"),
        birthday=birthday_str,
        buildLastUpdated=build_last_updated,
        versionReleased=version_released,
        builds=enriched_builds,
        talents=talents,
        constellations=constellations,
    )
    ttl = CATALOG_TTL if live_data else 30
    await cache.set(detail_cache_key, detail, ttl_seconds=ttl)
    return detail
