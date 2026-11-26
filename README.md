# Irminix — Genshin Impact Build Guide & Profile

**Irminix** (inspired by *Irminsul*, refactored from *Genshin Prodigy*) is a stateless, database-free full-stack web application built with a calm, warm alabaster editorial interface. It combines community character build guides (`genshin-impact-helper-team/genshin-builds`), live game metadata & assets (`gi.yatta.moe`), real-time player showcase syncing (`Enka.Network`), an Achievement Tracker, and a Build Advisor (`Google Gemini 3.8 Flash` with a context-aware local engine fallback).

---

## Key Features

- **Character Builds Codex**: Filterable catalog of all Genshin Impact characters by Element, Weapon Type, Rarity, and search query, with patch-versioned community builds (`Build Updated` / `Released` badges), weapon rankings + passives, artifact set bonuses (`4pc` and `2pc + 2pc`), main/substat priorities, talent order, combat kit, constellations, and PNG card export.
- **Tier List (Version 7.2)**: Role-aware character tier list (`S / A / B / C / D`) with Role, Element, Weapon, Rarity, and search filters.
- **Team Comp & Synergy Checker**: 4-slot party builder that evaluates active **Elemental Resonances**, **Triggerable Elemental Reactions** (including Swirl & Crystallize), role balance (`Main DPS`, `Sub DPS`, `Support`), and synergy tips.
- **Farming Schedule & Material Planner**: Daily Talent Book & Weapon Ascension domain rotation (`Mon–Sun`, highlighting UID Showcase characters) plus a per-character **Ascension & Talent Material Calculator** (`From → To` levels + Mora cost).
- **Game Database**: Searchable index of **Weapons**, **Artifact Sets**, and **Elemental Reactions & Resonances** with rarity backdrops, character avatar previews (`+N more`), and clickable **Best Used By** modals.
- **My Profile (UID Quick-Connect)**: Zero-password Genshin UID lookup via **Enka.Network**, displaying Adventure Rank, World Level, Spiral Abyss, Imaginarium Theater, Stygian Onslaught, Top 12 showcase characters ranked by Character Value, 7-stat strip, 5-piece artifact inspector with **Crit Value (CV) & Grade (`SS/S/A/B`)**, and **Share Build Card** (PNG + Discord Markdown).
- **Achievement Tracker**: Full catalog of 1,900+ achievements from `gi.yatta.moe` with category/status filtering, `localStorage` completion checklist synced per UID, and **How to Unlock** walkthroughs.
- **Build Advisor**: Evaluates either your actual equipped UID showcase build (*Checking Your Equipped Build*) or target build plan (*Recommended Build Plan*) across 5 dimensions with 3 advice styles (`Balanced`, `Min-Max`, `Short`).

---

## Tech Stack

| Layer | Technologies |
|---|---|
| **Backend** | Python 3.11+, FastAPI, Pydantic v2, `httpx` (shared keep-alive pool), GZip middleware, Async In-Memory TTL Cache (no database) |
| **Frontend** | React 18, TypeScript, Vite 5, Tailwind CSS, Framer Motion, Lucide React, `html-to-image` |
| **External APIs & AI** | Enka.Network API, `gi.yatta.moe`, `genshin-impact-helper-team/genshin-builds`, Google Gemini 3.8 Flash (`google-genai`) |

---

## Project Structure

```text
Genshin Prodigy/
├── backend/
│   ├── app/
│   │   ├── api/                 # FastAPI routers (routes.py, auth.py)
│   │   ├── core/                # Settings, shared httpx pool, and async TTL cache
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

- [High-Level Architecture](docs/HIGH_LEVEL_ARCHITECTURE.md) — System overview, data flows, caching, and latency strategy.
- [Backend Technical Guide](docs/BACKEND_TECH.md) — FastAPI services, HTTP pooling, upstream resolvers, and endpoints.
- [Frontend Technical Guide](docs/FRONTEND_TECH.md) — Component tree, state management, responsive design tokens, and caching.
- [Deployment Guide](docs/DEPLOYMENT.md) — Production deployment on **Vercel** (Frontend) + **Google Cloud Run** (Backend).
