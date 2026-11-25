# Irminix Backend

Stateless FastAPI service using an async in-memory TTL cache (`app/core/cache.py`) and a shared `httpx.AsyncClient` connection pool (`app/core/http.py`) instead of a database.

## Endpoints

- `GET /health` — Service health and active in-memory cache stats
- `GET /api/characters` — Merged character catalog (`genshin-impact-helper-team` + `gi.yatta.moe` + `build.json` fallback)
- `GET /api/characters/{identifier}` — Full character detail, build guides, weapon passives, artifact bonuses, talents, and constellations
- `POST /api/auth/connect` — Zero-password UID Quick-Connect via Enka.Network
- `GET /api/auth/profile/{uid}` — Retrieve or refresh a player's Enka.Network showcase and endgame stats
- `GET /api/achievements` — Full achievement catalog and categories from `gi.yatta.moe`
- `POST /api/achievements/guide` — Unlock walkthrough via Gemini 3.8 Flash or local fallback
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
