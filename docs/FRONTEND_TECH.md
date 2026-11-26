# Frontend Technical Guide

## Design System

Irminix uses a calm, warm alabaster editorial palette defined in `tailwind.config.ts`:

- **Canvas**: `#F7F5F0` (Warm Alabaster Paper)
- **Surfaces**: `#FFFFFF` (Card Surface), `#EFECE5` (Subtle Recessed Surface)
- **Primary Accent**: `#246A56` (Botanical Sage-Teal), `#9C7A3C` (Muted Brass Gold)
- **Typography**: `Instrument Serif` (Display), `Plus Jakarta Sans` (Headings), `Inter` (Body), `JetBrains Mono` (Stats, UIDs, Badges)
- **Element & Rarity Tokens**: Muted mineral element tints (`ELEMENT_STYLES`) plus unified rarity helpers (`getRarityStyle`, `getRarityBackdrop`, `getRarityAccent`) in `src/lib/utils.ts`.

## Component Architecture

- `src/contexts/SessionContext.tsx` — Manages connected UID, `PlayerProfile`, and Guest mode in `localStorage` (`irminix`/`irminsul` keys).
- `src/services/api.ts` — Typed `fetch` client with 2-minute in-memory TTL cache and structured error extraction.
- `src/components/common/Navbar.tsx` — Responsive 2-tier navigation (centered 7-tab pill bar on desktop with Framer Motion `layoutId`, scrollable mobile tab strip on `< md` screens).
- `src/components/characters/CharacterCodexView.tsx` & `CharacterCard.tsx` — Search, horizontal-scrollable element/weapon filters, rarity toggle, and isolated hover-safe character cards with rarity top accent bars.
- `src/components/build/CharacterBuildDetailView.tsx` — Elemental hero banner, patch version badges, 3-card quick summary strip, all recommended weapons with rarity backdrops & expandable passives, artifact set bonuses, combat kit & constellations tabs, and PNG card export (`html-to-image`).
- `src/components/tierlist/TierListView.tsx` — Version 7.2 tier rows (`S`–`D`) with Role, Element, Weapon, Rarity, and search filters plus isolated hover-safe portrait tiles.
- `src/components/teams/TeamBuilderView.tsx` — 4-slot party stage, searchable roster picker, active Elemental Resonances, triggerable reactions, and role balance tips.
- `src/components/planner/FarmingPlannerView.tsx` — Daily Talent & Weapon domain schedule (`Mon–Sun`) and Ascension/Talent Material Calculator (`From → To` ranges + Mora cost) with error states and lazy-loaded icons.
- `src/components/database/DatabaseView.tsx` — Searchable Weapons, Artifacts, and Elements tabs with rarity backdrops, `CharacterAvatarSpill` (`+N more`), **Best Used By** modals, Retry error handling, and body scroll locking (`overscroll-contain`).
- `src/components/showcase/UidShowcaseView.tsx` — Player profile with endgame badges (Abyss, Imaginarium Theater, Stygian Onslaught), Top 12 showcase ranked by Character Value, **How Ranking Works** formula toggle, per-piece **Artifact Crit Value (CV) & Grade (`SS/S/A/B`)**, **Share Build Card** scroll-locked modal (`ShareShowcaseCardModal.tsx`), and **Achievement Tracker** (`AchievementTrackerPanel.tsx`).
- `src/components/advisor/AiBuildAdvisorView.tsx` — Editorial hero card, quick-pick showcase characters, plain-language mode indicator (*Checking Your Equipped Build* vs *Recommended Build Plan*), advice styles (`Balanced`, `Min-Max`, `Short`), and animated 5-dimension bars.
