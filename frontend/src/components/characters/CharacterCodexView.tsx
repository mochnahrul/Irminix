import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { CharacterCard } from "@/components/common/CharacterCard";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { cn, getElementStyle } from "@/lib/utils";
import type { CharacterSummary } from "@/types/genshin";

const VISIONS = ["All", "Pyro", "Hydro", "Electro", "Cryo", "Anemo", "Geo", "Dendro"];
const WEAPONS = ["All", "Sword", "Claymore", "Polearm", "Bow", "Catalyst"];

interface CharacterCodexViewProps {
  characters: CharacterSummary[];
  loading: boolean;
  onSelectCharacter: (id: string) => void;
}

export function CharacterCodexView({
  characters,
  loading,
  onSelectCharacter,
}: CharacterCodexViewProps) {
  const [search, setSearch] = useState("");
  const [vision, setVision] = useState("All");
  const [weapon, setWeapon] = useState("All");
  const [rarity, setRarity] = useState<"all" | 5 | 4>("all");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return characters.filter((c) => {
      if (vision !== "All" && c.vision.toLowerCase() !== vision.toLowerCase()) return false;
      if (weapon !== "All" && c.weapon.toLowerCase() !== weapon.toLowerCase()) return false;
      if (rarity !== "all" && c.rarity !== rarity) return false;
      if (q && !c.name.toLowerCase().includes(q) && !c.region.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [characters, search, vision, weapon, rarity]);

  const hasActiveFilters =
    vision !== "All" || weapon !== "All" || rarity !== "all" || search !== "";

  return (
    <div className="space-y-6">
      {/* Editorial Hero & Search */}
      <div className="rounded-3xl border border-border bg-surface p-5 shadow-card sm:p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-[11px] uppercase tracking-widest text-irminsul">
                Character Builds
              </span>
              <span className="rounded-full border border-border bg-canvas px-2.5 py-0.5 font-mono text-[11px] text-ink-secondary">
                {filtered.length} Characters
              </span>
            </div>
            <h1 className="mt-1.5 font-serif text-3xl tracking-tight text-ink-primary sm:text-4xl">
              Find the Best Build for Any Character
            </h1>
            <p className="mt-1 max-w-xl text-sm text-ink-secondary">
              Recommended weapons, artifact sets, stats, and skill priorities in one clean view.
            </p>
          </div>

          <div className="relative w-full lg:w-80">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-dim" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search character or region..."
              className="w-full rounded-xl border border-border bg-canvas py-2.5 pl-10 pr-9 text-sm text-ink-primary transition-colors placeholder:text-ink-dim focus:border-irminsul focus:outline-none"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-dim hover:text-ink-primary"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Filter Rows */}
        <div className="mt-5 space-y-3 border-t border-border-subtle pt-4">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            <span className="mr-1 shrink-0 font-mono text-[10px] uppercase tracking-wider text-ink-dim">
              Element
            </span>
            {VISIONS.map((v) => {
              const active = vision === v;
              const el = v !== "All" ? getElementStyle(v) : null;
              return (
                <button
                  key={v}
                  type="button"
                  onClick={() => setVision(v)}
                  className={cn(
                    "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-all",
                    active
                      ? "border-irminsul bg-irminsul text-white shadow-sm"
                      : "border-transparent bg-surface-subtle text-ink-secondary hover:border-border hover:text-ink-primary"
                  )}
                >
                  {el && (
                    <span
                      className={cn("h-1.5 w-1.5 rounded-full", active ? "bg-white" : el.dot)}
                    />
                  )}
                  {v}
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              <span className="mr-1 shrink-0 font-mono text-[10px] uppercase tracking-wider text-ink-dim">
                Weapon
              </span>
              {WEAPONS.map((w) => (
                <button
                  key={w}
                  type="button"
                  onClick={() => setWeapon(w)}
                  className={cn(
                    "shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors",
                    weapon === w
                      ? "bg-ink-primary text-white"
                      : "bg-surface-subtle text-ink-secondary hover:text-ink-primary"
                  )}
                >
                  {w}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 rounded-full bg-surface-subtle p-0.5">
                {(["all", 5, 4] as const).map((r) => (
                  <button
                    key={String(r)}
                    type="button"
                    onClick={() => setRarity(r)}
                    className={cn(
                      "rounded-full px-2.5 py-1 font-mono text-xs transition-colors",
                      rarity === r
                        ? "bg-surface text-irminsul-gold shadow-sm"
                        : "text-ink-secondary hover:text-ink-primary"
                    )}
                  >
                    {r === "all" ? "All ★" : `${r}★`}
                  </button>
                ))}
              </div>

              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    setVision("All");
                    setWeapon("All");
                    setRarity("all");
                  }}
                  className="text-xs font-medium text-irminsul hover:underline"
                >
                  Reset
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <LoadingSpinner label="Loading character builds..." />
      ) : filtered.length === 0 ? (
        <div className="rounded-3xl border border-border bg-surface py-16 text-center shadow-card">
          <p className="font-heading text-base font-medium text-ink-primary">
            No characters match these filters
          </p>
          <p className="mt-1 text-sm text-ink-secondary">
            Try clearing your search or switching element filters.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5">
          {filtered.map((char) => (
            <CharacterCard
              key={char.id}
              character={char}
              onSelect={onSelectCharacter}
            />
          ))}
        </div>
      )}
    </div>
  );
}
