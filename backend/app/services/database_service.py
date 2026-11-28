import asyncio
import logging
from typing import Any, Optional
from app.core.cache import cache
from app.core.config import settings
from app.core.constants import WEAPON_TYPE_MAP, safe_int, yatta_icon_url
from app.core.http import get_http_client
from app.schemas.database import (
    ArtifactSetItem,
    ElementalReactionItem,
    ElementalResonanceItem,
    ElementsDatabaseResponse,
    GearUserRecommendation,
    WeaponDetailResponse,
    WeaponItem,
)
from app.services.catalog_service import get_all_characters, slugify_name
from app.services.community_builds_service import fetch_community_builds, get_helper_team_index
from app.services.yatta_service import (
    SUBSTAT_MAP,
    _get_weapon_curve,
    _get_weapon_detail,
    _get_yatta_reliquaries,
    _get_yatta_weapons,
    _normalize_lookup_key,
    clean_hoyo_text,
    compute_weapon_stats,
    extract_weapon_affix,
)

logger = logging.getLogger(__name__)

ELEMENTS_TTL = 60 * 60 * 6  # 6 hours
_GEAR_RECS_LOCK = asyncio.Lock()

ELEMENTAL_REACTIONS: list[ElementalReactionItem] = [
    ElementalReactionItem(
        name="Vaporize",
        elements=["Pyro", "Hydro"],
        category="Amplifying",
        scaling="2.0× (Hydro→Pyro) / 1.5× (Pyro→Hydro) + EM",
        description="Multiplies the triggering hit's Pyro or Hydro DMG. Scales with Crit, DMG%, and Elemental Mastery.",
    ),
    ElementalReactionItem(
        name="Melt",
        elements=["Pyro", "Cryo"],
        category="Amplifying",
        scaling="2.0× (Pyro→Cryo) / 1.5× (Cryo→Pyro) + EM",
        description="Multiplies the triggering hit's Pyro or Cryo DMG. Ideal for burst and charged-attack carries.",
    ),
    ElementalReactionItem(
        name="Quicken → Aggravate / Spread",
        elements=["Dendro", "Electro"],
        category="Catalyze",
        scaling="Flat DMG Bonus + EM + Crit",
        description="Dendro + Electro applies Quicken. Hitting with Electro triggers Aggravate; hitting with Dendro triggers Spread.",
    ),
    ElementalReactionItem(
        name="Bloom → Hyperbloom / Burgeon",
        elements=["Dendro", "Hydro"],
        category="Transformative",
        scaling="Trigger Level + EM",
        description="Creates a Dendro Core. Applying Electro triggers homing Hyperbloom; applying Pyro triggers AoE Burgeon.",
    ),
    ElementalReactionItem(
        name="Overloaded",
        elements=["Pyro", "Electro"],
        category="Transformative",
        scaling="Level + EM (Pyro AoE DMG)",
        description="Triggers an explosion dealing AoE Pyro DMG and heavy poise break against shields and enemies.",
    ),
    ElementalReactionItem(
        name="Electro-Charged",
        elements=["Hydro", "Electro"],
        category="Transformative",
        scaling="Level + EM (Electro DoT)",
        description="Deals continuous Electro DMG over time while both Hydro and Electro auras coexist on targets.",
    ),
    ElementalReactionItem(
        name="Superconduct",
        elements=["Cryo", "Electro"],
        category="Transformative",
        scaling="Level + EM (-40% Physical RES)",
        description="Deals AoE Cryo DMG and reduces enemies' Physical RES by 40% for 12 seconds.",
    ),
    ElementalReactionItem(
        name="Frozen",
        elements=["Cryo", "Hydro"],
        category="Crowd Control",
        scaling="Duration (Shatter with Claymore/Geo)",
        description="Immobilizes non-boss enemies. Heavy/Geo attacks trigger Shatter for Physical DMG.",
    ),
    ElementalReactionItem(
        name="Swirl",
        elements=["Anemo", "Pyro"],
        category="Transformative",
        scaling="Level + EM (+Viridescent RES Shred)",
        description="Spreads Pyro, Hydro, Electro, or Cryo to nearby enemies while dealing AoE elemental DMG.",
    ),
    ElementalReactionItem(
        name="Crystallize",
        elements=["Geo", "Pyro"],
        category="Defensive",
        scaling="Level + EM (Shield Strength)",
        description="Generates elemental shards that grant a protective shield matching the absorbed element.",
    ),
    ElementalReactionItem(
        name="Burning",
        elements=["Dendro", "Pyro"],
        category="Transformative",
        scaling="Level + EM (Pyro DoT)",
        description="Applies continuous Pyro DMG over time and maintains a steady Pyro aura for Melt setups.",
    ),
]


async def get_database_weapons() -> list[WeaponItem]:
    weapons_idx = await _get_yatta_weapons()
    weapon_recs, _ = await _get_gear_recommendations()
    items: list[WeaponItem] = []
    for meta in weapons_idx.values():
        wid = safe_int(meta.get("id"), -1)
        if wid < 0:
            continue
        icon = meta.get("icon", "")
        wname = meta.get("name", "Weapon")
        items.append(
            WeaponItem(
                id=wid,
                name=wname,
                rarity=safe_int(meta.get("rank"), 3),
                weaponType=WEAPON_TYPE_MAP.get(meta.get("type", ""), "Sword"),
                subStat=SUBSTAT_MAP.get(meta.get("specialProp", "")),
                image=yatta_icon_url(icon),
                recommendedFor=weapon_recs.get(_normalize_lookup_key(wname), []),
            )
        )
    items.sort(key=lambda w: (-w.rarity, w.name.lower()))
    return items


async def _get_gear_recommendations() -> tuple[
    dict[str, list[GearUserRecommendation]],
    dict[str, list[GearUserRecommendation]],
]:
    """Build reverse-lookup maps prioritizing live Helper Team builds."""
    cache_key = "irminsul:db:gear_recs_v4"
    cached = await cache.get(cache_key)
    if cached is not None:
        w_raw, a_raw = cached
        return (
            {k: [GearUserRecommendation(**x) for x in v] for k, v in w_raw.items()},
            {k: [GearUserRecommendation(**x) for x in v] for k, v in a_raw.items()},
        )

    async with _GEAR_RECS_LOCK:
        cached = await cache.get(cache_key)
        if cached is not None:
            w_raw, a_raw = cached
            return (
                {k: [GearUserRecommendation(**x) for x in v] for k, v in w_raw.items()},
                {k: [GearUserRecommendation(**x) for x in v] for k, v in a_raw.items()},
            )

        return await _build_gear_recommendations(cache_key)


async def _build_gear_recommendations(
    cache_key: str,
) -> tuple[
    dict[str, list[GearUserRecommendation]],
    dict[str, list[GearUserRecommendation]],
]:

    weapon_map: dict[str, dict[str, GearUserRecommendation]] = {}
    artifact_map: dict[str, dict[str, GearUserRecommendation]] = {}

    all_chars = await get_all_characters()
    by_slug = {slugify_name(c.name): c for c in all_chars}
    by_id = {c.id.lower(): c for c in all_chars}

    def record(
        target_map: dict[str, dict[str, GearUserRecommendation]],
        gear_name: str,
        rec: GearUserRecommendation,
    ) -> None:
        gkey = _normalize_lookup_key(gear_name)
        if not gkey:
            return
        bucket = target_map.setdefault(gkey, {})
        existing = bucket.get(rec.characterId)
        if existing is None or rec.rank < existing.rank:
            bucket[rec.characterId] = rec

    # Index live Helper Team builds (matches Character Build Detail view 1:1)
    try:
        helper_idx = await get_helper_team_index()
        sem = asyncio.Semaphore(3)

        async def load_helper_char(slug: str) -> None:
            async with sem:
                guides, _, _ = await fetch_community_builds(slug)
            if not guides:
                return
            ch = by_id.get(slug.lower()) or by_slug.get(slug.lower())
            if not ch:
                return
            for g in guides:
                for idx, w in enumerate(g.weapons, start=1):
                    if w.name:
                        record(
                            weapon_map,
                            w.name,
                            GearUserRecommendation(
                                characterId=ch.id,
                                name=ch.name,
                                vision=ch.vision,
                                rarity=ch.rarity,
                                image=ch.image,
                                role=g.role,
                                rank=w.rank or idx,
                            ),
                        )
                for idx, art in enumerate(g.artifacts, start=1):
                    art_rank = art.rank or idx
                    art_names = [p.name for p in art.mix if p.name] if art.mix else ([art.name] if art.name else [])
                    for aname in art_names:
                        record(
                            artifact_map,
                            aname,
                            GearUserRecommendation(
                                characterId=ch.id,
                                name=ch.name,
                                vision=ch.vision,
                                rarity=ch.rarity,
                                image=ch.image,
                                role=g.role,
                                rank=art_rank,
                            ),
                        )

        await asyncio.gather(*(load_helper_char(s) for s in helper_idx.keys()), return_exceptions=True)
    except Exception as exc:
        logger.warning(f"Failed to index Helper Team gear recommendations: {exc}")

    w_out = {
        k: sorted(v.values(), key=lambda r: (r.rank, -r.rarity, r.name))
        for k, v in weapon_map.items()
    }
    a_out = {
        k: sorted(v.values(), key=lambda r: (r.rank, -r.rarity, r.name))
        for k, v in artifact_map.items()
    }

    if w_out or a_out:
        await cache.set(
            cache_key,
            (
                {k: [x.model_dump() for x in v] for k, v in w_out.items()},
                {k: [x.model_dump() for x in v] for k, v in a_out.items()},
            ),
            ttl_seconds=ELEMENTS_TTL,
        )
    return w_out, a_out


async def get_database_weapon_detail(weapon_id: int) -> Optional[WeaponDetailResponse]:
    client = get_http_client()
    detail, curve_90, (weapon_recs, _) = await asyncio.gather(
        _get_weapon_detail(client, weapon_id),
        _get_weapon_curve(),
        _get_gear_recommendations(),
    )
    if not detail:
        return None

    wname = detail.get("name", "Weapon")
    icon = detail.get("icon", "")
    passive_name, refinements, passive_desc = extract_weapon_affix(detail)
    base_atk_str, sub_val_str = compute_weapon_stats(detail, curve_90)
    return WeaponDetailResponse(
        id=safe_int(detail.get("id"), weapon_id),
        name=wname,
        rarity=safe_int(detail.get("rank"), 3),
        weaponType=WEAPON_TYPE_MAP.get(detail.get("type", ""), "Sword"),
        subStat=SUBSTAT_MAP.get(detail.get("specialProp", "")),
        baseAtk=base_atk_str,
        subStatValue=sub_val_str,
        image=yatta_icon_url(icon),
        description=clean_hoyo_text(detail.get("description")),
        passiveName=passive_name,
        passiveDescription=passive_desc,
        passiveRefinements=refinements,
        recommendedFor=weapon_recs.get(_normalize_lookup_key(wname), []),
    )


async def get_database_artifacts() -> list[ArtifactSetItem]:
    relics_idx = await _get_yatta_reliquaries()
    _, artifact_recs = await _get_gear_recommendations()
    items: list[ArtifactSetItem] = []
    for meta in relics_idx.values():
        aid = safe_int(meta.get("id"), -1)
        if aid < 0:
            continue
        icon = meta.get("icon", "")
        levels = [safe_int(lv, 4) for lv in (meta.get("levelList") or [4])]
        affixes = list((meta.get("affixList") or {}).values())
        aname = meta.get("name", "Artifact Set")
        items.append(
            ArtifactSetItem(
                id=aid,
                name=aname,
                maxRarity=max(levels) if levels else 4,
                image=f"{settings.YATTA_ASSET_BASE}/reliquary/{icon}.png" if icon else "",
                bonuses=[clean_hoyo_text(a) for a in affixes],
                recommendedFor=artifact_recs.get(_normalize_lookup_key(aname), []),
            )
        )
    items.sort(key=lambda a: (-a.maxRarity, a.name.lower()))
    return items


async def get_database_elements() -> ElementsDatabaseResponse:
    cache_key = "irminsul:db:elements"
    cached = await cache.get(cache_key)
    if cached is not None:
        return cached

    resonances: list[ElementalResonanceItem] = []
    try:
        client = get_http_client()
        res = await client.get(f"{settings.GENSHIN_API_BASE}/elements")
        if res.status_code == 200:
            raw_res: dict[str, Any] = res.json().get("data", {}).get("resonance", {})
            for rid, rdata in raw_res.items():
                if isinstance(rdata, dict) and rdata.get("name"):
                    resonances.append(
                        ElementalResonanceItem(
                            id=str(rid),
                            name=rdata.get("name", ""),
                            description=clean_hoyo_text(rdata.get("description")),
                        )
                    )
    except Exception as exc:
        logger.warning(f"Failed to fetch Yatta elements resonance: {exc}")

    response = ElementsDatabaseResponse(
        resonances=resonances,
        reactions=ELEMENTAL_REACTIONS,
    )
    if resonances:
        await cache.set(cache_key, response, ttl_seconds=ELEMENTS_TTL)
    return response
