import asyncio
import logging
from typing import Any, Optional
import httpx
from app.core.cache import cache
from app.core.http import get_http_client
from app.schemas.character import (
    BuildArtifactOption,
    BuildArtifactPiece,
    BuildWeapon,
    CharacterBuildGuide,
)

logger = logging.getLogger(__name__)

HELPER_TREE_URL = "https://api.github.com/repos/genshin-impact-helper-team/genshin-builds/git/trees/main?recursive=1"
HELPER_RAW_BASE = "https://raw.githubusercontent.com/genshin-impact-helper-team/genshin-builds/main/src/content"
TREE_CACHE_KEY = "irminsul:helper_team:tree"
BUILD_TTL = 60 * 60 * 6  # 6 hours

STAT_DISPLAY_MAP = {
    "atk%": "ATK%",
    "hp%": "HP%",
    "def%": "DEF%",
    "em": "Elemental Mastery",
    "er": "Energy Recharge",
    "cr": "Crit Rate",
    "cd": "Crit DMG",
    "cr/cd": "Crit Rate / Crit DMG",
    "hb": "Healing Bonus",
    "pyro-dmg": "Pyro DMG Bonus",
    "hydro-dmg": "Hydro DMG Bonus",
    "electro-dmg": "Electro DMG Bonus",
    "cryo-dmg": "Cryo DMG Bonus",
    "anemo-dmg": "Anemo DMG Bonus",
    "geo-dmg": "Geo DMG Bonus",
    "dendro-dmg": "Dendro DMG Bonus",
    "physical-dmg": "Physical DMG Bonus",
}

TALENT_DISPLAY_MAP = {
    "na": "Normal Attack",
    "skill": "Elemental Skill",
    "burst": "Elemental Burst",
}


def _humanize_slug(slug: str) -> str:
    minor_words = {"of", "the", "and", "in", "to", "for", "a", "an", "with"}
    words = slug.replace("_", "-").split("-")
    formatted: list[str] = []
    for i, w in enumerate(words):
        if i > 0 and w.lower() in minor_words:
            formatted.append(w.lower())
        else:
            formatted.append(w.capitalize())
    return " ".join(formatted)


def _format_stat_token(token: Any) -> str:
    raw = token.get("name", "") if isinstance(token, dict) else str(token)
    key = raw.strip().lower()
    return STAT_DISPLAY_MAP.get(key, _humanize_slug(key))


async def get_helper_team_index() -> dict[str, dict[str, Any]]:
    """
    Fetch and cache the character -> {element, rarity, roles} index
    from genshin-impact-helper-team/genshin-builds in a single GitHub tree call.
    """
    cached = await cache.get(TREE_CACHE_KEY)
    if cached is not None:
        return cached

    index: dict[str, dict[str, Any]] = {}
    try:
        client = get_http_client()
        res = await client.get(HELPER_TREE_URL)
        if res.status_code != 200:
            logger.warning(f"GitHub tree fetch returned {res.status_code}")
            return {}
        tree = res.json().get("tree", [])
    except Exception as exc:
        logger.warning(f"Unable to reach GitHub Helper Team repo: {exc}")
        return {}

    for node in tree:
        path: str = node.get("path", "")
        if not path.startswith("src/content/") or not path.endswith("/weapons.json"):
            continue
        # Expected: src/content/{element}/{rarity}/{slug}/{role}/weapons.json
        parts = path.split("/")
        if len(parts) != 7:
            continue
        _, _, element, rarity, slug, role, _ = parts
        if element == "site":
            continue
        entry = index.setdefault(
            slug,
            {"element": element, "rarity": rarity, "roles": []},
        )
        if role not in entry["roles"]:
            entry["roles"].append(role)

    await cache.set(TREE_CACHE_KEY, index, ttl_seconds=BUILD_TTL)
    return index


async def _fetch_role_json(
    client: httpx.AsyncClient,
    role_url: str,
    char_url: str,
    filename: str,
) -> dict[str, Any]:
    for base in (role_url, char_url):
        try:
            res = await client.get(f"{base}/{filename}")
            if res.status_code == 200:
                return res.json()
        except Exception:
            pass
    return {}


async def _fetch_role_build(
    client: httpx.AsyncClient,
    element: str,
    rarity: str,
    slug: str,
    role: str,
) -> CharacterBuildGuide:
    char_url = f"{HELPER_RAW_BASE}/{element}/{rarity}/{slug}"
    role_url = f"{char_url}/{role}"
    weapons_data, sets_data, main_data, sub_data, talents_data = await asyncio.gather(
        _fetch_role_json(client, role_url, char_url, "weapons.json"),
        _fetch_role_json(client, role_url, char_url, "artifacts-sets.json"),
        _fetch_role_json(client, role_url, char_url, "artifacts-mainstats.json"),
        _fetch_role_json(client, role_url, char_url, "artifacts-substats.json"),
        _fetch_role_json(client, role_url, char_url, "talents.json"),
    )

    weapons: list[BuildWeapon] = []
    for entry in weapons_data.get("weapons", []):
        for item in entry.get("items", []):
            name_slug = item.get("name", "") if isinstance(item, dict) else str(item)
            if name_slug:
                weapons.append(
                    BuildWeapon(
                        name=_humanize_slug(name_slug),
                        rarity=5 if len(weapons) < 2 else 4,
                        refine=0,
                        image="",
                    )
                )

    artifacts: list[BuildArtifactOption] = []
    for entry in sets_data.get("artifact_sets", []):
        groups = entry.get("groups", [])
        if not groups:
            continue
        # Flatten single-group 4pc or multi-group 2pc+2pc
        if len(groups) == 1 and len(groups[0].get("items", [])) == 1:
            it = groups[0]["items"][0]
            artifacts.append(
                BuildArtifactOption(
                    name=_humanize_slug(it.get("name", "")),
                    rarity=5,
                    piece=int(it.get("pieces", 4)),
                    image="",
                )
            )
        else:
            mix_pieces: list[BuildArtifactPiece] = []
            for g in groups:
                for it in g.get("items", [])[:2]:
                    mix_pieces.append(
                        BuildArtifactPiece(
                            name=_humanize_slug(it.get("name", "")),
                            rarity=5,
                            piece=int(it.get("pieces", 2)),
                            image="",
                        )
                    )
            if mix_pieces:
                artifacts.append(BuildArtifactOption(mix=mix_pieces))

    main_stats: list[str] = []
    raw_main = main_data.get("main_stats", {})
    for slot_key, slot_label in (("sands", "Sands"), ("goblet", "Goblet"), ("circlet", "Circlet")):
        vals = raw_main.get(slot_key, [])
        if vals:
            formatted_vals = [_format_stat_token(v) for v in vals]
            main_stats.append(f"{slot_label} - {' / '.join(formatted_vals)}")

    sub_stats = [
        _format_stat_token(s) for s in sub_data.get("substats_priority", [])
    ]

    talent_priority: list[str] = []
    for t in talents_data.get("talents", []):
        for it in t.get("items", []):
            raw_t = it.get("name", "") if isinstance(it, dict) else str(it)
            if raw_t:
                talent_priority.append(
                    TALENT_DISPLAY_MAP.get(raw_t.lower(), _humanize_slug(raw_t))
                )

    return CharacterBuildGuide(
        role=role.replace("-", " ").upper(),
        weapons=weapons[:8],
        artifacts=artifacts[:6],
        mainStats=main_stats,
        subStats=sub_stats,
        talentPriority=talent_priority,
    )


async def fetch_community_builds(
    slug: str,
) -> tuple[Optional[list[CharacterBuildGuide]], Optional[str], Optional[str]]:
    """Fetch live Genshin Impact Helper Team builds and patch metadata for a character slug."""
    cache_key = f"irminix:helper_team:build_v2:{slug}"
    cached = await cache.get(cache_key)
    if cached is not None:
        return cached

    index = await get_helper_team_index()
    meta = index.get(slug)
    if not meta or not meta["roles"]:
        return None, None, None

    client = get_http_client()
    char_url = f"{HELPER_RAW_BASE}/{meta['element']}/{meta['rarity']}/{slug}"

    async def _fetch_meta() -> dict[str, Any]:
        try:
            r = await client.get(f"{char_url}/metadata.json")
            if r.status_code == 200:
                return r.json()
        except Exception:
            pass
        return {}

    meta_json, *builds = await asyncio.gather(
        _fetch_meta(),
        *[
            _fetch_role_build(
                client,
                meta["element"],
                meta["rarity"],
                slug,
                role,
            )
            for role in meta["roles"]
        ],
    )

    valid_builds = [b for b in builds if b.weapons or b.artifacts or b.mainStats]
    last_updated = str(meta_json.get("last_updated")) if meta_json.get("last_updated") else None
    version_released = (
        str(meta_json.get("version_released")) if meta_json.get("version_released") else None
    )
    if not valid_builds:
        return None, last_updated, version_released

    result = (valid_builds, last_updated, version_released)
    await cache.set(cache_key, result, ttl_seconds=BUILD_TTL)
    return result
