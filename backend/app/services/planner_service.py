import asyncio
import datetime
import logging
from typing import Any, Optional
from app.core.cache import cache
from app.core.config import settings
from app.core.http import get_http_client
from app.schemas.character import CharacterSummary
from app.schemas.planner import (
    AscensionStagePlan,
    CharacterMaterialPlanResponse,
    DailyFarmingResponse,
    DomainScheduleItem,
    MaterialBrief,
    TalentStagePlan,
    TeamAnalyzeResponse,
)
from app.services.catalog_service import get_all_characters, get_character_detail, slugify_name
from app.services.database_service import ELEMENTAL_REACTIONS, get_database_elements
from app.services.tierlist_service import TIER_OVERRIDES

logger = logging.getLogger(__name__)

FARMING_TTL = 60 * 60 * 6  # 6 hours
MATERIAL_PLAN_TTL = 60 * 60 * 24  # 24 hours
_MAT_MAP_LOCK = asyncio.Lock()
DAYS_ORDER = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
SYSTEM_REWARD_IDS = {102, 105, 202}
CITY_NAMES = {
    1: "Mondstadt",
    2: "Liyue",
    3: "Inazuma",
    4: "Sumeru",
    5: "Fontaine",
    6: "Natlan",
    7: "Snezhnaya",
}
RESONANCE_ELEMENT_BY_NAME = {
    "fervent flames": "Pyro",
    "soothing water": "Hydro",
    "impetuous winds": "Anemo",
    "high voltage": "Electro",
    "sprawling greenery": "Dendro",
    "shattering ice": "Cryo",
    "enduring rock": "Geo",
}


def _icon_url(icon_name: str) -> str:
    if not icon_name:
        return ""
    return f"{settings.YATTA_ASSET_BASE}/{icon_name}.png"


async def _fetch_yatta_json(path: str, ttl: int) -> dict[str, Any]:
    from app.core.constants import fetch_yatta_json

    data = await fetch_yatta_json(
        f"irminsul:yatta:raw:{path}",
        f"{settings.GENSHIN_API_BASE}/{path}",
        ttl_seconds=ttl,
    )
    return data if isinstance(data, dict) else {}


async def _get_character_material_map() -> dict[int, list[CharacterSummary]]:
    """Map material item IDs -> characters that use them (cached 24h)."""
    cache_key = "irminsul:yatta:mat_to_chars"
    cached = await cache.get(cache_key)
    if cached is not None:
        return {int(k): [CharacterSummary(**c) for c in v] for k, v in cached.items()}

    async with _MAT_MAP_LOCK:
        cached = await cache.get(cache_key)
        if cached is not None:
            return {int(k): [CharacterSummary(**c) for c in v] for k, v in cached.items()}
        return await _build_character_material_map(cache_key)


async def _build_character_material_map(cache_key: str) -> dict[int, list[CharacterSummary]]:

    chars = await get_all_characters()
    avatars_idx = await _fetch_yatta_json("avatar", FARMING_TTL)
    avatar_items = avatars_idx.get("items", {}) if isinstance(avatars_idx, dict) else {}

    by_slug: dict[str, str] = {}
    for av_id, av_meta in avatar_items.items():
        name = av_meta.get("name", "")
        if name:
            by_slug[slugify_name(name)] = str(av_id)

    sem = asyncio.Semaphore(3)
    mat_map: dict[int, list[CharacterSummary]] = {}

    async def load_char_mats(ch: CharacterSummary) -> None:
        from app.core.constants import fetch_yatta_json

        av_id = by_slug.get(slugify_name(ch.id)) or by_slug.get(slugify_name(ch.name))
        if not av_id:
            return
        async with sem:
            av_data = await fetch_yatta_json(
                f"irminsul:yatta:detail:{av_id}",
                f"{settings.GENSHIN_API_BASE}/avatar/{av_id}",
                ttl_seconds=MATERIAL_PLAN_TTL,
            )
        asc = av_data.get("ascension", {}) if isinstance(av_data, dict) else {}
        if not isinstance(asc, dict):
            return
        for item_id_str in asc.keys():
            try:
                item_id = int(item_id_str)
            except (TypeError, ValueError):
                continue
            bucket = mat_map.setdefault(item_id, [])
            if not any(existing.id == ch.id for existing in bucket):
                bucket.append(ch)

    await asyncio.gather(*(load_char_mats(c) for c in chars), return_exceptions=True)

    if mat_map:
        serializable = {str(k): [c.model_dump() for c in v] for k, v in mat_map.items()}
        await cache.set(cache_key, serializable, ttl_seconds=MATERIAL_PLAN_TTL)

    return mat_map


async def get_daily_farming(day: Optional[str] = None) -> DailyFarmingResponse:
    """Return Talent Book & Weapon Material domains open on the requested day."""
    target_day = (day or datetime.datetime.now().strftime("%A")).strip().lower()
    if target_day not in DAYS_ORDER:
        target_day = DAYS_ORDER[datetime.datetime.now().weekday()]

    dungeon_data, mat_data, mat_to_chars = await asyncio.gather(
        _fetch_yatta_json("dailyDungeon", FARMING_TTL),
        _fetch_yatta_json("material", FARMING_TTL),
        _get_character_material_map(),
    )

    mat_items = mat_data.get("items", {}) if isinstance(mat_data, dict) else {}
    day_domains = dungeon_data.get(target_day, {}) if isinstance(dungeon_data, dict) else {}

    talent_domains: list[DomainScheduleItem] = []
    weapon_domains: list[DomainScheduleItem] = []

    seen_names: set[str] = set()
    for dom in day_domains.values() if isinstance(day_domains, dict) else []:
        dom_name = dom.get("name", "")
        if not dom_name or dom_name in seen_names:
            continue
        seen_names.add(dom_name)

        rewards = dom.get("reward", []) or []
        materials: list[MaterialBrief] = []
        matched_chars: list[CharacterSummary] = []
        seen_char_ids: set[str] = set()

        for raw_id in rewards:
            try:
                item_id = int(raw_id)
            except (TypeError, ValueError):
                continue
            if item_id in SYSTEM_REWARD_IDS:
                continue
            meta = mat_items.get(str(item_id), {})
            if not meta:
                continue
            materials.append(
                MaterialBrief(
                    id=item_id,
                    name=meta.get("name", f"Material #{item_id}"),
                    rank=int(meta.get("rank", 2)),
                    icon=_icon_url(meta.get("icon", "")),
                )
            )
            for ch in mat_to_chars.get(item_id, []):
                if ch.id not in seen_char_ids:
                    seen_char_ids.add(ch.id)
                    matched_chars.append(ch)

        materials.sort(key=lambda m: (-m.rank, m.name))
        matched_chars.sort(key=lambda c: (-c.rarity, c.name))

        is_talent = "mastery" in dom_name.lower()
        city_label = CITY_NAMES.get(int(dom.get("city", 0) or 0), "Teyvat")
        entry = DomainScheduleItem(
            id=int(dom.get("id", 0) or 0),
            name=dom_name,
            city=city_label,
            category="Talent Books" if is_talent else "Weapon Materials",
            materials=materials,
            characters=matched_chars if is_talent else [],
        )
        if is_talent:
            talent_domains.append(entry)
        else:
            weapon_domains.append(entry)

    talent_domains.sort(key=lambda d: (d.city, d.name))
    weapon_domains.sort(key=lambda d: (d.city, d.name))

    return DailyFarmingResponse(
        day=target_day,
        availableDays=DAYS_ORDER,
        talentDomains=talent_domains,
        weaponDomains=weapon_domains,
    )


async def get_character_material_plan(identifier: str) -> Optional[CharacterMaterialPlanResponse]:
    """Return per-stage character ascension & talent material requirements from gi.yatta.moe."""
    detail = await get_character_detail(identifier)
    if not detail:
        return None

    avatars_idx = await _fetch_yatta_json("avatar", FARMING_TTL)
    avatar_items = avatars_idx.get("items", {}) if isinstance(avatars_idx, dict) else {}

    av_id = None
    target_slug = slugify_name(detail.name)
    for k, meta in avatar_items.items():
        if slugify_name(meta.get("name", "")) == target_slug:
            av_id = str(k)
            break
    if not av_id:
        return None

    av_data, mat_data = await asyncio.gather(
        _fetch_yatta_json(f"avatar/{av_id}", MATERIAL_PLAN_TTL),
        _fetch_yatta_json("material", FARMING_TTL),
    )
    items_meta = av_data.get("items", {}) if isinstance(av_data, dict) else {}
    global_mats = mat_data.get("items", {}) if isinstance(mat_data, dict) else {}

    def resolve_costs(cost_items: dict[str, Any]) -> list[MaterialBrief]:
        out: list[MaterialBrief] = []
        for item_id_str, count in (cost_items or {}).items():
            try:
                item_id = int(item_id_str)
            except (TypeError, ValueError):
                continue
            meta = items_meta.get(str(item_id)) or global_mats.get(str(item_id)) or {}
            icon_name = meta.get("icon") or f"UI_ItemIcon_{item_id}"
            out.append(
                MaterialBrief(
                    id=item_id,
                    name=meta.get("name", f"Material #{item_id}"),
                    rank=int(meta.get("rank", 1)),
                    icon=_icon_url(icon_name),
                    count=int(count or 1),
                )
            )
        out.sort(key=lambda x: (-x.rank, x.name))
        return out

    ascension_stages: list[AscensionStagePlan] = []
    promotes = av_data.get("upgrade", {}).get("promote", []) or []
    for stage in promotes:
        plevel = int(stage.get("promoteLevel", 0) or 0)
        if plevel <= 0:
            continue
        ascension_stages.append(
            AscensionStagePlan(
                promoteLevel=plevel,
                unlockMaxLevel=int(stage.get("unlockMaxLevel", 20) or 20),
                coinCost=int(stage.get("coinCost", 0) or 0),
                items=resolve_costs(stage.get("costItems", {})),
            )
        )

    talent_stages: list[TalentStagePlan] = []
    talents_dict = av_data.get("talent", {}) or {}
    first_talent = next(iter(talents_dict.values()), {}) if isinstance(talents_dict, dict) else {}
    t_promote = first_talent.get("promote", {}) if isinstance(first_talent, dict) else {}
    for lvl_str, stage in t_promote.items():
        try:
            lvl = int(lvl_str)
        except (TypeError, ValueError):
            continue
        if lvl < 2 or lvl > 10:
            continue
        talent_stages.append(
            TalentStagePlan(
                level=lvl,
                coinCost=int(stage.get("coinCost", 0) or 0),
                items=resolve_costs(stage.get("costItems", {})),
            )
        )
    talent_stages.sort(key=lambda s: s.level)

    return CharacterMaterialPlanResponse(
        characterId=detail.id,
        name=detail.name,
        rarity=detail.rarity,
        vision=detail.vision,
        image=detail.image,
        ascensionStages=ascension_stages,
        talentStages=talent_stages,
    )


async def analyze_team_comp(character_ids: list[str]) -> TeamAnalyzeResponse:
    """Analyze up to 4 characters for Elemental Resonances, Reactions, and Role coverage."""
    all_chars = await get_all_characters()
    by_id = {c.id.lower(): c for c in all_chars}
    selected: list[CharacterSummary] = []
    seen: set[str] = set()
    for cid in character_ids[:4]:
        ch = by_id.get(cid.strip().lower())
        if ch and ch.id not in seen:
            seen.add(ch.id)
            selected.append(ch)

    elements = [c.vision for c in selected if c.vision]
    element_counts: dict[str, int] = {}
    for el in elements:
        element_counts[el] = element_counts.get(el, 0) + 1

    db_elements = await get_database_elements()
    active_resonances = []
    unique_elements = {el for el in elements if el.lower() != "unknown"}
    for res in db_elements.resonances:
        res_name_low = res.name.strip().lower()
        if "protective canopy" in res_name_low:
            if len(selected) == 4 and len(unique_elements) == 4:
                active_resonances.append(res)
            continue
        el_name = RESONANCE_ELEMENT_BY_NAME.get(res_name_low)
        if el_name and element_counts.get(el_name, 0) >= 2:
            active_resonances.append(res)

    present_set = {el.lower() for el in elements}
    reactable_elements = {"pyro", "hydro", "electro", "cryo"}
    triggerable_reactions = []
    for rx in ELEMENTAL_REACTIONS:
        rx_low = rx.name.lower()
        if "swirl" in rx_low:
            if "anemo" in present_set and (present_set & reactable_elements):
                triggerable_reactions.append(rx)
        elif "crystallize" in rx_low:
            if "geo" in present_set and (present_set & reactable_elements):
                triggerable_reactions.append(rx)
        elif all(req.lower() in present_set for req in rx.elements):
            triggerable_reactions.append(rx)

    from app.services.tierlist_service import infer_role_group

    role_counts: dict[str, int] = {"Main DPS": 0, "Sub DPS": 0, "Support": 0}
    for ch in selected:
        group = infer_role_group(ch)
        role_counts[group if group in role_counts else "Support"] += 1

    notes: list[str] = []
    if len(selected) < 4:
        notes.append(f"Add {4 - len(selected)} more character(s) to complete a full 4-slot party.")
    if active_resonances:
        notes.append(
            "Active resonance: " + ", ".join(r.name for r in active_resonances) + "."
        )
    elif len(selected) == 4:
        notes.append("No elemental resonance active — consider pairing two characters of the same element.")

    if triggerable_reactions:
        notes.append(
            f"Supports {len(triggerable_reactions)} reaction(s): "
            + ", ".join(r.name for r in triggerable_reactions[:4])
            + ("..." if len(triggerable_reactions) > 4 else ".")
        )
    elif len(selected) >= 2:
        notes.append("Mono-element or Geo/Anemo core — relies on raw DMG buffs and Shred rather than reactions.")

    if len(selected) == 4 and role_counts["Main DPS"] == 0:
        notes.append("Tip: No dedicated Main DPS detected — ensure one unit can drive on-field damage.")
    elif role_counts["Main DPS"] >= 2:
        notes.append("Tip: Multiple Main DPS units — watch field-time competition in your rotation.")

    return TeamAnalyzeResponse(
        characters=selected,
        activeResonances=active_resonances,
        triggerableReactions=triggerable_reactions,
        roleCounts=role_counts,
        synergyNotes=notes,
    )
