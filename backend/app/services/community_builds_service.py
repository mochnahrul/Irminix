import asyncio
import logging
import re
from typing import Any, Optional
import httpx
from app.core.cache import cache
from app.core.http import get_http_client
from app.schemas.character import (
    BuildArtifactOption,
    BuildArtifactPiece,
    BuildNoteItem,
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
    "bol": "Bond of Life",
    "ca": "Charged Attack",
    "pa": "Plunging Attack",
}


def _clean_helper_note(raw: str) -> str:
    """Convert Helper Team [[type:slug]] / {rot:...} and markdown tokens into clean prose."""
    if not raw:
        return ""

    def _replace_token(match: re.Match[str]) -> str:
        kind = match.group(1).lower()
        body = match.group(2).strip()
        if "|" in body:
            _, label = body.split("|", 1)
            return label.upper() if label.lower() in {"hp", "atk", "def", "er", "em"} else label.strip()
        if kind == "ability" and body.lower() in TALENT_DISPLAY_MAP:
            return TALENT_DISPLAY_MAP[body.lower()]
        if kind == "stat" and body.lower() in STAT_DISPLAY_MAP:
            return STAT_DISPLAY_MAP[body.lower()]
        return _humanize_slug(body)

    cleaned = re.sub(r"\[\[([a-zA-Z_-]+):([^\]]+)\]\]", _replace_token, raw)
    cleaned = re.sub(r"\{rot:([^}]+)\}", r"\1", cleaned)
    cleaned = cleaned.replace("**", "").replace("__", "")
    cleaned = cleaned.replace("\r\n", "\n")
    cleaned = re.sub(r"[ \t]+", " ", cleaned)
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)
    return "\n".join(line.strip() for line in cleaned.split("\n")).strip()


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
    if isinstance(token, dict) and isinstance(token.get("items"), list):
        parts = [_format_stat_token(it) for it in token["items"]]
        return " ≈ ".join(p for p in parts if p)
    raw = token.get("name", "") if isinstance(token, dict) else str(token)
    key = raw.strip().lower()
    if not key:
        return ""
    return STAT_DISPLAY_MAP.get(key, _humanize_slug(key))


_TREE_LOCK = asyncio.Lock()


async def get_helper_team_index() -> dict[str, dict[str, Any]]:
    """
    Fetch and cache the character -> {element, rarity, roles} index
    from genshin-impact-helper-team/genshin-builds in a single GitHub tree call.
    """
    cached = await cache.get(TREE_CACHE_KEY)
    if cached is not None:
        return cached

    async with _TREE_LOCK:
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

        if index:
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
        except Exception as exc:
            logger.warning("Helper Team fetch failed for %s/%s: %s(%s)", base, filename, type(exc).__name__, exc)
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
    weapons_data, sets_data, main_data, sub_data, talents_data, notes_data = await asyncio.gather(
        _fetch_role_json(client, role_url, char_url, "weapons.json"),
        _fetch_role_json(client, role_url, char_url, "artifacts-sets.json"),
        _fetch_role_json(client, role_url, char_url, "artifacts-mainstats.json"),
        _fetch_role_json(client, role_url, char_url, "artifacts-substats.json"),
        _fetch_role_json(client, role_url, char_url, "talents.json"),
        _fetch_role_json(client, role_url, char_url, "build-notes.json"),
    )

    def _extract_en_note(obj: Any) -> str:
        if not isinstance(obj, dict):
            return ""
        note_obj = obj.get("note")
        if isinstance(note_obj, dict):
            return _clean_helper_note(note_obj.get("en", ""))
        if isinstance(note_obj, str):
            return _clean_helper_note(note_obj)
        return ""

    weapons: list[BuildWeapon] = []
    weapon_notes: list[BuildNoteItem] = []
    for rank_idx, entry in enumerate(weapons_data.get("weapons", []), start=1):
        for item in entry.get("items", []):
            name_slug = item.get("name", "") if isinstance(item, dict) else str(item)
            if name_slug:
                label = _humanize_slug(name_slug)
                weapons.append(
                    BuildWeapon(
                        name=label,
                        rarity=5 if len(weapons) < 2 else 4,
                        refine=0,
                        image="",
                        rank=rank_idx,
                    )
                )
                note_text = _extract_en_note(item)
                if note_text:
                    weapon_notes.append(BuildNoteItem(label=label, note=note_text))

    artifacts: list[BuildArtifactOption] = []
    artifact_notes: list[BuildNoteItem] = []
    for rank_idx, entry in enumerate(sets_data.get("artifact_sets", []), start=1):
        groups = entry.get("groups", [])
        if not groups:
            continue
        for g in groups:
            g_items: list[dict[str, Any]] = []
            for it in g.get("items", []):
                if isinstance(it, dict) and it.get("name"):
                    g_items.append(it)
                    note_text = _extract_en_note(it)
                    if note_text:
                        artifact_notes.append(
                            BuildNoteItem(label=_humanize_slug(it["name"]), note=note_text)
                        )

            if not g_items:
                continue

            from app.core.constants import safe_int

            if all(safe_int(it.get("pieces"), 4) == 4 for it in g_items):
                for it in g_items:
                    artifacts.append(
                        BuildArtifactOption(
                            name=_humanize_slug(it["name"]),
                            rarity=5,
                            piece=4,
                            image="",
                            rank=rank_idx,
                        )
                    )
            else:
                mix_pieces = [
                    BuildArtifactPiece(
                        name=_humanize_slug(it["name"]),
                        rarity=5,
                        piece=safe_int(it.get("pieces"), 2),
                        image="",
                    )
                    for it in g_items
                ]
                if mix_pieces:
                    artifacts.append(BuildArtifactOption(mix=mix_pieces, rank=rank_idx))

    for cond in sets_data.get("conditional", []) or []:
        for it in cond.get("items", []) if isinstance(cond, dict) else []:
            if isinstance(it, dict) and it.get("name"):
                note_text = _extract_en_note(it)
                if note_text:
                    artifact_notes.append(
                        BuildNoteItem(label=f"{_humanize_slug(it['name'])} (Conditional)", note=note_text)
                    )

    main_stats: list[str] = []
    main_stat_notes: list[BuildNoteItem] = []
    raw_main = main_data.get("main_stats", {})
    for slot_key, slot_label in (("sands", "Sands"), ("goblet", "Goblet"), ("circlet", "Circlet")):
        vals = raw_main.get(slot_key, [])
        if vals:
            formatted_vals = [_format_stat_token(v) for v in vals]
            main_stats.append(f"{slot_label} - {' / '.join(formatted_vals)}")
            for v in vals:
                note_text = _extract_en_note(v)
                if note_text:
                    main_stat_notes.append(
                        BuildNoteItem(label=f"{slot_label} — {_format_stat_token(v)}", note=note_text)
                    )

    sub_stats: list[str] = []
    sub_stat_notes: list[BuildNoteItem] = []
    for s in sub_data.get("substats_priority", []):
        formatted = _format_stat_token(s)
        if formatted:
            sub_stats.append(formatted)
        if isinstance(s, dict) and isinstance(s.get("items"), list):
            for sub_it in s["items"]:
                note_text = _extract_en_note(sub_it)
                if note_text:
                    sub_stat_notes.append(BuildNoteItem(label=_format_stat_token(sub_it), note=note_text))
        else:
            note_text = _extract_en_note(s)
            if note_text and formatted:
                sub_stat_notes.append(BuildNoteItem(label=formatted, note=note_text))

    talent_priority: list[str] = []
    for t in talents_data.get("talents", []):
        for it in t.get("items", []):
            raw_t = it.get("name", "") if isinstance(it, dict) else str(it)
            if raw_t:
                talent_priority.append(
                    TALENT_DISPLAY_MAP.get(raw_t.lower(), _humanize_slug(raw_t))
                )

    notes: list[str] = []
    for n in notes_data.get("notes", []) if isinstance(notes_data, dict) else []:
        en_text = n.get("en", "") if isinstance(n, dict) else ""
        cleaned = _clean_helper_note(en_text)
        if cleaned:
            notes.append(cleaned)

    is_best = bool(notes_data.get("best")) if isinstance(notes_data, dict) else False

    return CharacterBuildGuide(
        role=role.replace("-", " ").upper(),
        isBest=is_best,
        weapons=weapons[:12],
        artifacts=artifacts[:8],
        mainStats=main_stats,
        subStats=sub_stats,
        talentPriority=talent_priority,
        notes=notes,
        weaponNotes=weapon_notes,
        artifactNotes=artifact_notes,
        mainStatNotes=main_stat_notes,
        subStatNotes=sub_stat_notes,
    )


async def fetch_community_builds(
    slug: str,
) -> tuple[Optional[list[CharacterBuildGuide]], Optional[str], Optional[str]]:
    """Fetch live Genshin Impact Helper Team builds and patch metadata for a character slug."""
    cache_key = f"irminix:helper_team:build_v9:{slug}"
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

    valid_builds = [b for b in builds if b.weapons or b.artifacts]
    valid_builds.sort(key=lambda b: (not b.isBest,))
    last_updated = str(meta_json.get("last_updated")) if meta_json.get("last_updated") else None
    version_released = (
        str(meta_json.get("version_released")) if meta_json.get("version_released") else None
    )
    if not valid_builds:
        return None, last_updated, version_released

    result = (valid_builds, last_updated, version_released)
    await cache.set(cache_key, result, ttl_seconds=BUILD_TTL)
    return result
