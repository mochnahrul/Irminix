import asyncio
import logging
import re
from typing import Any, Optional
import httpx
from app.core.cache import cache
from app.core.config import settings
from app.core.constants import fetch_yatta_json, safe_int, yatta_icon_url
from app.core.http import get_http_client
from app.schemas.character import CharacterBuildGuide

logger = logging.getLogger(__name__)

YATTA_TTL = 60 * 60 * 6  # 6 hours
WEAPON_DETAIL_TTL = 60 * 60 * 24  # 24 hours
WEAPON_CURVE_URL = "https://gi.yatta.moe/api/v2/static/weaponCurve"

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
    """Strip HoYoverse rich-text tags ({LINK#...}, <color>, etc.) and normalize whitespace."""
    if not raw:
        return ""
    cleaned = re.sub(r"</?(?:color|i|b)[^>]*>", "", raw)
    cleaned = re.sub(r"\{/?LINK[^}]*\}", "", cleaned)
    cleaned = re.sub(r"\bLINK#[A-Za-z0-9_]+\}", "", cleaned)
    cleaned = re.sub(r"\{/?(?:SPRITE_PRESET|LAYOUT_[^}]*)[^}]*\}", "", cleaned)
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
    data = await fetch_yatta_json(
        "irminsul:yatta:raw:weapon",
        f"{settings.GENSHIN_API_BASE}/weapon",
        ttl_seconds=YATTA_TTL,
    )
    items = (data or {}).get("items") or {}
    if isinstance(items, dict):
        for item in items.values():
            if isinstance(item, dict):
                name = item.get("name") or ""
                if name:
                    by_key[_normalize_lookup_key(name)] = item

    if by_key:
        await cache.set(cache_key, by_key, ttl_seconds=YATTA_TTL)
    return by_key


async def _get_yatta_reliquaries() -> dict[str, dict[str, Any]]:
    cache_key = "irminsul:yatta:reliquary:by_key"
    cached = await cache.get(cache_key)
    if cached is not None:
        return cached

    by_key: dict[str, dict[str, Any]] = {}
    data = await fetch_yatta_json(
        "irminsul:yatta:raw:reliquary",
        f"{settings.GENSHIN_API_BASE}/reliquary",
        ttl_seconds=YATTA_TTL,
    )
    items = (data or {}).get("items") or {}
    if isinstance(items, dict):
        for item in items.values():
            if isinstance(item, dict):
                name = item.get("name") or ""
                if name:
                    by_key[_normalize_lookup_key(name)] = item

    if by_key:
        await cache.set(cache_key, by_key, ttl_seconds=YATTA_TTL)
    return by_key


async def _get_weapon_detail(_client: httpx.AsyncClient, weapon_id: int) -> Optional[dict[str, Any]]:
    return await fetch_yatta_json(
        f"irminsul:yatta:weapon_detail:{weapon_id}",
        f"{settings.GENSHIN_API_BASE}/weapon/{weapon_id}",
        ttl_seconds=WEAPON_DETAIL_TTL,
    )


def extract_weapon_affix(detail: dict[str, Any]) -> tuple[Optional[str], list[str], Optional[str]]:
    """Extract passive name, R1..R5 cleaned refinement descriptions, and base passive."""
    affix_dict = detail.get("affix") or {}
    first_affix = next(iter(affix_dict.values()), {}) if isinstance(affix_dict, dict) else {}
    if not isinstance(first_affix, dict):
        return None, [], None
    passive_name = first_affix.get("name")
    upgrade_map = first_affix.get("upgrade") or {}
    refinements = [
        clean_hoyo_text(upgrade_map.get(str(idx)))
        for idx in range(5)
        if upgrade_map.get(str(idx))
    ]
    passive_desc = refinements[0] if refinements else (clean_hoyo_text(upgrade_map.get("0")) or None)
    return passive_name, refinements, passive_desc


async def _get_weapon_curve() -> dict[str, float]:
    """Fetch Lv.90 weapon scaling multipliers from gi.yatta.moe (cached 24h)."""
    cache_key = "irminsul:yatta:weapon_curve:90"
    cached = await cache.get(cache_key)
    if cached is not None:
        return cached
    curve_90: dict[str, float] = {}
    try:
        client = get_http_client()
        res = await client.get(WEAPON_CURVE_URL)
        if res.status_code == 200:
            curve_90 = (
                res.json().get("data", {}).get("90", {}).get("curveInfos", {}) or {}
            )
    except Exception as exc:
        logger.warning(f"Failed to fetch Yatta weaponCurve: {exc}")
    if curve_90:
        await cache.set(cache_key, curve_90, ttl_seconds=WEAPON_DETAIL_TTL)
    return curve_90


def compute_weapon_stats(
    detail: dict[str, Any],
    curve_90: dict[str, float],
) -> tuple[Optional[str], Optional[str]]:
    """Compute Lv.1 / Lv.90 Base ATK and Substat strings from Yatta upgrade data."""
    upgrade = detail.get("upgrade") or {}
    props = upgrade.get("prop") or []
    promotes = upgrade.get("promote") or []
    max_promote_atk = 0.0
    if promotes and isinstance(promotes[-1], dict):
        max_promote_atk = float(
            (promotes[-1].get("addProps") or {}).get("FIGHT_PROP_BASE_ATTACK", 0.0) or 0.0
        )

    base_atk_str: Optional[str] = None
    sub_val_str: Optional[str] = None

    for p in props:
        if not isinstance(p, dict):
            continue
        ptype = p.get("propType", "")
        init_val = float(p.get("initValue", 0.0) or 0.0)
        ctype = p.get("type", "")
        mult = float(curve_90.get(ctype, 1.0) or 1.0)

        if ptype == "FIGHT_PROP_BASE_ATTACK" and init_val > 0:
            lv1 = round(init_val)
            lv90 = round(init_val * mult + max_promote_atk)
            base_atk_str = f"{lv1} / {lv90}"
        elif ptype and ptype != "FIGHT_PROP_BASE_ATTACK" and init_val > 0:
            if ptype == "FIGHT_PROP_ELEMENT_MASTERY":
                lv1 = round(init_val)
                lv90 = round(init_val * mult)
                sub_val_str = f"{lv1} / {lv90}"
            else:
                lv1 = round(init_val * 100, 1)
                lv90 = round(init_val * mult * 100, 1)
                sub_val_str = f"{lv1:.1f}% / {lv90:.1f}%"

    return base_atk_str, sub_val_str


async def enrich_builds_with_yatta(builds: list[CharacterBuildGuide]) -> list[CharacterBuildGuide]:
    """Attach live Yatta images, rarities, weapon passives, and artifact set bonuses."""
    if not builds:
        return builds

    weapons_idx, relics_idx, curve_90 = await asyncio.gather(
        _get_yatta_weapons(),
        _get_yatta_reliquaries(),
        _get_weapon_curve(),
    )

    # Collect unique weapon IDs across top 6 weapons per build to fetch passives concurrently
    weapon_ids_to_fetch: dict[str, int] = {}
    for b in builds:
        for w in b.weapons:
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
        for w in b.weapons:
            key = _normalize_lookup_key(w.name)
            meta = weapons_idx.get(key)
            if meta and meta.get("id") is not None:
                wid = safe_int(meta.get("id"))
                detail = weapon_details.get(wid, {})
                icon = meta.get("icon", "")
                passive_name, refinements, passive_desc = extract_weapon_affix(detail)
                base_atk_str, sub_val_str = compute_weapon_stats(detail, curve_90)
                new_weapons.append(
                    w.model_copy(
                        update={
                            "name": meta.get("name", w.name),
                            "rarity": safe_int(meta.get("rank"), w.rarity),
                            "image": yatta_icon_url(icon) or w.image,
                            "subStat": SUBSTAT_MAP.get(meta.get("specialProp", "")),
                            "baseAtk": base_atk_str,
                            "subStatValue": sub_val_str,
                            "passiveName": passive_name,
                            "description": passive_desc or clean_hoyo_text(detail.get("description")),
                            "passiveRefinements": refinements,
                        }
                    )
                )
            else:
                new_weapons.append(w)

        def resolve_art_fields(
            art_name: str,
            fallback_image: str,
            max_bonuses: Optional[int] = None,
        ) -> Optional[dict[str, Any]]:
            a_key = _normalize_lookup_key(art_name)
            rmeta = relics_idx.get(a_key)
            if rmeta:
                icon = rmeta.get("icon", "")
                affixes = list((rmeta.get("affixList") or {}).values())
                if max_bonuses is not None:
                    affixes = affixes[:max_bonuses]
                levels = [safe_int(lv, 5) for lv in (rmeta.get("levelList") or [5])]
                return {
                    "name": rmeta.get("name", art_name),
                    "rarity": max(levels) if levels else 5,
                    "image": f"{settings.YATTA_ASSET_BASE}/reliquary/{icon}.png" if icon else fallback_image,
                    "bonuses": [clean_hoyo_text(a) for a in affixes],
                }
            if a_key in GENERIC_SET_FALLBACKS:
                label, icon, bonus = GENERIC_SET_FALLBACKS[a_key]
                return {
                    "name": label,
                    "rarity": 5,
                    "image": f"{settings.YATTA_ASSET_BASE}/reliquary/{icon}.png",
                    "bonuses": [bonus],
                }
            return None

        new_artifacts = []
        for art in b.artifacts:
            if art.mix:
                new_mix = []
                for m in art.mix:
                    upd = resolve_art_fields(m.name, m.image, max_bonuses=1)
                    new_mix.append(m.model_copy(update=upd) if upd else m)
                new_artifacts.append(art.model_copy(update={"mix": new_mix}))
            elif art.name:
                upd = resolve_art_fields(art.name, art.image)
                new_artifacts.append(art.model_copy(update=upd) if upd else art)
            else:
                new_artifacts.append(art)

        enriched_builds.append(
            b.model_copy(update={"weapons": new_weapons, "artifacts": new_artifacts})
        )

    return enriched_builds
