import asyncio
import logging
import re
from typing import Any, Optional
import httpx
from fastapi import HTTPException
from app.core.cache import cache
from app.core.config import settings
from app.core.http import get_http_client
from app.schemas.auth import (
    PlayerProfile,
    ShowcaseArtifact,
    ShowcaseCharacter,
    ShowcaseWeapon,
)

logger = logging.getLogger(__name__)

ENKA_STORE_TTL = 60 * 60 * 24  # 24 hours
PLAYER_CACHE_TTL = 60 * 5  # 5 minutes

ENKA_CHARS_URL = "https://raw.githubusercontent.com/EnkaNetwork/API-docs/master/store/characters.json"
ENKA_LOC_URL = "https://raw.githubusercontent.com/EnkaNetwork/API-docs/master/store/loc.json"

ELEMENT_MAP = {
    "Fire": "Pyro",
    "Water": "Hydro",
    "Electric": "Electro",
    "Ice": "Cryo",
    "Wind": "Anemo",
    "Rock": "Geo",
    "Grass": "Dendro",
}

EQUIP_TYPE_MAP = {
    "EQUIP_BRACER": "Flower",
    "EQUIP_NECKLACE": "Plume",
    "EQUIP_SHOES": "Sands",
    "EQUIP_RING": "Goblet",
    "EQUIP_DRESS": "Circlet",
}

STAT_LABEL_MAP = {
    "FIGHT_PROP_HP": "HP",
    "FIGHT_PROP_HP_PERCENT": "HP%",
    "FIGHT_PROP_ATTACK": "ATK",
    "FIGHT_PROP_ATTACK_PERCENT": "ATK%",
    "FIGHT_PROP_DEFENSE": "DEF",
    "FIGHT_PROP_DEFENSE_PERCENT": "DEF%",
    "FIGHT_PROP_CHARGE_EFFICIENCY": "Energy Recharge",
    "FIGHT_PROP_ELEMENT_MASTERY": "Elemental Mastery",
    "FIGHT_PROP_CRITICAL": "Crit Rate",
    "FIGHT_PROP_CRITICAL_HURT": "Crit DMG",
    "FIGHT_PROP_HEAL_ADD": "Healing Bonus",
    "FIGHT_PROP_FIRE_ADD_HURT": "Pyro DMG",
    "FIGHT_PROP_WATER_ADD_HURT": "Hydro DMG",
    "FIGHT_PROP_ELEC_ADD_HURT": "Electro DMG",
    "FIGHT_PROP_ICE_ADD_HURT": "Cryo DMG",
    "FIGHT_PROP_WIND_ADD_HURT": "Anemo DMG",
    "FIGHT_PROP_ROCK_ADD_HURT": "Geo DMG",
    "FIGHT_PROP_GRASS_ADD_HURT": "Dendro DMG",
    "FIGHT_PROP_PHYSICAL_ADD_HURT": "Physical DMG",
}

PERCENT_STATS = {
    "FIGHT_PROP_HP_PERCENT",
    "FIGHT_PROP_ATTACK_PERCENT",
    "FIGHT_PROP_DEFENSE_PERCENT",
    "FIGHT_PROP_CHARGE_EFFICIENCY",
    "FIGHT_PROP_CRITICAL",
    "FIGHT_PROP_CRITICAL_HURT",
    "FIGHT_PROP_HEAL_ADD",
    "FIGHT_PROP_FIRE_ADD_HURT",
    "FIGHT_PROP_WATER_ADD_HURT",
    "FIGHT_PROP_ELEC_ADD_HURT",
    "FIGHT_PROP_ICE_ADD_HURT",
    "FIGHT_PROP_WIND_ADD_HURT",
    "FIGHT_PROP_ROCK_ADD_HURT",
    "FIGHT_PROP_GRASS_ADD_HURT",
    "FIGHT_PROP_PHYSICAL_ADD_HURT",
}


def validate_uid(uid: str) -> str:
    cleaned = uid.strip()
    if not re.fullmatch(r"\d{9,10}", cleaned):
        raise HTTPException(
            status_code=400,
            detail="UID must be a 9- or 10-digit Genshin Impact UID.",
        )
    return cleaned


async def _get_metadata_stores() -> tuple[dict[str, Any], dict[str, str], dict[str, Any], dict[str, Any], dict[str, Any]]:
    """Fetch Enka store + Yatta live avatar/weapon/reliquary stores for complete, up-to-date ID resolution."""
    cache_key = "irminsul:enka:combined_stores"
    cached = await cache.get(cache_key)
    if cached is not None:
        return cached

    chars_data: dict[str, Any] = {}
    loc_en: dict[str, str] = {}
    yatta_avatars: dict[str, Any] = {}
    yatta_weapons: dict[str, Any] = {}
    yatta_relics: dict[str, Any] = {}

    async def safe_get(client: httpx.AsyncClient, url: str) -> Optional[dict[str, Any]]:
        try:
            r = await client.get(url)
            if r.status_code == 200:
                return r.json()
        except Exception as exc:
            logger.debug(f"Metadata fetch skipped ({url}): {exc}")
        return None

    client = get_http_client()
    c_res, l_res, ya_res, yw_res, yr_res = await asyncio.gather(
        safe_get(client, ENKA_CHARS_URL),
        safe_get(client, ENKA_LOC_URL),
        safe_get(client, f"{settings.GENSHIN_API_BASE}/avatar"),
        safe_get(client, f"{settings.GENSHIN_API_BASE}/weapon"),
        safe_get(client, f"{settings.GENSHIN_API_BASE}/reliquary"),
    )

    if c_res:
        chars_data = c_res
    if l_res:
        loc_en = l_res.get("en", {})
    if ya_res:
        yatta_avatars = ya_res.get("data", {}).get("items", {})
    if yw_res:
        yatta_weapons = yw_res.get("data", {}).get("items", {})
    if yr_res:
        yatta_relics = yr_res.get("data", {}).get("items", {})

    stores = (chars_data, loc_en, yatta_avatars, yatta_weapons, yatta_relics)
    await cache.set(cache_key, stores, ttl_seconds=ENKA_STORE_TTL)
    return stores


def _format_stat_value(prop_id: str, value: float) -> str:
    if prop_id in PERCENT_STATS:
        return f"{value:.1f}%"
    return f"{int(round(value)):,}"


def _parse_avatar(
    avatar: dict[str, Any],
    chars_meta: dict[str, Any],
    loc_en: dict[str, str],
    yatta_avatars: dict[str, Any],
    yatta_weapons: dict[str, Any],
    yatta_relics: dict[str, Any],
) -> ShowcaseCharacter:
    avatar_id = str(avatar.get("avatarId", ""))
    meta = chars_meta.get(avatar_id, {})
    yatta_meta = yatta_avatars.get(avatar_id, {})

    name_hash = str(meta.get("NameTextMapHash", ""))
    char_name = loc_en.get(name_hash) or yatta_meta.get("name") or f"Traveler ({avatar_id})"

    raw_element = meta.get("Element") or yatta_meta.get("element") or ""
    element = ELEMENT_MAP.get(raw_element, raw_element or "Unknown")

    if "rank" in yatta_meta:
        rarity = int(yatta_meta["rank"])
    else:
        quality = meta.get("QualityType", "QUALITY_PURPLE")
        rarity = 5 if "ORANGE" in quality else 4

    yatta_icon = yatta_meta.get("icon", "")
    side_icon = meta.get("SideIconName", "")
    if yatta_icon:
        icon_url = f"{settings.YATTA_ASSET_BASE}/{yatta_icon}.png"
    elif side_icon:
        icon_url = f"https://enka.network/ui/{side_icon.replace('_Side', '')}.png"
    else:
        icon_url = None

    prop_map = avatar.get("propMap", {})
    level = int(prop_map.get("4001", {}).get("val", 1))
    friendship = int(avatar.get("fetterInfo", {}).get("expLevel", 1))
    constellations = len(avatar.get("talentIdList", []))

    skill_map = avatar.get("skillLevelMap", {})
    talent_levels = [int(v) for v in skill_map.values()]

    fight_prop = avatar.get("fightPropMap", {})
    stats = {
        "Max HP": f"{int(round(fight_prop.get('2000', 0))):,}",
        "ATK": f"{int(round(fight_prop.get('2001', 0))):,}",
        "DEF": f"{int(round(fight_prop.get('2002', 0))):,}",
        "Elemental Mastery": f"{int(round(fight_prop.get('28', 0)))}",
        "Crit Rate": f"{fight_prop.get('20', 0) * 100:.1f}%",
        "Crit DMG": f"{fight_prop.get('22', 0) * 100:.1f}%",
        "Energy Recharge": f"{fight_prop.get('23', 1) * 100:.1f}%",
    }

    weapon: Optional[ShowcaseWeapon] = None
    artifacts: list[ShowcaseArtifact] = []
    total_crit_value = 0.0

    for equip in avatar.get("equipList", []):
        flat = equip.get("flat", {})
        item_type = flat.get("itemType")
        item_id = str(equip.get("itemId", ""))
        icon_name = flat.get("icon", "")

        if item_type == "ITEM_WEAPON":
            w_info = equip.get("weapon", {})
            affix_map = w_info.get("affixMap", {})
            refinement = (next(iter(affix_map.values()), 0)) + 1 if affix_map else 1
            w_stats = flat.get("weaponStats", [])
            base_atk = int(w_stats[0].get("statValue", 0)) if w_stats else None
            sub_stat_str = None
            if len(w_stats) > 1:
                sp = w_stats[1].get("appendPropId", "")
                sv = w_stats[1].get("statValue", 0)
                sub_stat_str = f"{STAT_LABEL_MAP.get(sp, sp)} {_format_stat_value(sp, sv)}"

            yatta_w = yatta_weapons.get(item_id, {})
            w_name = (
                loc_en.get(str(flat.get("nameTextMapHash", "")))
                or yatta_w.get("name")
                or "Equipped Weapon"
            )
            w_icon_name = icon_name or yatta_w.get("icon", "")
            w_icon = f"{settings.YATTA_ASSET_BASE}/{w_icon_name}.png" if w_icon_name else None

            weapon = ShowcaseWeapon(
                name=w_name,
                rarity=int(flat.get("rankLevel") or yatta_w.get("rank", 4)),
                level=int(w_info.get("level", 1)),
                refinement=refinement,
                baseAtk=base_atk,
                subStat=sub_stat_str,
                iconUrl=w_icon,
            )

        elif item_type == "ITEM_RELIQUARY":
            reliquary = equip.get("reliquary", {})
            main_stat_obj = flat.get("reliquaryMainstat", {})
            main_prop = main_stat_obj.get("mainPropId", "")
            main_val = float(main_stat_obj.get("statValue", 0))

            substats_parsed: list[dict[str, str]] = []
            for sub in flat.get("reliquarySubstats", []):
                sp = sub.get("appendPropId", "")
                sv = float(sub.get("statValue", 0))
                if sp == "FIGHT_PROP_CRITICAL":
                    total_crit_value += sv * 2
                elif sp == "FIGHT_PROP_CRITICAL_HURT":
                    total_crit_value += sv
                substats_parsed.append(
                    {
                        "stat": STAT_LABEL_MAP.get(sp, sp),
                        "value": _format_stat_value(sp, sv),
                    }
                )

            slot_name = EQUIP_TYPE_MAP.get(flat.get("equipType", ""), "Artifact")
            art_name = loc_en.get(str(flat.get("nameTextMapHash", "")), slot_name)
            set_name = loc_en.get(str(flat.get("setNameTextMapHash", "")))
            if not set_name and icon_name.startswith("UI_RelicIcon_"):
                parts = icon_name.split("_")
                if len(parts) >= 3:
                    set_name = yatta_relics.get(parts[2], {}).get("name")
            if not set_name:
                set_name = "Artifact Set"
            art_icon = (
                f"{settings.YATTA_ASSET_BASE}/reliquary/{icon_name}.png"
                if icon_name
                else None
            )

            artifacts.append(
                ShowcaseArtifact(
                    slot=slot_name,
                    name=art_name,
                    setName=set_name,
                    rarity=int(flat.get("rankLevel", 5)),
                    level=max(0, int(reliquary.get("level", 1)) - 1),
                    mainStat=STAT_LABEL_MAP.get(main_prop, main_prop),
                    mainStatValue=_format_stat_value(main_prop, main_val),
                    subStats=substats_parsed,
                    iconUrl=art_icon,
                )
            )

    return ShowcaseCharacter(
        avatarId=int(avatar_id) if avatar_id.isdigit() else 0,
        name=char_name,
        element=element,
        rarity=rarity,
        level=level,
        friendship=friendship,
        constellationsUnlocked=constellations,
        talentLevels=talent_levels,
        stats=stats,
        weapon=weapon,
        artifacts=artifacts,
        iconUrl=icon_url,
        critValue=round(total_crit_value, 1),
    )


async def fetch_player_showcase(uid: str, force_refresh: bool = False) -> PlayerProfile:
    """Fetch player profile and character showcase from Enka.Network with TTL cache."""
    clean_uid = validate_uid(uid)
    cache_key = f"irminsul:enka:uid:{clean_uid}"

    if not force_refresh:
        cached = await cache.get(cache_key)
        if cached is not None:
            return cached.model_copy(update={"cached": True})

    url = f"{settings.ENKA_API_BASE}/uid/{clean_uid}"
    headers = {"User-Agent": settings.ENKA_USER_AGENT}

    try:
        client = get_http_client()
        res = await client.get(url, headers=headers)
    except httpx.RequestError as exc:
        raise HTTPException(
            status_code=503,
            detail=f"Unable to reach Enka.Network: {exc}",
        ) from exc

    if res.status_code == 400:
        raise HTTPException(status_code=400, detail="Invalid UID format.")
    if res.status_code == 404:
        raise HTTPException(status_code=404, detail=f"Player UID {clean_uid} not found.")
    if res.status_code == 424:
        raise HTTPException(status_code=503, detail="Enka.Network is under game maintenance.")
    if res.status_code == 429:
        raise HTTPException(status_code=429, detail="Rate limited by Enka.Network. Try again shortly.")
    if res.status_code != 200:
        raise HTTPException(status_code=502, detail=f"Enka.Network returned status {res.status_code}.")

    payload = res.json()
    player_info = payload.get("playerInfo", {})
    if not player_info:
        raise HTTPException(status_code=404, detail="Player profile is unavailable.")

    chars_meta, loc_en, yatta_avatars, yatta_weapons, yatta_relics = await _get_metadata_stores()
    avatar_list = payload.get("avatarInfoList", [])
    showcase = [
        _parse_avatar(av, chars_meta, loc_en, yatta_avatars, yatta_weapons, yatta_relics)
        for av in avatar_list
    ]

    ttl = int(payload.get("ttl", PLAYER_CACHE_TTL))
    profile_pic_id = str(player_info.get("profilePicture", {}).get("avatarId", ""))
    yatta_pic_icon = yatta_avatars.get(profile_pic_id, {}).get("icon", "")
    pic_side = chars_meta.get(profile_pic_id, {}).get("SideIconName", "")
    if yatta_pic_icon:
        pic_url = f"{settings.YATTA_ASSET_BASE}/{yatta_pic_icon}.png"
    elif pic_side:
        pic_url = f"https://enka.network/ui/{pic_side.replace('_Side', '')}.png"
    else:
        pic_url = None

    profile = PlayerProfile(
        uid=clean_uid,
        nickname=player_info.get("nickname", f"Traveler {clean_uid}"),
        level=int(player_info.get("level", 1)),
        worldLevel=int(player_info.get("worldLevel", 0)),
        signature=player_info.get("signature", ""),
        finishAchievementNum=int(player_info.get("finishAchievementNum", 0)),
        towerFloorIndex=player_info.get("towerFloorIndex"),
        towerLevelIndex=player_info.get("towerLevelIndex"),
        towerStarIndex=player_info.get("towerStarIndex"),
        theaterActIndex=player_info.get("theaterActIndex"),
        theaterStarIndex=player_info.get("theaterStarIndex"),
        stygianIndex=player_info.get("stygianIndex"),
        stygianSeconds=player_info.get("stygianSeconds"),
        profilePictureUrl=pic_url,
        showcaseCharacters=showcase,
        cached=False,
        ttlSeconds=ttl,
    )

    await cache.set(cache_key, profile, ttl_seconds=max(60, min(ttl, 600)))
    return profile
