# Backend Technical Guide

## Directory Layout

- `app/main.py` — FastAPI initialization, `GZipMiddleware`, `CORSMiddleware`, background startup cache warmup (`_warm_startup_caches`), `lifespan` cleanup, and `/health` endpoint.
- `app/core/config.py` — Pydantic `BaseSettings` reading `.env` (`GEMINI_API_KEY`, `FRONTEND_URL`, `ENKA_USER_AGENT`, `GENSHIN_API_BASE`, `YATTA_ASSET_BASE`, `ENKA_API_BASE`).
- `app/core/cache.py` — Async-safe bounded `TTLCache` (`max_size=2000`) protected by `asyncio.Lock` with expired-first and oldest-entry eviction.
- `app/core/http.py` — Singleton `httpx.AsyncClient` with connection limits (`max_connections=40`, `max_keepalive_connections=20`) and event-loop lifecycle cleanup.
- `app/core/constants.py` — Shared `ELEMENT_MAP`, `WEAPON_TYPE_MAP`, `yatta_icon_url`, `safe_int`, and stampede-protected `fetch_yatta_json` helper (only caches valid non-empty dicts).
- `app/core/gemini.py` — Shared async Gemini helper (`generate_gemini_json`) using `client.aio.models.generate_content` with `gemini-2.5-flash`, 15s timeout (`asyncio.wait_for`), markdown fence stripping, and strict `dict` validation.
- `app/api/routes.py` — Archive, Tier List, Database (with `404` on unknown weapon ID), Farming/Planner, Team Analyzer, Advisor, Achievement, and Cache endpoints under `/api`.
- `app/api/auth.py` — Zero-password UID Quick-Connect endpoints under `/api/auth`.
- `app/schemas/` — Pydantic v2 camelCase models (`character.py`, `database.py`, `planner.py`, `auth.py`, `advisor.py`, `achievement.py`).
- `app/services/`:
  - `catalog_service.py`: Merges live `genshin-impact-helper-team` builds and `gi.yatta.moe` character metadata (applying `YATTA_SLUG_ALIASES` for `kokomi` / `sara` in both list and detail lookups). Caches `CharacterDetail` for 6 hours.
  - `community_builds_service.py`: Fetches the `genshin-builds` GitHub tree once, resolves role-level or character-root JSON files concurrently, and normalizes weapon/artifact/stat/talent priorities, `isBest` role flags, plus patch metadata (`lastUpdated`, `versionReleased`).
  - `yatta_service.py`: Enriches recommended weapons (icons, rarities, substats, Lv.1/Lv.90 Base ATK & Substat via `weaponCurve`, R1–R5 passives via `extract_weapon_affix`) and artifact sets (icons, 2pc/4pc bonuses, `GENERIC_SET_FALLBACKS` for 2pc mix tokens).
  - `database_service.py`: Serves weapons, artifact sets, and elemental reactions/resonances (`gi.yatta.moe` resonances + static `ELEMENTAL_REACTIONS`), and builds single-flight locked `recommendedFor` reverse-lookup maps (`_GEAR_RECS_LOCK`) from live Helper Team builds.
  - `tierlist_service.py`: Provides the Version 7.2 character tier list (`S`–`D`) mapped by official role (`Main DPS`, `Sub DPS`, `Support`) and exports `infer_role_group`.
  - `planner_service.py`: Fetches daily `gi.yatta.moe` domain schedules (`dailyDungeon` + `material`) with single-flight locked character-material indexing (`_MAT_MAP_LOCK`), calculates per-stage character ascension/talent material costs, and runs deterministic 4-slot team synergy analysis (Elemental Resonances, Swirl/Crystallize-aware Reactions, and `infer_role_group`-backed role coverage).
  - `enka_service.py`: Fetches Enka.Network UID profiles (with `JSONDecodeError` -> `502` guard), resolves newer characters/weapons/artifact sets via `gi.yatta.moe`, computes Artifact Crit Value (CV), and parses Spiral Abyss, Imaginarium Theater, and Stygian Onslaught stats.
  - `achievement_service.py`: Normalizes 1,900+ achievements from `gi.yatta.moe` and generates unlock walkthroughs via `generate_gemini_json` (`gemini-2.5-flash`) or `_deterministic_guide`.
  - `ai_service.py`: Evaluates builds with `generate_gemini_json` (`gemini-2.5-flash`) or `_deterministic_advisor` (supporting `scholar`, `strategist`, and `concise` tones, `4pc Marechaussee Hunter` / `Obsidian Codex` effective Crit Rate awareness, and showcase-fingerprinted cache keys).

---

## Manual Maintenance Guide (Patch Updates)

While character, weapon, artifact, domain, and achievement data sync automatically from `gi.yatta.moe` and `genshin-impact-helper-team`, the following items are **manually maintained** in the backend:

1. **Tier List (`app/services/tierlist_service.py`)**:
   - Update `TIER_OVERRIDES` whenever new characters release or meta rankings shift.
   - Update `patchLabel` in `get_tier_list()` (currently `"Version 7.2"`).
2. **Elemental Reactions (`app/services/database_service.py`)**:
   - Update `ELEMENTAL_REACTIONS` if HoYoverse introduces new elemental reactions or changes reaction scaling formulas.
3. **Slug & Region Mappings (`app/services/catalog_service.py`)**:
   - `YATTA_SLUG_ALIASES`: Add entries when `gi.yatta.moe` character names differ from `genshin-builds` folder slugs (e.g., `"sangonomiya-kokomi": "kokomi"`).
   - `REGION_MAP`: Add new nations if `gi.yatta.moe` introduces new region keys.
4. **Generic 2pc Artifact Mix Fallbacks (`app/services/yatta_service.py`)**:
   - `GENERIC_SET_FALLBACKS`: Add entries if `genshin-builds` introduces new generic 2pc shorthand keys (e.g., `emset`, `atkset`).
