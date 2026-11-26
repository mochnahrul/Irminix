import asyncio
from functools import lru_cache
import json
import logging
import re
from pathlib import Path
from typing import Any, Optional
from app.core.cache import cache
from app.core.config import settings
from app.core.http import get_http_client
from app.schemas.character import (
    BuildArtifactOption,
    BuildArtifactPiece,
    BuildWeapon,
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

DATA_PATH = Path(__file__).resolve().parent.parent / "data" / "build.json"
CATALOG_CACHE_KEY = "irminsul:catalog:all"
YATTA_AVATARS_KEY = "irminsul:yatta:avatars"
CATALOG_TTL = 60 * 60 * 6  # 6 hours

ELEMENT_MAP = {
    "Fire": "Pyro",
    "Water": "Hydro",
    "Electric": "Electro",
    "Ice": "Cryo",
    "Wind": "Anemo",
    "Rock": "Geo",
    "Grass": "Dendro",
}

WEAPON_TYPE_MAP = {
    "WEAPON_SWORD_ONE_HAND": "Sword",
    "WEAPON_CLAYMORE": "Claymore",
    "WEAPON_POLE": "Polearm",
    "WEAPON_BOW": "Bow",
    "WEAPON_CATALYST": "Catalyst",
}

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


@lru_cache(maxsize=1)
def _load_curated_raw() -> list[dict[str, Any]]:
    if not DATA_PATH.exists():
        return []
    with DATA_PATH.open("r", encoding="utf-8") as f:
        return json.load(f)


def _normalize_build_entry(raw_build: dict[str, Any]) -> CharacterBuildGuide:
    weapons = [
        BuildWeapon(
            name=w.get("name", "Unknown Weapon"),
            rarity=int(w.get("rarity", 4)),
            refine=int(w.get("refine", 0)),
            image=w.get("image", ""),
        )
        for w in raw_build.get("weapon", [])
    ]

    artifacts: list[BuildArtifactOption] = []
    for art in raw_build.get("artifact", []):
        if "mix" in art and isinstance(art["mix"], list):
            mix_pieces = [
                BuildArtifactPiece(
                    name=m.get("name", ""),
                    rarity=int(m.get("rarity", 5)),
                    piece=int(m.get("piece", 2)),
                    image=m.get("image", ""),
                )
                for m in art["mix"]
            ]
            artifacts.append(BuildArtifactOption(mix=mix_pieces))
        else:
            artifacts.append(
                BuildArtifactOption(
                    name=art.get("name", ""),
                    rarity=int(art.get("rarity", 5)),
                    piece=int(art.get("piece", 4)),
                    image=art.get("image", ""),
                )
            )

    main_stats: list[str] = []
    sub_stats: list[str] = []
    for stat_block in raw_build.get("artifactStats", []):
        if "mainStats" in stat_block:
            main_stats.extend(s.get("name", "") for s in stat_block["mainStats"] if s.get("name"))
        if "subStats" in stat_block:
            for s in stat_block["subStats"]:
                val = s.get("name", "")
                if val:
                    cleaned = val.replace("Substats - ", "").strip()
                    sub_stats.extend([part.strip() for part in cleaned.split(">") if part.strip()])

    talent_priority: list[str] = []
    for t in raw_build.get("talent", []):
        if isinstance(t, dict) and t.get("name"):
            talent_priority.append(t["name"])
        elif isinstance(t, str):
            talent_priority.append(t)

    return CharacterBuildGuide(
        role=raw_build.get("role", "DPS"),
        weapons=weapons,
        artifacts=artifacts,
        mainStats=main_stats,
        subStats=sub_stats,
        talentPriority=talent_priority,
    )


async def _fetch_yatta_avatars() -> dict[str, dict[str, Any]]:
    """Fetch all live characters from gi.yatta.moe in a single request."""
    cached = await cache.get(YATTA_AVATARS_KEY)
    if cached is not None:
        return cached

    try:
        client = get_http_client()
        res = await client.get(f"{settings.GENSHIN_API_BASE}/avatar")
        if res.status_code == 200:
            items = res.json().get("data", {}).get("items", {})
            if isinstance(items, dict):
                await cache.set(YATTA_AVATARS_KEY, items, ttl_seconds=CATALOG_TTL)
                return items
    except Exception as exc:
        logger.warning(f"Failed to fetch live character list from gi.yatta.moe: {exc}")
    return {}


async def _fetch_yatta_detail(avatar_id: str | int) -> Optional[dict[str, Any]]:
    cache_key = f"irminsul:yatta:detail:{avatar_id}"
    cached = await cache.get(cache_key)
    if cached is not None:
        return cached

    try:
        client = get_http_client()
        res = await client.get(f"{settings.GENSHIN_API_BASE}/avatar/{avatar_id}")
        if res.status_code == 200:
            data = res.json().get("data")
            if isinstance(data, dict):
                await cache.set(cache_key, data, ttl_seconds=CATALOG_TTL)
                return data
    except Exception as exc:
        logger.debug(f"Live detail fetch failed for avatar {avatar_id}: {exc}")
    return None


async def get_all_characters() -> list[CharacterSummary]:
    """Return merged catalog of curated builds + live gi.yatta.moe characters."""
    cached = await cache.get(CATALOG_CACHE_KEY)
    if cached is not None:
        return cached

    raw_curated = _load_curated_raw()
    curated_by_slug: dict[str, CharacterSummary] = {}

    for item in raw_curated:
        name = item.get("name", "Unknown")
        slug = slugify_name(name)
        vision_obj = item.get("vision") or {}
        vision_name = vision_obj.get("name", "Unknown")
        builds = item.get("build", [])
        roles = [b.get("role", "DPS") for b in builds if b.get("role")]
        curated_by_slug[slug] = CharacterSummary(
            id=slug,
            name=name,
            weapon=item.get("weapon", "Unknown"),
            region=item.get("region", "Teyvat"),
            rarity=int(item.get("rarity", 4)),
            vision=vision_name,
            visionImage=vision_obj.get("image", ""),
            image=item.get("image", ""),
            hasCuratedBuild=len(builds) > 0,
            roles=roles,
            source="curated",
        )

    helper_index, yatta_items = await asyncio.gather(
        get_helper_team_index(),
        _fetch_yatta_avatars(),
    )
    for av in yatta_items.values():
        name = av.get("name", "")
        if not name or name in ("Manekin", "Manekina"):
            continue
        norm = slugify_name(name)
        norm = YATTA_SLUG_ALIASES.get(norm, norm)
        icon = av.get("icon", "")
        yatta_image_url = f"{settings.YATTA_ASSET_BASE}/{icon}.png" if icon else ""

        if name == "Traveler":
            if yatta_image_url:
                for slug_key in list(curated_by_slug.keys()):
                    if slug_key.startswith("traveler-"):
                        curated_by_slug[slug_key] = curated_by_slug[slug_key].model_copy(
                            update={"image": yatta_image_url}
                        )
            continue

        if norm in curated_by_slug:
            updates: dict[str, Any] = {}
            if yatta_image_url:
                updates["image"] = yatta_image_url
            if norm in helper_index:
                updates["roles"] = [r.replace("-", " ").upper() for r in helper_index[norm]["roles"]]
                updates["source"] = "helper-team+yatta"
            if updates:
                curated_by_slug[norm] = curated_by_slug[norm].model_copy(update=updates)
            continue

        vision_name = ELEMENT_MAP.get(av.get("element", ""), av.get("element", "Unknown"))
        weapon_name = WEAPON_TYPE_MAP.get(av.get("weaponType", ""), "Sword")
        region_name = REGION_MAP.get(str(av.get("region", "")).upper(), "Teyvat")
        helper_meta = helper_index.get(norm)

        curated_by_slug[norm] = CharacterSummary(
            id=norm,
            name=name,
            weapon=weapon_name,
            region=region_name,
            rarity=int(av.get("rank", 5)),
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
    await cache.set(CATALOG_CACHE_KEY, result, ttl_seconds=CATALOG_TTL)
    return result


async def get_character_detail(identifier: str) -> Optional[CharacterDetail]:
    """Resolve character detail by slug or name, merging curated builds with gi.yatta.moe metadata."""
    target_slug = slugify_name(identifier)
    detail_cache_key = f"irminsul:char_detail:{target_slug}"
    cached_detail = await cache.get(detail_cache_key)
    if cached_detail is not None:
        return cached_detail

    raw_curated = _load_curated_raw()
    curated_match = next(
        (item for item in raw_curated if slugify_name(item.get("name", "")) == target_slug),
        None,
    )

    yatta_items, build_bundle = await asyncio.gather(
        _fetch_yatta_avatars(),
        fetch_community_builds(target_slug),
    )
    community_builds, build_last_updated, version_released = build_bundle
    yatta_summary = next(
        (av for av in yatta_items.values() if slugify_name(av.get("name", "")) == target_slug),
        None,
    )
    live_data = (
        await _fetch_yatta_detail(yatta_summary["id"])
        if yatta_summary and "id" in yatta_summary
        else None
    )

    if not curated_match and not live_data:
        return None

    if curated_match:
        name = curated_match.get("name", "Unknown")
        vision_obj = curated_match.get("vision") or {}
        vision_name = vision_obj.get("name", "Unknown")
        builds = community_builds or [_normalize_build_entry(b) for b in curated_match.get("build", [])]
        yatta_icon = (live_data or {}).get("icon", "")
        yatta_image = f"{settings.YATTA_ASSET_BASE}/{yatta_icon}.png" if yatta_icon else ""
        summary_kwargs = dict(
            id=target_slug,
            name=name,
            weapon=curated_match.get("weapon", "Unknown"),
            region=curated_match.get("region", "Teyvat"),
            rarity=int(curated_match.get("rarity", 4)),
            vision=vision_name,
            visionImage=vision_obj.get("image", ""),
            image=yatta_image or curated_match.get("image", ""),
            hasCuratedBuild=len(builds) > 0,
            roles=[b.role for b in builds],
            source="helper-team+yatta" if community_builds else ("curated+yatta" if live_data else "curated"),
        )
    else:
        assert live_data is not None
        vision_name = ELEMENT_MAP.get(live_data.get("element", ""), "Unknown")
        weapon_name = WEAPON_TYPE_MAP.get(live_data.get("weaponType", ""), "Sword")
        region_name = REGION_MAP.get(str(live_data.get("region", "")).upper(), "Teyvat")
        icon = live_data.get("icon", "")
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
            name=live_data.get("name", identifier),
            weapon=weapon_name,
            region=region_name,
            rarity=int(live_data.get("rank", 5)),
            vision=vision_name,
            visionImage="",
            image=f"{settings.YATTA_ASSET_BASE}/{icon}.png" if icon else "",
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

    if live_data:
        for t in (live_data.get("talent") or {}).values():
            if isinstance(t, dict) and t.get("name"):
                t_icon = t.get("icon", "")
                talents.append({
                    "name": t.get("name", ""),
                    "unlock": str(t.get("type", "")),
                    "description": clean_hoyo_text(t.get("description", "")),
                    "icon": f"{settings.YATTA_ASSET_BASE}/{t_icon}.png" if t_icon else "",
                })
        for c in (live_data.get("constellation") or {}).values():
            if isinstance(c, dict) and c.get("name"):
                c_icon = c.get("icon", "")
                constellations.append({
                    "name": c.get("name", ""),
                    "unlock": "",
                    "description": clean_hoyo_text(c.get("description", "")),
                    "icon": f"{settings.YATTA_ASSET_BASE}/{c_icon}.png" if c_icon else "",
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
    await cache.set(detail_cache_key, detail, ttl_seconds=CATALOG_TTL)
    return detail
