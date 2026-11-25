# Frontend Technical Guide

## Design System

Irminix uses a calm, warm alabaster editorial palette defined in `tailwind.config.ts`:

- **Canvas**: `#F7F5F0` (Warm Alabaster Paper)
- **Surfaces**: `#FFFFFF` (Card Surface), `#EFECE5` (Subtle Recessed Surface)
- **Primary Accent**: `#246A56` (Botanical Sage-Teal), `#9C7A3C` (Muted Brass Gold)
- **Typography**: `Instrument Serif` (Display), `Plus Jakarta Sans` (Headings), `Inter` (Body), `JetBrains Mono` (Stats, UIDs, Badges)
- **Element Tokens**: Muted, accessible light-mode mineral tints in `src/lib/utils.ts` (`ELEMENT_STYLES`).

## Component Architecture

- `src/contexts/SessionContext.tsx` — Manages connected UID, `PlayerProfile`, and Guest mode in `localStorage` (`irminix`/`irminsul` keys).
- `src/services/api.ts` — Typed `fetch` client with 2-minute in-memory TTL cache and structured error extraction.
- `src/components/common/Navbar.tsx` — Responsive 2-tier navigation (centered pill bar on desktop with Framer Motion `layoutId`, 3-column mobile bar on `< md` screens).
- `src/components/characters/CharacterCodexView.tsx` & `CharacterCard.tsx` — Search, horizontal-scrollable element/weapon filters, rarity toggle, and isolated hover-safe character cards.
- `src/components/build/CharacterBuildDetailView.tsx` — Elemental hero banner, 3-card quick summary strip, expandable weapon passives, artifact set bonuses, combat kit & constellations tabs, and PNG card export (`html-to-image`).
- `src/components/showcase/UidShowcaseView.tsx` — Player profile with endgame badges (Abyss, Imaginarium Theater, Stygian Onslaught), Top 12 showcase ranked by Character Value, **How Ranking Works** formula toggle, **Share Build Card** modal (`ShareShowcaseCardModal.tsx`), and **Achievement Tracker** (`AchievementTrackerPanel.tsx`).
- `src/components/advisor/AiBuildAdvisorView.tsx` — Quick-pick showcase characters, plain-language mode indicator (*Checking Your Equipped Build* vs *Recommended Build Plan*), advice styles (`Balanced`, `Min-Max`, `Short`), and animated 5-dimension bars.
