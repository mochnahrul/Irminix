# Backend Technical Guide

## Directory Layout

- `app/main.py` — FastAPI initialization, `GZipMiddleware`, `CORSMiddleware`, `lifespan` cleanup, and `/health` endpoint.
- `app/core/config.py` — Pydantic `BaseSettings` reading `.env` (`GEMINI_API_KEY`, `FRONTEND_URL`, `ENVIRONMENT`, `ENKA_USER_AGENT`, upstream base URLs).
- `app/core/cache.py` — Async-safe `TTLCache` protected by `asyncio.Lock`.
- `app/core/http.py` — Singleton `httpx.AsyncClient` with connection limits (`max_connections=40`, `max_keepalive_connections=20`).
- `app/api/routes.py` — Archive, Advisor, Achievement, and Cache endpoints under `/api`.
- `app/api/auth.py` — Zero-password UID Quick-Connect endpoints under `/api/auth`.
- `app/schemas/` — Pydantic v2 camelCase models (`character.py`, `auth.py`, `advisor.py`, `achievement.py`).
- `app/services/`:
  - `catalog_service.py`: Merges `genshin-impact-helper-team` builds, `gi.yatta.moe` live character data, and `@lru_cache` offline `data/build.json` fallback. Caches `CharacterDetail` for 6 hours.
  - `community_builds_service.py`: Fetches the `genshin-builds` GitHub tree once, resolves role-level or character-root JSON files concurrently, and normalizes weapon/artifact/stat/talent priorities.
  - `yatta_service.py`: Enriches recommended weapons (icons, rarities, substats, R1 passives) and artifact sets (icons, 2pc/4pc bonuses, generic 2pc mix fallbacks).
  - `enka_service.py`: Fetches Enka.Network UID profiles, resolves newer characters/weapons/artifact sets via `gi.yatta.moe`, computes Artifact Crit Value (CV), and parses Spiral Abyss, Imaginarium Theater, and Stygian Onslaught stats.
  - `achievement_service.py`: Normalizes 1,900+ achievements from `gi.yatta.moe` and generates unlock walkthroughs via `gemini-3.8-flash` or `_deterministic_guide`.
  - `ai_service.py`: Evaluates builds with `gemini-3.8-flash` or `_deterministic_advisor` (supporting `scholar`, `strategist`, and `concise` tones, plus `4pc Marechaussee Hunter` / `Obsidian Codex` effective Crit Rate awareness).
