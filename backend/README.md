# Irminix Backend

Stateless FastAPI service using an async bounded in-memory TTL cache (`app/core/cache.py`, `max_size=2000`) and a shared `httpx.AsyncClient` connection pool (`app/core/http.py`) instead of a database.

## Data Sources

- **`gi.yatta.moe`**: Character list/details, weapons, weapon curve scaling, artifact sets, daily domains, material plans, achievements, and elemental resonances.
- **`genshin-impact-helper-team/genshin-builds`**: Community character build guides (weapons, artifacts, main/substats, talent priorities, role notes, and patch metadata).
- **`Enka.Network`**: Real-time player UID profile, showcase characters, equipped gear, and Spiral Abyss / Imaginarium Theater / Stygian Onslaught progress.
- **Google Gemini 2.5 Flash (`gemini-2.5-flash`)**: AI Build Advisor and Achievement unlock walkthroughs, with a deterministic local fallback engine when `GEMINI_API_KEY` is unset or rate-limited.
- **Manual / Static**: Tier List (`app/services/tierlist_service.py`) and Elemental Reactions (`app/services/database_service.py`).

## Endpoints

- `GET /health` — Service health and active in-memory cache stats
- `GET /api/characters` — Merged character catalog (`genshin-impact-helper-team` + `gi.yatta.moe`)
- `GET /api/characters/{identifier}` — Full character detail, build guides, weapon Lv.1/Lv.90 stats & R1–R5 passives, artifact bonuses, talents, and constellations
- `GET /api/tier-list` — Version 7.2 character tier list grouped by role *(manual `TIER_OVERRIDES`)*
- `GET /api/database/weapons` — All weapons from `gi.yatta.moe` with `recommendedFor` character previews
- `GET /api/database/weapons/{weapon_id}` — Weapon stats, R1–R5 passives, lore, and full `recommendedFor` character rankings (returns `404` if not found)
- `GET /api/database/artifacts` — All artifact sets with 2pc/4pc bonuses and `recommendedFor` character rankings
- `GET /api/database/elements` — Elemental Resonances (`gi.yatta.moe`) and Elemental Reactions (static table)
- `GET /api/farming/daily` — Daily Talent Book & Weapon Ascension domains (`monday`–`sunday`) with matching characters
- `GET /api/planner/character/{identifier}` — Per-stage character ascension & talent material costs
- `POST /api/teams/analyze` — 4-character team analysis (Elemental Resonances, Reactions, role coverage, tips)
- `POST /api/auth/connect` — Zero-password UID Quick-Connect via Enka.Network
- `GET /api/auth/profile/{uid}` — Retrieve or refresh a player's Enka.Network showcase and endgame stats
- `GET /api/achievements` — Full achievement catalog and categories from `gi.yatta.moe`
- `POST /api/achievements/guide` — Unlock walkthrough via Gemini 2.5 Flash or local fallback
- `POST /api/advisor` — Character build evaluation (Showcase Audit or Recommended Build Plan)
- `POST /api/cache/clear` — Clear in-memory TTL cache

## Local Development & Testing

```powershell
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

Run automated verification:

```powershell
python test_api.py
```
