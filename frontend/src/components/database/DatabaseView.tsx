import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowUpRight, Flame, Layers, Search, Swords, Users, X, Zap } from "lucide-react";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { RarityBadge } from "@/components/ui/RarityBadge";
import { RefinementSelector } from "@/components/ui/RefinementSelector";
import { Badge } from "@/components/ui/badge";
import { cn, getElementStyle, getRarityAccent, getRarityBackdrop } from "@/lib/utils";
import {
  fetchDatabaseArtifacts,
  fetchDatabaseElements,
  fetchDatabaseWeaponDetail,
  fetchDatabaseWeapons,
} from "@/services/api";
import type {
  ArtifactSetItem,
  ElementsDatabaseResponse,
  GearUserRecommendation,
  WeaponDetailResponse,
  WeaponItem,
} from "@/types/genshin";

const WEAPON_TYPES = ["All", "Sword", "Claymore", "Polearm", "Bow", "Catalyst"] as const;

const RESONANCE_ELEMENT_MAP: Record<string, { element: string; requirement: string }> = {
  "fervent flames": { element: "Pyro", requirement: "2× Pyro in Party" },
  "soothing water": { element: "Hydro", requirement: "2× Hydro in Party" },
  "impetuous winds": { element: "Anemo", requirement: "2× Anemo in Party" },
  "high voltage": { element: "Electro", requirement: "2× Electro in Party" },
  "sprawling greenery": { element: "Dendro", requirement: "2× Dendro in Party" },
  "shattering ice": { element: "Cryo", requirement: "2× Cryo in Party" },
  "enduring rock": { element: "Geo", requirement: "2× Geo in Party" },
  "protective canopy": { element: "All", requirement: "4 Unique Elements" },
};

interface DatabaseViewProps {
  onSelectCharacter?: (id: string) => void;
}

function CharacterAvatarSpill({
  users,
  maxVisible = 3,
}: {
  users?: GearUserRecommendation[];
  maxVisible?: number;
}) {
  if (!users || users.length === 0) return null;
  const visible = users.slice(0, maxVisible);
  const remaining = users.length - visible.length;

  return (
    <div className="flex items-center gap-1.5">
      <div className="flex -space-x-1.5">
        {visible.map((u) => (
          <img
            key={u.characterId}
            src={u.image}
            alt={u.name}
            title={`${u.name} (#${u.rank})`}
            loading="lazy"
            className="h-5 w-5 rounded-full border border-surface bg-surface-subtle object-cover object-top shadow-sm"
          />
        ))}
      </div>
      {remaining > 0 ? (
        <span className="font-mono text-[10px] font-medium text-irminsul">
          +{remaining} more
        </span>
      ) : (
        <span className="font-mono text-[10px] text-ink-dim">
          {users.length} {users.length === 1 ? "char" : "chars"}
        </span>
      )}
    </div>
  );
}

function RecommendedUsersSection({
  users,
  onPick,
}: {
  users?: GearUserRecommendation[];
  onPick: (characterId: string) => void;
}) {
  if (!users || users.length === 0) {
    return (
      <div className="rounded-xl border border-border-subtle bg-canvas/60 px-3.5 py-2.5 text-xs text-ink-dim">
        No curated character build matches this item yet.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="font-mono text-[10px] font-semibold uppercase tracking-wider text-irminsul">
          Best Used By ({users.length})
        </p>
        <span className="text-[10px] text-ink-dim">Click character to view build</span>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {users.map((u) => {
          const el = getElementStyle(u.vision);
          return (
            <button
              key={u.characterId}
              type="button"
              onClick={() => onPick(u.characterId)}
              className="group flex items-center gap-2.5 rounded-xl border border-border-subtle bg-canvas/70 p-2 text-left transition-colors hover:border-irminsul hover:bg-surface"
            >
              <div
                className={cn(
                  "relative h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-border-subtle bg-gradient-to-b",
                  el.cardTint
                )}
              >
                {u.image && (
                  <img
                    src={u.image}
                    alt={u.name}
                    loading="lazy"
                    className="h-full w-full object-cover object-top"
                  />
                )}
                <span
                  className={cn(
                    "absolute left-0.5 top-0.5 h-1.5 w-1.5 rounded-full ring-1 ring-white",
                    el.dot
                  )}
                />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1.5">
                  <span className="truncate text-xs font-semibold text-ink-primary group-hover:text-irminsul">
                    {u.name}
                  </span>
                  <span className="shrink-0 rounded bg-irminsul-soft px-1.5 py-0.5 font-mono text-[9px] font-semibold text-irminsul">
                    #{u.rank}
                  </span>
                </div>
                <p className="truncate font-mono text-[10px] text-ink-dim">
                  {u.role || u.vision}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function DatabaseView({ onSelectCharacter }: DatabaseViewProps) {
  const [subTab, setSubTab] = useState<"weapons" | "artifacts" | "elements">("weapons");
  const [search, setSearch] = useState("");
  const [weaponType, setWeaponType] = useState<(typeof WEAPON_TYPES)[number]>("All");
  const [rarityFilter, setRarityFilter] = useState<"all" | 5 | 4 | 3>("all");

  const [weapons, setWeapons] = useState<WeaponItem[]>([]);
  const [artifacts, setArtifacts] = useState<ArtifactSetItem[]>([]);
  const [elementsData, setElementsData] = useState<ElementsDatabaseResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedWeapon, setSelectedWeapon] = useState<WeaponDetailResponse | null>(null);
  const [selectedArtifact, setSelectedArtifact] = useState<ArtifactSetItem | null>(null);
  const [loadingWeaponDetail, setLoadingWeaponDetail] = useState(false);
  const [weaponDetailError, setWeaponDetailError] = useState<string | null>(null);
  const [weaponRefineIdx, setWeaponRefineIdx] = useState(0);
  const [retryTick, setRetryTick] = useState(0);
  const weaponReqRef = useRef(0);

  useEffect(() => {
    if (!selectedWeapon && !selectedArtifact) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSelectedWeapon(null);
        setSelectedArtifact(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [selectedWeapon, selectedArtifact]);

  const loadCurrentTab = () => setRetryTick((t) => t + 1);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    if (subTab === "weapons" && weapons.length === 0) {
      fetchDatabaseWeapons()
        .then((res) => {
          if (!cancelled) setWeapons(res);
        })
        .catch((err) => {
          if (!cancelled) {
            setError(err instanceof Error ? err.message : "Failed to load weapons.");
          }
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    } else if (subTab === "artifacts" && artifacts.length === 0) {
      fetchDatabaseArtifacts()
        .then((res) => {
          if (!cancelled) setArtifacts(res);
        })
        .catch((err) => {
          if (!cancelled) {
            setError(err instanceof Error ? err.message : "Failed to load artifacts.");
          }
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    } else if (subTab === "elements" && !elementsData) {
      fetchDatabaseElements()
        .then((res) => {
          if (!cancelled) setElementsData(res);
        })
        .catch((err) => {
          if (!cancelled) {
            setError(err instanceof Error ? err.message : "Failed to load elements.");
          }
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    } else {
      setLoading(false);
    }
    return () => {
      cancelled = true;
    };
  }, [subTab, weapons.length, artifacts.length, elementsData, retryTick]);

  const handleOpenWeapon = async (w: WeaponItem) => {
    const reqId = ++weaponReqRef.current;
    setLoadingWeaponDetail(true);
    setWeaponDetailError(null);
    setWeaponRefineIdx(0);
    setSelectedWeapon({ ...w, description: "" });
    try {
      const detail = await fetchDatabaseWeaponDetail(w.id);
      if (weaponReqRef.current === reqId) {
        setSelectedWeapon(detail);
      }
    } catch (err) {
      if (weaponReqRef.current === reqId) {
        setWeaponDetailError(err instanceof Error ? err.message : "Failed to load weapon detail.");
      }
    } finally {
      if (weaponReqRef.current === reqId) {
        setLoadingWeaponDetail(false);
      }
    }
  };

  const filteredWeapons = useMemo(() => {
    const q = search.trim().toLowerCase();
    return weapons.filter((w) => {
      if (weaponType !== "All" && w.weaponType !== weaponType) return false;
      if (rarityFilter !== "all" && w.rarity !== rarityFilter) return false;
      if (q && !w.name.toLowerCase().includes(q) && !(w.subStat || "").toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [weapons, weaponType, rarityFilter, search]);

  const filteredArtifacts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return artifacts.filter((a) => {
      if (rarityFilter !== "all" && a.maxRarity !== rarityFilter) return false;
      if (
        q &&
        !a.name.toLowerCase().includes(q) &&
        !a.bonuses.some((b) => b.toLowerCase().includes(q))
      ) {
        return false;
      }
      return true;
    });
  }, [artifacts, rarityFilter, search]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="relative overflow-hidden rounded-3xl border border-border bg-surface p-5 shadow-card sm:p-7">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-12 -top-12 h-56 w-56 rounded-full bg-[radial-gradient(circle,rgba(36,106,86,0.08),transparent_70%)]"
        />
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-widest text-irminsul">
              Teyvat Encyclopedia
            </p>
            <h1 className="mt-1.5 font-serif text-3xl tracking-tight text-ink-primary sm:text-4xl">
              Game Database
            </h1>
            <p className="mt-1 max-w-xl text-sm text-ink-secondary">
              Browse all weapons, artifact set bonuses, elemental reactions, and party resonances.
            </p>
          </div>

          {subTab !== "elements" && (
            <div className="relative w-full lg:w-72">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-dim" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={
                  subTab === "weapons" ? "Search weapon or substat..." : "Search set or bonus..."
                }
                className="w-full rounded-xl border border-border bg-canvas py-2.5 pl-10 pr-9 text-sm text-ink-primary shadow-sm transition-all placeholder:text-ink-dim focus:border-irminsul focus:bg-surface focus:outline-none focus:ring-2 focus:ring-irminsul/15"
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
          )}
        </div>

        {/* Sub-Tabs */}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle pt-4">
          <div className="flex flex-wrap items-center gap-1 rounded-xl bg-surface-subtle p-1">
            {(
              [
                { id: "weapons", label: "Weapons", icon: Swords },
                { id: "artifacts", label: "Artifacts", icon: Layers },
                { id: "elements", label: "Elements & Reactions", icon: Flame },
              ] as const
            ).map((t) => {
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    setSubTab(t.id);
                    setSearch("");
                    setRarityFilter("all");
                  }}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                    subTab === t.id
                      ? "bg-surface text-irminsul shadow-sm"
                      : "text-ink-secondary hover:text-ink-primary"
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {t.label}
                </button>
              );
            })}
          </div>

          {subTab !== "elements" && (
            <div className="flex flex-wrap items-center gap-2">
              {subTab === "weapons" && (
                <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
                  {WEAPON_TYPES.map((wt) => (
                    <button
                      key={wt}
                      type="button"
                      onClick={() => setWeaponType(wt)}
                      className={cn(
                        "shrink-0 rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
                        weaponType === wt
                          ? "bg-ink-primary text-white"
                          : "bg-surface-subtle text-ink-secondary hover:text-ink-primary"
                      )}
                    >
                      {wt}
                    </button>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-1 rounded-full bg-surface-subtle p-0.5">
                {(["all", 5, 4, 3] as const).map((r) => (
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
          )}
        </div>
      </div>

      {loading ? (
        <LoadingSpinner label="Loading Teyvat database..." />
      ) : error ? (
        <div className="flex flex-col items-start justify-between gap-3 rounded-2xl border border-[#E8C5BC] bg-[#FBF0ED] p-5 text-xs text-[#9A3B26] sm:flex-row sm:items-center">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => void loadCurrentTab()}
            className="shrink-0 rounded-xl border border-[#E8C5BC] bg-surface px-3 py-1.5 font-medium text-[#9A3B26] transition-colors hover:bg-[#F7E5E0]"
          >
            Retry
          </button>
        </div>
      ) : subTab === "weapons" ? (
        <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {filteredWeapons.map((w) => (
            <button
              key={w.id}
              type="button"
              onClick={() => handleOpenWeapon(w)}
              className="group relative flex h-full min-w-0 flex-col overflow-hidden rounded-2xl border border-border bg-surface text-left shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:border-border-focus hover:shadow-hover"
            >
              {/* Rarity top accent bar */}
              <div className={cn("h-1 w-full shrink-0", getRarityAccent(w.rarity))} />

              {/* Full-bleed Rarity Weapon Stage */}
              <div
                className={cn(
                  "relative isolate flex aspect-[4/3] w-full items-center justify-center overflow-hidden px-4 pb-3 pt-9",
                  getRarityBackdrop(w.rarity)
                )}
              >
                {/* Floating Metadata Row */}
                <div className="pointer-events-none absolute inset-x-2.5 top-2.5 z-10 flex items-center justify-between gap-1.5">
                  <span className="inline-flex items-center rounded-full border border-border-subtle bg-surface/95 px-2 py-0.5 text-[10px] font-medium text-ink-secondary shadow-sm backdrop-blur-sm">
                    {w.weaponType}
                  </span>
                  <RarityBadge rarity={w.rarity} className="shadow-sm" />
                </div>

                {w.image && (
                  <img
                    src={w.image}
                    alt={w.name}
                    loading="lazy"
                    className="h-full max-h-[88px] w-auto object-contain drop-shadow-[0_6px_12px_rgba(0,0,0,0.16)] transition-transform duration-300 ease-out will-change-transform group-hover:scale-110"
                  />
                )}

                {/* Soft fade into card body */}
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute -inset-x-px -bottom-px h-6 bg-gradient-to-t from-surface to-transparent"
                />
              </div>

              {/* Editorial Footer */}
              <div className="flex flex-1 flex-col px-3.5 pb-3.5 pt-2">
                <div className="flex items-start justify-between gap-1.5">
                  <h3 className="line-clamp-2 font-heading text-sm font-semibold leading-snug tracking-tight text-ink-primary transition-colors group-hover:text-irminsul">
                    {w.name}
                  </h3>
                  <ArrowUpRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-dim opacity-0 transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-irminsul group-hover:opacity-100" />
                </div>

                <div className="mt-auto space-y-2 pt-2.5">
                  <span className="inline-block max-w-full truncate rounded-md border border-border-subtle bg-surface-subtle px-2 py-0.5 font-mono text-[10px] font-medium text-ink-secondary">
                    {w.subStat || "Base ATK Only"}
                  </span>
                  <CharacterAvatarSpill users={w.recommendedFor} maxVisible={3} />
                </div>
              </div>
            </button>
          ))}
        </div>
      ) : subTab === "artifacts" ? (
        <div className="grid gap-4 md:grid-cols-2">
          {filteredArtifacts.map((art) => (
            <button
              key={art.id}
              type="button"
              onClick={() => setSelectedArtifact(art)}
              className="group flex min-w-0 flex-col overflow-hidden rounded-2xl border border-border bg-surface text-left shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:border-border-focus hover:shadow-hover"
            >
              <div className={cn("h-1 w-full shrink-0", getRarityAccent(art.maxRarity))} />
              <div className="flex w-full items-start gap-4 p-4 sm:p-5">
                {art.image && (
                  <div
                    className={cn(
                      "flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border p-1.5 shadow-sm",
                      getRarityBackdrop(art.maxRarity)
                    )}
                  >
                    <img
                      src={art.image}
                      alt={art.name}
                      loading="lazy"
                      className="h-full w-full object-contain drop-shadow-sm transition-transform duration-200 group-hover:scale-105"
                    />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="truncate font-heading text-[15px] font-semibold text-ink-primary group-hover:text-irminsul">
                      {art.name}
                    </h3>
                    <div className="flex shrink-0 items-center gap-2">
                      <CharacterAvatarSpill users={art.recommendedFor} maxVisible={3} />
                      <RarityBadge rarity={art.maxRarity} />
                    </div>
                  </div>
                  <div className="mt-2.5 space-y-2 text-xs leading-relaxed text-ink-secondary">
                    {art.bonuses.map((bonus, idx) => (
                      <div key={idx} className="flex items-start gap-2">
                        <span className="mt-0.5 shrink-0 rounded-md border border-[#B8D8CE] bg-irminsul-soft px-1.5 py-0.5 font-mono text-[10px] font-semibold text-irminsul">
                          {idx === 0 ? "2pc" : "4pc"}
                        </span>
                        <p className="min-w-0">{bonus}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="space-y-8">
          {/* Elemental Reactions */}
          <section className="space-y-3">
            <div>
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-irminsul" />
                <h2 className="font-serif text-2xl text-ink-primary">Elemental Reactions</h2>
              </div>
              <p className="mt-0.5 text-xs text-ink-secondary">
                Combat effects triggered by combining two or more elemental auras on an enemy, scaling with Level, EM, or Crit.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {elementsData?.reactions.map((rx) => {
                const primaryEl = getElementStyle(rx.elements[0] || "");
                return (
                  <div
                    key={rx.name}
                    className="flex min-w-0 flex-col justify-between overflow-hidden rounded-2xl border border-border bg-surface shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:border-border-focus hover:shadow-hover"
                  >
                    <div className={cn("h-1 w-full shrink-0", primaryEl.dot)} />
                    <div className="flex flex-1 flex-col justify-between p-4 sm:p-5">
                      <div>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-1.5">
                            {rx.elements.map((elName) => {
                              const st = getElementStyle(elName);
                              return (
                                <span
                                  key={elName}
                                  className={cn(
                                    "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium",
                                    st.badgeBg,
                                    st.badgeText,
                                    st.border
                                  )}
                                >
                                  <span className={cn("h-1.5 w-1.5 rounded-full", st.dot)} />
                                  {elName}
                                </span>
                              );
                            })}
                          </div>
                          <Badge>{rx.category}</Badge>
                        </div>
                        <h3 className="mt-3 font-heading text-base font-semibold text-ink-primary">
                          {rx.name}
                        </h3>
                        <p className="mt-1.5 text-xs leading-relaxed text-ink-secondary">
                          {rx.description}
                        </p>
                      </div>
                      <div className="mt-3.5 rounded-xl border border-border-subtle bg-canvas/70 px-3 py-2 font-mono text-[11px] text-irminsul">
                        {rx.scaling}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Elemental Resonances */}
          {elementsData && elementsData.resonances.length > 0 && (
            <section className="space-y-3">
              <div>
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-irminsul" />
                  <h2 className="font-serif text-2xl text-ink-primary">Elemental Resonances</h2>
                </div>
                <p className="mt-0.5 text-xs text-ink-secondary">
                  Party-wide passive buffs unlocked automatically when your 4-character team includes 2 of the same element (or 4 unique elements).
                </p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {elementsData.resonances.map((res) => {
                  const meta = RESONANCE_ELEMENT_MAP[res.name.trim().toLowerCase()];
                  const isAny = !meta || meta.element === "All";
                  const st = !isAny ? getElementStyle(meta.element) : null;
                  return (
                    <div
                      key={res.id}
                      className="flex min-w-0 flex-col justify-between overflow-hidden rounded-2xl border border-border bg-surface shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:border-border-focus hover:shadow-hover"
                    >
                      <div className={cn("h-1 w-full shrink-0", st ? st.dot : "bg-irminsul")} />
                      <div className="flex flex-1 flex-col justify-between p-4 sm:p-5">
                        <div>
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            {st && meta ? (
                              <span
                                className={cn(
                                  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium",
                                  st.badgeBg,
                                  st.badgeText,
                                  st.border
                                )}
                              >
                                <span className={cn("h-1.5 w-1.5 rounded-full", st.dot)} />
                                {meta.element}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full border border-[#B8D8CE] bg-irminsul-soft px-2 py-0.5 text-[10px] font-medium text-irminsul">
                                Multi-Element
                              </span>
                            )}
                            <Badge>{meta?.requirement || "Party Buff"}</Badge>
                          </div>
                          <h3 className="mt-3 font-heading text-base font-semibold text-ink-primary">
                            {res.name}
                          </h3>
                          <p className="mt-1.5 text-xs leading-relaxed text-ink-secondary">
                            {res.description}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      )}

      {/* Weapon Detail Modal */}
      {selectedWeapon && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={selectedWeapon.name}
          className="fixed inset-0 z-50 !mt-0 flex items-center justify-center bg-ink-primary/55 p-4 backdrop-blur-md"
          onClick={() => setSelectedWeapon(null)}
        >
          <div
            className="max-h-[88vh] w-full max-w-lg overflow-hidden rounded-3xl border border-border bg-surface shadow-hover"
            onClick={(e) => e.stopPropagation()}
          >
            <div className={cn("h-1.5 w-full shrink-0", getRarityAccent(selectedWeapon.rarity))} />
            <div className="max-h-[calc(88vh-6px)] overscroll-contain overflow-y-auto p-6">
              <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3.5">
                {selectedWeapon.image && (
                  <img
                    src={selectedWeapon.image}
                    alt={selectedWeapon.name}
                    className={cn(
                      "h-16 w-16 rounded-2xl border object-contain p-1.5",
                      getRarityBackdrop(selectedWeapon.rarity)
                    )}
                  />
                )}
                <div>
                  <div className="flex items-center gap-2">
                    <Badge>{selectedWeapon.weaponType}</Badge>
                    <RarityBadge rarity={selectedWeapon.rarity} />
                  </div>
                  <h2 className="mt-1 font-serif text-2xl text-ink-primary">
                    {selectedWeapon.name}
                  </h2>
                  {selectedWeapon.subStat && (
                    <p className="font-mono text-xs text-irminsul">
                      Substat: {selectedWeapon.subStat}
                    </p>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedWeapon(null)}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-canvas text-ink-secondary hover:text-ink-primary"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {loadingWeaponDetail ? (
              <p className="mt-4 text-xs text-ink-dim">Loading weapon passive...</p>
            ) : weaponDetailError ? (
              <div className="mt-4 rounded-xl border border-[#E8C5BC] bg-[#FBF0ED] p-3 text-xs text-[#9A3B26]">
                {weaponDetailError}
              </div>
            ) : (
              <div className="mt-4 space-y-3 border-t border-border-subtle pt-4">
                {(selectedWeapon.baseAtk || selectedWeapon.subStatValue) && (
                  <div className="divide-y divide-border-subtle rounded-xl border border-border-subtle bg-canvas/70 px-3.5 py-1.5 text-xs">
                    {selectedWeapon.baseAtk && (
                      <div className="flex items-center justify-between py-1.5">
                        <span className="text-ink-secondary">Base ATK (Lv.1 / 90)</span>
                        <span className="font-mono font-semibold text-ink-primary">
                          {selectedWeapon.baseAtk}
                        </span>
                      </div>
                    )}
                    {selectedWeapon.subStat && selectedWeapon.subStatValue && (
                      <div className="flex items-center justify-between py-1.5">
                        <span className="text-ink-secondary">{selectedWeapon.subStat}</span>
                        <span className="font-mono font-semibold text-irminsul">
                          {selectedWeapon.subStatValue}
                        </span>
                      </div>
                    )}
                  </div>
                )}
                {selectedWeapon.passiveName && (
                  <div className="space-y-2.5 rounded-xl border border-[#B8D8CE] bg-irminsul-soft/50 p-3.5">
                    <RefinementSelector
                      count={selectedWeapon.passiveRefinements?.length ?? 0}
                      activeIdx={weaponRefineIdx}
                      onSelect={setWeaponRefineIdx}
                      className="bg-surface/90"
                    />
                    <div>
                      <p className="font-heading text-xs font-semibold text-irminsul">
                        Passive (R{weaponRefineIdx + 1}): {selectedWeapon.passiveName}
                      </p>
                      <p className="mt-1 whitespace-pre-line text-xs leading-relaxed text-ink-primary">
                        {selectedWeapon.passiveRefinements?.[weaponRefineIdx] ||
                          selectedWeapon.passiveDescription}
                      </p>
                    </div>
                  </div>
                )}
                {selectedWeapon.description && (
                  <p className="text-xs leading-relaxed text-ink-secondary">
                    {selectedWeapon.description}
                  </p>
                )}
                <RecommendedUsersSection
                  users={selectedWeapon.recommendedFor}
                  onPick={(cid) => {
                    setSelectedWeapon(null);
                    onSelectCharacter?.(cid);
                  }}
                />
              </div>
            )}
            </div>
          </div>
        </div>
      )}

      {/* Artifact Set Detail Modal */}
      {selectedArtifact && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={selectedArtifact.name}
          className="fixed inset-0 z-50 !mt-0 flex items-center justify-center bg-ink-primary/55 p-4 backdrop-blur-md"
          onClick={() => setSelectedArtifact(null)}
        >
          <div
            className="max-h-[88vh] w-full max-w-lg overflow-hidden rounded-3xl border border-border bg-surface shadow-hover"
            onClick={(e) => e.stopPropagation()}
          >
            <div className={cn("h-1.5 w-full shrink-0", getRarityAccent(selectedArtifact.maxRarity))} />
            <div className="max-h-[calc(88vh-6px)] overscroll-contain overflow-y-auto p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  {selectedArtifact.image && (
                    <img
                      src={selectedArtifact.image}
                      alt={selectedArtifact.name}
                      className={cn(
                        "h-16 w-16 rounded-2xl border object-contain p-1.5",
                        getRarityBackdrop(selectedArtifact.maxRarity)
                      )}
                    />
                  )}
                  <div>
                    <RarityBadge rarity={selectedArtifact.maxRarity} />
                    <h2 className="mt-1 font-serif text-2xl text-ink-primary">
                      {selectedArtifact.name}
                    </h2>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedArtifact(null)}
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-canvas text-ink-secondary hover:text-ink-primary"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-4 space-y-3 border-t border-border-subtle pt-4">
                <div className="space-y-2 rounded-xl border border-border-subtle bg-canvas/60 p-3.5 text-xs leading-relaxed text-ink-secondary">
                  {selectedArtifact.bonuses.map((bonus, idx) => (
                    <div key={idx} className="flex items-start gap-2">
                      <span className="mt-0.5 shrink-0 rounded-md border border-[#B8D8CE] bg-irminsul-soft px-1.5 py-0.5 font-mono text-[10px] font-semibold text-irminsul">
                        {idx === 0 ? "2pc" : "4pc"}
                      </span>
                      <p className="min-w-0">{bonus}</p>
                    </div>
                  ))}
                </div>

                <RecommendedUsersSection
                  users={selectedArtifact.recommendedFor}
                  onPick={(cid) => {
                    setSelectedArtifact(null);
                    onSelectCharacter?.(cid);
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
