import asyncio
import logging
import re
from typing import Any, Optional
import httpx
from app.core.cache import cache
from app.core.config import settings
from app.core.http import get_http_client
from app.schemas.character import CharacterBuildGuide

logger = logging.getLogger(__name__)

YATTA_TTL = 60 * 60 * 6  # 6 hours
WEAPON_DETAIL_TTL = 60 * 60 * 24  # 24 hours

SUBSTAT_MAP = {
    "FIGHT_PROP_CRITICAL": "Crit Rate",
    "FIGHT_PROP_CRITICAL_HURT": "Crit DMG",
    "FIGHT_PROP_ATTACK_PERCENT": "ATK%",
    "FIGHT_PROP_HP_PERCENT": "HP%",
    "FIGHT_PROP_DEFENSE_PERCENT": "DEF%",
    "FIGHT_PROP_CHARGE_EFFICIENCY": "Energy Recharge",
    "FIGHT_PROP_ELEMENT_MASTERY": "Elemental Mastery",
    "FIGHT_PROP_PHYSICAL_ADD_HURT": "Physical DMG",
}

GENERIC_SET_FALLBACKS: dict[str, tuple[str, str, str]] = {
    "emset": ("Any +80 EM Set", "UI_RelicIcon_15026_4", "Elemental Mastery +80."),
    "atkset": ("Any +18% ATK Set", "UI_RelicIcon_15001_4", "ATK +18%."),
    "erset": ("Any +20% ER Set", "UI_RelicIcon_15020_4", "Energy Recharge +20%."),
    "hpset": ("Any +20% HP Set", "UI_RelicIcon_15017_4", "HP +20%."),
    "defset": ("Any +30% DEF Set", "UI_RelicIcon_15021_4", "DEF +30%."),
    "healingset": ("Any +15% Healing Set", "UI_RelicIcon_14004_4", "Character Healing Effectiveness +15%."),
    "physicalset": ("Any +25% Physical DMG Set", "UI_RelicIcon_15018_4", "Physical DMG +25%."),
    "pyroset": ("Any +15% Pyro DMG Set", "UI_RelicIcon_15006_4", "Pyro DMG Bonus +15%."),
    "hydroset": ("Any +15% Hydro DMG Set", "UI_RelicIcon_15016_4", "Hydro DMG Bonus +15%."),
    "electroset": ("Any +15% Electro DMG Set", "UI_RelicIcon_14001_4", "Electro DMG Bonus +15%."),
    "cryoset": ("Any +15% Cryo DMG Set", "UI_RelicIcon_14003_4", "Cryo DMG Bonus +15%."),
    "anemoset": ("Any +15% Anemo DMG Set", "UI_RelicIcon_15002_4", "Anemo DMG Bonus +15%."),
    "geoset": ("Any +15% Geo DMG Set", "UI_RelicIcon_15014_4", "Geo DMG Bonus +15%."),
    "dendroset": ("Any +15% Dendro DMG Set", "UI_RelicIcon_15025_4", "Dendro DMG Bonus +15%."),
}


def clean_hoyo_text(raw: Optional[str]) -> str:
    """Strip HoYoverse rich-text color/italic tags and normalize whitespace."""
    if not raw:
        return ""
    cleaned = re.sub(r"</?(?:color|i|b)[^>]*>", "", raw)
    cleaned = cleaned.replace("\\n", "\n")
    return cleaned.strip()


def _normalize_lookup_key(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", name.lower())


async def _get_yatta_weapons() -> dict[str, dict[str, Any]]:
    cache_key = "irminsul:yatta:weapons:by_key"
    cached = await cache.get(cache_key)
    if cached is not None:
        return cached

    by_key: dict[str, dict[str, Any]] = {}
    try:
        client = get_http_client()
        res = await client.get(f"{settings.GENSHIN_API_BASE}/weapon")
        if res.status_code == 200:
            items = res.json().get("data", {}).get("items", {})
            for item in items.values():
                name = item.get("name", "")
                if name:
                    by_key[_normalize_lookup_key(name)] = item
    except Exception as exc:
        logger.warning(f"Failed to fetch Yatta weapon index: {exc}")

    await cache.set(cache_key, by_key, ttl_seconds=YATTA_TTL)
    return by_key


async def _get_yatta_reliquaries() -> dict[str, dict[str, Any]]:
    cache_key = "irminsul:yatta:reliquary:by_key"
    cached = await cache.get(cache_key)
    if cached is not None:
        return cached

    by_key: dict[str, dict[str, Any]] = {}
    try:
        client = get_http_client()
        res = await client.get(f"{settings.GENSHIN_API_BASE}/reliquary")
        if res.status_code == 200:
            items = res.json().get("data", {}).get("items", {})
            for item in items.values():
                name = item.get("name", "")
                if name:
                    by_key[_normalize_lookup_key(name)] = item
    except Exception as exc:
        logger.warning(f"Failed to fetch Yatta reliquary index: {exc}")

    await cache.set(cache_key, by_key, ttl_seconds=YATTA_TTL)
    return by_key


async def _get_weapon_detail(client: httpx.AsyncClient, weapon_id: int) -> Optional[dict[str, Any]]:
    cache_key = f"irminsul:yatta:weapon_detail:{weapon_id}"
    cached = await cache.get(cache_key)
    if cached is not None:
        return cached

    try:
        res = await client.get(f"{settings.GENSHIN_API_BASE}/weapon/{weapon_id}")
        if res.status_code == 200:
            data = res.json().get("data")
            if isinstance(data, dict):
                await cache.set(cache_key, data, ttl_seconds=WEAPON_DETAIL_TTL)
                return data
    except Exception:
        pass
    return None


async def enrich_builds_with_yatta(builds: list[CharacterBuildGuide]) -> list[CharacterBuildGuide]:
    """Attach live Yatta images, rarities, weapon passives, and artifact set bonuses."""
    if not builds:
        return builds

    weapons_idx, relics_idx = await asyncio.gather(
        _get_yatta_weapons(),
        _get_yatta_reliquaries(),
    )

    # Collect unique weapon IDs across top 6 weapons per build to fetch passives concurrently
    weapon_ids_to_fetch: dict[str, int] = {}
    for b in builds:
        for w in b.weapons[:6]:
            key = _normalize_lookup_key(w.name)
            match = weapons_idx.get(key)
            if match and "id" in match:
                weapon_ids_to_fetch[key] = int(match["id"])

    weapon_details: dict[int, dict[str, Any]] = {}
    if weapon_ids_to_fetch:
        client = get_http_client()
        results = await asyncio.gather(
            *[_get_weapon_detail(client, wid) for wid in weapon_ids_to_fetch.values()]
        )
        for wid, detail in zip(weapon_ids_to_fetch.values(), results):
            if detail:
                weapon_details[wid] = detail

    enriched_builds: list[CharacterBuildGuide] = []
    for b in builds:
        new_weapons = []
        for w in b.weapons[:6]:
            key = _normalize_lookup_key(w.name)
            meta = weapons_idx.get(key)
            if meta:
                wid = int(meta["id"])
                detail = weapon_details.get(wid, {})
                icon = meta.get("icon", "")
                affix_dict = detail.get("affix") or {}
                first_affix = next(iter(affix_dict.values()), {}) if isinstance(affix_dict, dict) else {}
                passive_name = first_affix.get("name")
                passive_desc = clean_hoyo_text((first_affix.get("upgrade") or {}).get("0"))
                new_weapons.append(
                    w.model_copy(
                        update={
                            "name": meta.get("name", w.name),
                            "rarity": int(meta.get("rank", w.rarity)),
                            "image": f"{settings.YATTA_ASSET_BASE}/{icon}.png" if icon else w.image,
                            "subStat": SUBSTAT_MAP.get(meta.get("specialProp", "")),
                            "passiveName": passive_name,
                            "description": passive_desc or clean_hoyo_text(detail.get("description")),
                        }
                    )
                )
            else:
                new_weapons.append(w)

        new_artifacts = []
        for art in b.artifacts[:6]:
            if art.mix:
                new_mix = []
                for m in art.mix:
                    m_key = _normalize_lookup_key(m.name)
                    rmeta = relics_idx.get(m_key)
                    if rmeta:
                        icon = rmeta.get("icon", "")
                        affixes = list((rmeta.get("affixList") or {}).values())
                        levels = rmeta.get("levelList") or [5]
                        new_mix.append(
                            m.model_copy(
                                update={
                                    "name": rmeta.get("name", m.name),
                                    "rarity": max(levels),
                                    "image": f"{settings.YATTA_ASSET_BASE}/reliquary/{icon}.png" if icon else m.image,
                                    "bonuses": [clean_hoyo_text(a) for a in affixes[:1]],
                                }
                            )
                        )
                    elif m_key in GENERIC_SET_FALLBACKS:
                        label, icon, bonus = GENERIC_SET_FALLBACKS[m_key]
                        new_mix.append(
                            m.model_copy(
                                update={
                                    "name": label,
                                    "rarity": 5,
                                    "image": f"{settings.YATTA_ASSET_BASE}/reliquary/{icon}.png",
                                    "bonuses": [bonus],
                                }
                            )
                        )
                    else:
                        new_mix.append(m)
                new_artifacts.append(art.model_copy(update={"mix": new_mix}))
            elif art.name:
                a_key = _normalize_lookup_key(art.name)
                rmeta = relics_idx.get(a_key)
                if rmeta:
                    icon = rmeta.get("icon", "")
                    affixes = list((rmeta.get("affixList") or {}).values())
                    levels = rmeta.get("levelList") or [5]
                    new_artifacts.append(
                        art.model_copy(
                            update={
                                "name": rmeta.get("name", art.name),
                                "rarity": max(levels),
                                "image": f"{settings.YATTA_ASSET_BASE}/reliquary/{icon}.png" if icon else art.image,
                                "bonuses": [clean_hoyo_text(a) for a in affixes],
                            }
                        )
                    )
                elif a_key in GENERIC_SET_FALLBACKS:
                    label, icon, bonus = GENERIC_SET_FALLBACKS[a_key]
                    new_artifacts.append(
                        art.model_copy(
                            update={
                                "name": label,
                                "rarity": 5,
                                "image": f"{settings.YATTA_ASSET_BASE}/reliquary/{icon}.png",
                                "bonuses": [bonus],
                            }
                        )
                    )
                else:
                    new_artifacts.append(art)
            else:
                new_artifacts.append(art)

        enriched_builds.append(
            b.model_copy(update={"weapons": new_weapons, "artifacts": new_artifacts})
        )

    return enriched_builds
