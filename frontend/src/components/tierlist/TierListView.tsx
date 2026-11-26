import { useEffect, useMemo, useState } from "react";
import { Award, Search, Star, X } from "lucide-react";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { cn, getElementStyle, getRarityAccent, getRarityStyle } from "@/lib/utils";
import { fetchTierList } from "@/services/api";
import type { TierListResponse } from "@/types/genshin";

const TIERS = ["S", "A", "B", "C", "D"] as const;
const ROLE_GROUPS = ["All", "Main DPS", "Sub DPS", "Support"] as const;
const VISIONS = ["All", "Pyro", "Hydro", "Electro", "Cryo", "Anemo", "Geo", "Dendro"] as const;
const WEAPONS = ["All", "Sword", "Claymore", "Polearm", "Bow", "Catalyst"] as const;

const TIER_STYLES: Record<string, { labelBg: string; border: string }> = {
  S: {
    labelBg: "bg-[#C25338] text-white",
    border: "border-[#E8C5BC]",
  },
  A: {
    labelBg: "bg-[#C78636] text-white",
    border: "border-[#E3D3AE]",
  },
  B: {
    labelBg: "bg-[#9C7A3C] text-white",
    border: "border-[#E3D3AE]",
  },
  C: {
    labelBg: "bg-[#3A7CA5] text-white",
    border: "border-[#B9D3E6]",
  },
  D: {
    labelBg: "bg-[#5B655F] text-white",
    border: "border-border",
  },
};

interface TierListViewProps {
  onSelectCharacter: (id: string) => void;
}

export function TierListView({ onSelectCharacter }: TierListViewProps) {
  const [data, setData] = useState<TierListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [roleFilter, setRoleFilter] = useState<(typeof ROLE_GROUPS)[number]>("All");
  const [visionFilter, setVisionFilter] = useState<(typeof VISIONS)[number]>("All");
  const [weaponFilter, setWeaponFilter] = useState<(typeof WEAPONS)[number]>("All");
  const [rarityFilter, setRarityFilter] = useState<"all" | 5 | 4>("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchTierList()
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load tier list.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredByTier = useMemo(() => {
    const grouped: Record<string, TierListResponse["entries"]> = {
      S: [],
      A: [],
      B: [],
      C: [],
      D: [],
    };
    if (!data) return grouped;
    const q = search.trim().toLowerCase();
    for (const entry of data.entries) {
      if (roleFilter !== "All" && entry.roleGroup !== roleFilter) continue;
      if (
        visionFilter !== "All" &&
        entry.character.vision.toLowerCase() !== visionFilter.toLowerCase()
      ) {
        continue;
      }
      if (
        weaponFilter !== "All" &&
        entry.character.weapon.toLowerCase() !== weaponFilter.toLowerCase()
      ) {
        continue;
      }
      if (rarityFilter !== "all" && entry.character.rarity !== rarityFilter) continue;
      if (q && !entry.character.name.toLowerCase().includes(q)) continue;
      if (grouped[entry.tier]) grouped[entry.tier].push(entry);
    }
    return grouped;
  }, [data, roleFilter, visionFilter, weaponFilter, rarityFilter, search]);

  if (loading) return <LoadingSpinner label="Loading Version 7.2 tier list..." />;
  if (error || !data) {
    return (
      <div className="rounded-2xl border border-[#E8C5BC] bg-[#FBF0ED] p-6 text-sm text-[#9A3B26]">
        {error || "Unable to load tier list."}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header & Filters */}
      <div className="relative overflow-hidden rounded-3xl border border-border bg-surface p-5 shadow-card sm:p-7">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-12 -top-12 h-56 w-56 rounded-full bg-[radial-gradient(circle,rgba(36,106,86,0.08),transparent_70%)]"
        />
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-widest text-irminsul">
                <Award className="h-3.5 w-3.5" />
                Best Characters
              </span>
              <span className="rounded-full border border-[#B8D8CE] bg-irminsul-soft px-2.5 py-0.5 font-mono text-[11px] font-medium text-irminsul">
                {data.patchLabel}
              </span>
            </div>
            <h1 className="mt-1.5 font-serif text-3xl tracking-tight text-ink-primary sm:text-4xl">
              Genshin Impact Tier List
            </h1>
            <p className="mt-1 max-w-xl text-sm text-ink-secondary">
              Based on Spiral Abyss &amp; Stygian Onslaught usage rates. Click any character to view their build guide.
            </p>
          </div>

          <div className="relative w-full lg:w-72">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-dim" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search character..."
              className="w-full rounded-xl border border-border bg-canvas py-2.5 pl-10 pr-9 text-sm text-ink-primary placeholder:text-ink-dim focus:border-irminsul focus:outline-none"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-dim hover:text-ink-primary"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        <div className="mt-5 space-y-3 border-t border-border-subtle pt-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              <span className="mr-1 shrink-0 font-mono text-[10px] uppercase tracking-wider text-ink-dim">
                Role
              </span>
              {ROLE_GROUPS.map((rg) => (
                <button
                  key={rg}
                  type="button"
                  onClick={() => setRoleFilter(rg)}
                  className={cn(
                    "shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors",
                    roleFilter === rg
                      ? "bg-irminsul text-white shadow-sm"
                      : "bg-surface-subtle text-ink-secondary hover:text-ink-primary"
                  )}
                >
                  {rg}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1.5">
              <div className="flex items-center gap-1 rounded-full bg-surface-subtle p-0.5">
                {(["all", 5, 4] as const).map((r) => (
                  <button
                    key={String(r)}
                    type="button"
                    onClick={() => setRarityFilter(r)}
                    className={cn(
                      "rounded-full px-2.5 py-1 font-mono text-xs transition-colors",
                      rarityFilter === r
                        ? "bg-surface text-irminsul-gold shadow-sm"
                        : "text-ink-secondary hover:text-ink-primary"
                    )}
                  >
                    {r === "all" ? "All ★" : `${r}★`}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              <span className="mr-1 shrink-0 font-mono text-[10px] uppercase tracking-wider text-ink-dim">
                Element
              </span>
              {VISIONS.map((v) => {
                const active = visionFilter === v;
                const el = v !== "All" ? getElementStyle(v) : null;
                return (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setVisionFilter(v)}
                    className={cn(
                      "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                      active
                        ? "border-ink-primary bg-ink-primary text-white"
                        : "border-transparent bg-surface-subtle text-ink-secondary hover:text-ink-primary"
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

            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              <span className="mr-1 shrink-0 font-mono text-[10px] uppercase tracking-wider text-ink-dim">
                Weapon
              </span>
              {WEAPONS.map((w) => (
                <button
                  key={w}
                  type="button"
                  onClick={() => setWeaponFilter(w)}
                  className={cn(
                    "shrink-0 rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
                    weaponFilter === w
                      ? "bg-ink-primary text-white"
                      : "bg-surface-subtle text-ink-secondary hover:text-ink-primary"
                  )}
                >
                  {w}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Tier Rows (Genshin.gg style left-label + character grid) */}
      <div className="space-y-3">
        {TIERS.map((tier) => {
          const items = filteredByTier[tier] || [];
          const style = TIER_STYLES[tier];
          if (items.length === 0) return null;

          return (
            <section
              key={tier}
              className={cn(
                "flex flex-col overflow-hidden rounded-2xl border bg-surface shadow-card sm:flex-row",
                style.border
              )}
            >
              {/* Left Tier Badge Column */}
              <div
                className={cn(
                  "flex shrink-0 items-center justify-between px-4 py-2.5 sm:w-20 sm:flex-col sm:justify-center sm:py-4",
                  style.labelBg
                )}
              >
                <span className="font-heading text-2xl font-bold tracking-tight">
                  {tier}
                </span>
                <span className="font-mono text-[10px] opacity-85">
                  {items.length}
                </span>
              </div>

              {/* Character Grid */}
              <div className="grid flex-1 grid-cols-3 gap-2.5 p-3 sm:grid-cols-4 sm:p-4 md:grid-cols-6 lg:grid-cols-8">
                {items.map(({ character, roleGroup }) => {
                  const el = getElementStyle(character.vision);
                  return (
                    <button
                      key={character.id}
                      type="button"
                      onClick={() => onSelectCharacter(character.id)}
                      className="group relative flex min-w-0 flex-col overflow-hidden rounded-xl border border-border-subtle bg-surface text-center shadow-sm transition-all duration-200 hover:border-border-focus hover:shadow-card"
                    >
                      <div className={cn("h-1 w-full shrink-0", getRarityAccent(character.rarity))} />
                      <div
                        className={cn(
                          "relative isolate flex aspect-square w-full items-end justify-center overflow-hidden bg-gradient-to-b pt-2",
                          el.cardTint
                        )}
                      >
                        <img
                          src={character.image}
                          alt={character.name}
                          loading="lazy"
                          className="h-[92%] w-auto object-contain object-bottom transition-transform duration-300 ease-out will-change-transform group-hover:scale-[1.03]"
                        />
                        <span
                          className={cn(
                            "absolute left-1.5 top-1.5 z-10 h-2 w-2 rounded-full ring-1 ring-white",
                            el.dot
                          )}
                        />
                        <span
                          className={cn(
                            "absolute right-1 top-1 z-10 inline-flex items-center rounded border px-1 py-0.5 font-mono text-[9px] font-semibold leading-none shadow-sm",
                            getRarityStyle(character.rarity)
                          )}
                        >
                          {character.rarity}
                          <Star className="ml-0.5 h-2 w-2 fill-current" />
                        </span>
                        <div
                          aria-hidden="true"
                          className="pointer-events-none absolute -inset-x-px -bottom-px z-10 h-4 bg-gradient-to-t from-surface to-transparent"
                        />
                      </div>

                      <div className="px-1.5 pb-2 pt-1">
                        <p className="w-full truncate text-[11px] font-semibold text-ink-primary transition-colors group-hover:text-irminsul">
                          {character.name}
                        </p>
                        <p className="mt-0.5 w-full truncate font-mono text-[9px] text-ink-dim">
                          {roleGroup}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
