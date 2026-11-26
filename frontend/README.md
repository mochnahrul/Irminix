# Irminix Frontend

React 18 + TypeScript + Vite 5 frontend styled with a calm, warm alabaster editorial palette (`#F7F5F0` canvas, `#FFFFFF` paper surface, `#246A56` botanical sage-teal accent).

## Scripts

- `npm run dev` — Start Vite development server
- `npm run build` — Run `tsc -b` type-checking and build production bundle into `dist/`
- `npm run preview` — Preview production build locally

## Environment

Copy `.env.example` to `.env`:
```env
VITE_API_URL=http://127.0.0.1:8000
```

## Notes

- All API types live in `src/types/genshin.ts` and requests go through `src/services/api.ts` (2-minute in-memory TTL cache).
- Connected UID session & Achievement Tracker completion checklists are persisted in `localStorage`.
- See [Frontend Technical Guide](../docs/FRONTEND_TECH.md) for component architecture and manual UI mappings (`RESONANCE_ELEMENT_MAP`).
