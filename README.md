# Irminix — Genshin Impact Build Guide & Profile

**Irminix** (inspired by *Irminsul*, refactored from *Genshin Prodigy*) is a stateless, database-free full-stack web application built with a calm, warm alabaster editorial interface. It combines community character build guides (`genshin-impact-helper-team/genshin-builds`), live game metadata & assets (`gi.yatta.moe`), real-time player showcase syncing (`Enka.Network`), an Achievement Tracker, and a Build Advisor (`Google Gemini 2.5 Flash` with a deterministic local engine fallback).

---

## Key Features

- **Character Builds Codex**: Filterable catalog of all Genshin Impact characters by Element, Weapon Type, Rarity, and search query, with patch-versioned community builds (`Build Updated` / `Released` badges), **Best** role indicator, weapon rankings with **Lv.1 / Lv.90 Base ATK & Substats** and interactive **R1–R5** passives, artifact set bonuses (`4pc` and `2pc + 2pc`), main/substat priorities, talent priority with skill/burst icons, combat kit, constellations, **Material Calculator** quick shortcut, and PNG card export.
- **Tier List (Version 7.2)**: Role-aware character tier list (`S / A / B / C / D`) with Role, Element, Weapon, Rarity, and search filters. *(Requires manual patch updates — see [Manual Maintenance](#manual-maintenance-per-patch)).*
- **Team Comp & Synergy Checker**: 4-slot party builder that evaluates active **Elemental Resonances**, **Triggerable Elemental Reactions** (including Swirl & Crystallize), role balance (`Main DPS`, `Sub DPS`, `Support`), and synergy tips.
- **Farming Schedule & Material Planner**: Daily Talent Book & Weapon Ascension domain rotation (`Mon–Sun`, highlighting UID Showcase characters) plus a per-character **Ascension & Talent Material Calculator** (`From → To` levels + Mora cost), also reachable directly from any Character Build page.
- **Game Database**: Searchable index of **Weapons** (with Lv.1/Lv.90 stats & R1–R5 passives), **Artifact Sets**, and **Elemental Reactions & Resonances** (with element badges & party activation requirements), rarity backdrops, character avatar previews (`+N more`), and clickable **Best Used By** modals.
- **My Profile (UID Quick-Connect)**: Zero-password Genshin UID lookup via **Enka.Network**, displaying Adventure Rank, World Level, Spiral Abyss, Imaginarium Theater, Stygian Onslaught, Top 12 showcase characters ranked by Character Value, 7-stat strip, 5-piece artifact inspector with **Crit Value (CV) & Grade (`SS/S/A/B`)**, and **Share Build Card** (PNG + Discord Markdown).
- **Achievement Tracker**: Full catalog of 1,900+ achievements from `gi.yatta.moe` with category/status filtering, `localStorage` completion checklist synced per UID, and **How to Unlock** walkthroughs.
- **Build Advisor**: Evaluates either your actual equipped UID showcase build (*Checking Your Equipped Build*) or target build plan (*Recommended Build Plan*) across 5 dimensions with 3 advice styles (`Balanced`, `Min-Max`, `Short`).

---

## Data Sources

Irminix does not use a database. All data comes from the following upstream APIs, community repositories, AI models, and curated static tables:

| Feature / Data | Source | Update Behavior |
|---|---|---|
| **Characters, Weapons, Artifacts, Talents, Constellations, Icons, Daily Domains, Material Costs, Achievements, Elemental Resonances** | [`gi.yatta.moe`](https://gi.yatta.moe/) (`api/v2/en/...` & `static/weaponCurve`) | **Automatic** (cached 6h–24h in backend memory) |
| **Character Build Guides** (Recommended Weapons, Artifact Sets, Main/Substats, Talent Priority, Notes, Best Role) | [`genshin-impact-helper-team/genshin-builds`](https://github.com/genshin-impact-helper-team/genshin-builds) (GitHub Raw) | **Automatic** (cached 6h in backend memory) |
| **Player Profile, Showcase Characters, Equipped Gear & Endgame Progress** | [`Enka.Network`](https://enka.network/) (`api/uid/{uid}`) | **Live per UID** (cached 1–10 min per Enka `ttl`, refreshable) |
| **Build Advisor & Achievement Unlock Walkthroughs** | **Google Gemini 2.5 Flash** (`gemini-2.5-flash`) + Local Deterministic Engine fallback | **On-demand** (cached 30m for Advisor, 24h for Achievement Guides) |
| **Tier List Rankings (`S`–`D`), Elemental Reactions Table, Resonance Element/Requirement Badges** | **Manual / Static** in codebase | **Manual** — must be updated by maintainers on new patches |

---

## Manual Maintenance (Per Patch)

When a new Genshin Impact version or new characters/reactions are released, update these files manually:

1. **Tier List (`S`–`D` & Role Overrides)** — [`backend/app/services/tierlist_service.py`](backend/app/services/tierlist_service.py):
   - Update `TIER_OVERRIDES` (`"character-slug": ("S"|"A"|"B"|"C"|"D", "Main DPS"|"Sub DPS"|"Support")`) and `patchLabel` (`"Version X.Y"`). Characters not listed in `TIER_OVERRIDES` fall back to tier `"B"` with inferred role.
2. **Elemental Reactions** — [`backend/app/services/database_service.py`](backend/app/services/database_service.py):
   - Update `ELEMENTAL_REACTIONS` if new reactions or reaction scaling mechanics are introduced.
3. **Elemental Resonance UI Badges** — [`frontend/src/components/database/DatabaseView.tsx`](frontend/src/components/database/DatabaseView.tsx):
   - Update `RESONANCE_ELEMENT_MAP` if new Elemental Resonances are added in-game.
4. **Slug Aliases / Regions / Generic 2pc Mix Fallbacks** (rarely needed):
   - `YATTA_SLUG_ALIASES` & `REGION_MAP` in [`backend/app/services/catalog_service.py`](backend/app/services/catalog_service.py)
   - `GENERIC_SET_FALLBACKS` in [`backend/app/services/yatta_service.py`](backend/app/services/yatta_service.py)

---

## Tech Stack

| Layer | Technologies |
|---|---|
| **Backend** | Python 3.11+, FastAPI, Pydantic v2, `httpx` (shared keep-alive pool), GZip middleware, Async Bounded In-Memory TTL Cache (no database) |
| **Frontend** | React 18, TypeScript, Vite 5, Tailwind CSS, Framer Motion, Lucide React, `html-to-image` |
| **External APIs & AI** | Enka.Network API, `gi.yatta.moe`, `genshin-impact-helper-team/genshin-builds`, Google Gemini 2.5 Flash (`google-genai`) |

---

## Project Structure

```text
Genshin Prodigy/
├── backend/
│   ├── app/
│   │   ├── api/                 # FastAPI routers (routes.py, auth.py)
│   │   ├── core/                # Settings, constants/Yatta fetcher, Gemini helper, shared httpx pool, bounded TTLCache
│   │   ├── schemas/             # Pydantic v2 camelCase schemas
│   │   └── services/            # Catalog, Community Builds, Yatta, Enka, Database, Tier List, Planner, Achievements, AI
│   ├── Dockerfile               # Cloud Run container definition
│   ├── requirements.txt
│   ├── test_api.py
│   └── README.md
├── frontend/
│   ├── public/favicon.svg
│   ├── src/
│   │   ├── components/          # advisor, auth, build, characters, common, database, layout, planner, showcase, teams, tierlist, ui
│   │   ├── contexts/            # SessionContext (UID & Guest state in localStorage)
│   │   ├── lib/                 # Element palette, rarity helpers & Tailwind utilities
│   │   ├── services/            # Typed API client with 2-min in-memory TTL cache
│   │   └── types/               # TypeScript domain types
│   ├── package.json
│   ├── tailwind.config.ts
│   └── README.md
├── docs/
│   ├── HIGH_LEVEL_ARCHITECTURE.md
│   ├── BACKEND_TECH.md
│   ├── FRONTEND_TECH.md
│   └── DEPLOYMENT.md
├── .env.example
├── .gitignore
└── README.md
```

---

## Quickstart

### 1. Backend Setup
```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```
Swagger UI: `http://127.0.0.1:8000/docs`

### 2. Frontend Setup
```powershell
cd frontend
npm install
copy .env.example .env
npm run dev -- --host 127.0.0.1 --port 5173
```
Open `http://127.0.0.1:5173/` in your browser.

---

## Documentation

- [High-Level Architecture](docs/HIGH_LEVEL_ARCHITECTURE.md) — System overview, data sources matrix, caching, and latency strategy.
- [Backend Technical Guide](docs/BACKEND_TECH.md) — FastAPI services, HTTP pooling, upstream resolvers, manual patch updates, and endpoints.
- [Frontend Technical Guide](docs/FRONTEND_TECH.md) — Component tree, state management, responsive design tokens, and caching.
- [Deployment Guide](docs/DEPLOYMENT.md) — Production deployment on **Vercel** (Frontend) + **Google Cloud Run** (Backend).
