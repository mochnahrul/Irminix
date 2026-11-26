# Frontend Technical Guide

## Design System

Irminix uses a calm, warm alabaster editorial palette defined in `tailwind.config.ts`:

- **Canvas**: `#F7F5F0` (Warm Alabaster Paper)
- **Surfaces**: `#FFFFFF` (Card Surface), `#EFECE5` (Subtle Recessed Surface)
- **Primary Accent**: `#246A56` (Botanical Sage-Teal), `#9C7A3C` (Muted Brass Gold)
- **Typography**: `Instrument Serif` (Display), `Plus Jakarta Sans` (Headings), `Inter` (Body), `JetBrains Mono` (Stats, UIDs, Badges)
- **Element & Rarity Tokens**: `getElementStyle` (backed by internal `ELEMENT_STYLES`) plus unified rarity helpers (`getRarityStyle`, `getRarityBackdrop`, `getRarityAccent`) in `src/lib/utils.ts`.

## Component Architecture

- `src/contexts/SessionContext.tsx` — Manages connected UID, `PlayerProfile`, and Guest mode in `localStorage` (`irminsul:uid` / `irminsul:guest`). Preserves saved UID across transient network/500 errors and only clears invalid/not-found UIDs.
- `src/services/api.ts` — Typed `fetch` client with 2-minute in-memory TTL cache and structured error extraction.
- `src/components/layout/AppShell.tsx` — Root shell (`overflow-x-clip` so sticky navigation works reliably across browsers).
- `src/components/common/Navbar.tsx` — Responsive 2-tier navigation (centered 7-tab pill bar on desktop with Framer Motion `layoutId`, scrollable mobile tab strip on `< md` screens).
- `src/components/ui/RefinementSelector.tsx` — Shared `R1`–`R5` passive refinement selector used in both `WeaponHoverPopover` and `DatabaseView`.
- `src/components/characters/CharacterCodexView.tsx` & `CharacterCard.tsx` — Search, horizontal-scrollable element/weapon filters, rarity toggle, and isolated hover-safe character cards with rarity top accent bars.
- `src/components/build/CharacterBuildDetailView.tsx` & `WeaponHoverPopover.tsx` — Elemental hero banner, patch version badges, **Best** role indicator, 3-card quick summary strip, **Material Calculator** quick shortcut button (opens `FarmingPlannerView` directly on the Material Calculator tab for that character), all recommended weapons with Lv.1/Lv.90 Base ATK & Substats + R1–R5 hover popovers, artifact set bonuses, talent priority with skill/burst icons, combat kit & constellations tabs, and PNG card export (`html-to-image`).
- `src/components/tierlist/TierListView.tsx` — Version 7.2 tier rows (`S`–`D`) with Role, Element, Weapon, Rarity, and search filters plus isolated hover-safe portrait tiles.
- `src/components/teams/TeamBuilderView.tsx` — 4-slot party stage, searchable roster picker, active Elemental Resonances, triggerable reactions, and role balance tips.
- `src/components/planner/FarmingPlannerView.tsx` — Daily Talent & Weapon domain schedule (`Mon–Sun`) and Ascension/Talent Material Calculator (`From → To` ranges + Mora cost) supporting deep-linking via `initialSubTab` & `initialCharacterId`.
- `src/components/database/DatabaseView.tsx` — Searchable Weapons (with Lv.1/90 stats & R1–R5 passives), Artifacts, and Elements tabs (`Zap` icon + description for Elemental Reactions; `Users` icon + description + `RESONANCE_ELEMENT_MAP` element/requirement badges for Elemental Resonances), `CharacterAvatarSpill` (`+N more`), **Best Used By** modals (`Escape` + `role="dialog"` + body scroll lock), and race-guarded weapon detail loading.
  - *Manual Maintenance*: Update `RESONANCE_ELEMENT_MAP` in `DatabaseView.tsx` if new Elemental Resonances are added in future patches.
- `src/components/showcase/UidShowcaseView.tsx` — Player profile with endgame badges (Abyss, Imaginarium Theater, Stygian Onslaught), Top 12 showcase ranked by Character Value, **How Ranking Works** formula toggle, per-piece **Artifact Crit Value (CV) & Grade (`SS/S/A/B`)**, **Share Build Card** scroll-locked modal (`ShareShowcaseCardModal.tsx` with `Escape` close & clipboard fallback handling), and **Achievement Tracker** (`AchievementTrackerPanel.tsx`).
- `src/components/advisor/AiBuildAdvisorView.tsx` — Editorial hero card, quick-pick showcase characters, plain-language mode indicator (*Checking Your Equipped Build* vs *Recommended Build Plan*), advice styles (`Balanced`, `Min-Max`, `Short`), race-guarded analysis requests, and animated 5-dimension bars.
