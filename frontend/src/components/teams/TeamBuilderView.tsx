import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Search, Shield, Trash2, Users, X, Zap } from "lucide-react";
import { RarityBadge } from "@/components/ui/RarityBadge";
import { Badge } from "@/components/ui/badge";
import { cn, getElementStyle, getRarityAccent } from "@/lib/utils";
import { analyzeTeamComp } from "@/services/api";
import type { CharacterSummary, TeamAnalyzeResponse } from "@/types/genshin";

const VISIONS = ["All", "Pyro", "Hydro", "Electro", "Cryo", "Anemo", "Geo", "Dendro"] as const;

interface TeamBuilderViewProps {
  characters: CharacterSummary[];
  onSelectCharacter?: (id: string) => void;
}

export function TeamBuilderView({ characters, onSelectCharacter }: TeamBuilderViewProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const initializedDefaults = useRef(false);

  useEffect(() => {
    if (initializedDefaults.current || characters.length === 0) return;
    initializedDefaults.current = true;
    const defaults = ["arlecchino", "yelan", "bennett", "kaedehara-kazuha"];
    const available = new Set(characters.map((c) => c.id.toLowerCase()));
    const valid = defaults.filter((d) => available.has(d));
    setSelectedIds(valid.length > 0 ? valid : characters.slice(0, 4).map((c) => c.id));
  }, [characters]);

  const [analysis, setAnalysis] = useState<TeamAnalyzeResponse | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [search, setSearch] = useState("");
  const [visionFilter, setVisionFilter] = useState<(typeof VISIONS)[number]>("All");

  const charById = useMemo(() => {
    const map = new Map<string, CharacterSummary>();
    for (const c of characters) map.set(c.id, c);
    return map;
  }, [characters]);

  const selectedChars = useMemo(
    () => selectedIds.map((id) => charById.get(id)).filter(Boolean) as CharacterSummary[],
    [selectedIds, charById]
  );

  useEffect(() => {
    let cancelled = false;
    if (selectedIds.length === 0) {
      setAnalysis(null);
      return;
    }
    setAnalyzing(true);
    analyzeTeamComp(selectedIds)
      .then((res) => {
        if (!cancelled) setAnalysis(res);
      })
      .catch(() => {
        if (!cancelled) setAnalysis(null);
      })
      .finally(() => {
        if (!cancelled) setAnalyzing(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedIds]);

  const filteredPool = useMemo(() => {
    const q = search.trim().toLowerCase();
    return characters.filter((c) => {
      if (visionFilter !== "All" && c.vision.toLowerCase() !== visionFilter.toLowerCase()) {
        return false;
      }
      if (q && !c.name.toLowerCase().includes(q) && !c.vision.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [characters, search, visionFilter]);

  const toggleCharacter = (id: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 4) return [...prev.slice(0, 3), id];
      return [...prev, id];
    });
  };

  return (
    <div className="space-y-6">
      {/* Editorial Hero */}
      <div className="relative overflow-hidden rounded-3xl border border-border bg-surface p-5 shadow-card sm:p-7">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-12 -top-12 h-56 w-56 rounded-full bg-[radial-gradient(circle,rgba(36,106,86,0.08),transparent_70%)]"
        />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-widest text-irminsul">
                <Users className="h-3.5 w-3.5" />
                Party Synergy
              </span>
              <span className="rounded-full border border-[#B8D8CE] bg-irminsul-soft px-2.5 py-0.5 font-mono text-[11px] font-medium text-irminsul">
                {selectedChars.length}/4 Slots
              </span>
            </div>
            <h1 className="mt-1.5 font-serif text-3xl tracking-tight text-ink-primary sm:text-4xl">
              Team Comp &amp; Synergy Checker
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-ink-secondary">
              Build a 4-character party to preview active Elemental Resonances, triggerable reactions, and role balance.
            </p>
          </div>

          {selectedIds.length > 0 && (
            <button
              type="button"
              onClick={() => setSelectedIds([])}
              className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-xl border border-border bg-canvas px-3 py-2 text-xs font-medium text-ink-secondary transition-colors hover:border-border-focus hover:text-ink-primary sm:self-auto"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Clear Party
            </button>
          )}
        </div>
      </div>

      {/* 4-Slot Party Stage */}
      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        {[0, 1, 2, 3].map((slotIdx) => {
          const ch = selectedChars[slotIdx];
          if (!ch) {
            return (
              <div
                key={`empty-${slotIdx}`}
                className="flex min-h-[180px] flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-surface/60 p-4 text-center"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-canvas text-ink-dim">
                  <Plus className="h-4 w-4" />
                </div>
                <p className="mt-2.5 text-xs font-medium text-ink-secondary">Slot {slotIdx + 1}</p>
                <p className="mt-0.5 text-[11px] text-ink-dim">Pick a character below</p>
              </div>
            );
          }

          const el = getElementStyle(ch.vision);
          return (
            <div
              key={ch.id}
              className="group relative flex min-w-0 flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-card transition-all hover:border-border-focus hover:shadow-hover"
            >
              <div className={cn("h-1 w-full shrink-0", getRarityAccent(ch.rarity))} />
              <div
                className={cn(
                  "relative flex h-28 items-end justify-center overflow-hidden bg-gradient-to-b pt-2",
                  el.cardTint
                )}
              >
                <button
                  type="button"
                  onClick={() => toggleCharacter(ch.id)}
                  title="Remove from party"
                  className="absolute right-2 top-2 z-10 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-surface/90 text-ink-secondary shadow-sm transition-colors hover:text-[#9A3B26]"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
                <span
                  className={cn(
                    "absolute left-2 top-2 z-10 inline-flex items-center gap-1 rounded-full border bg-surface/95 px-2 py-0.5 text-[10px] font-medium shadow-sm",
                    el.badgeText,
                    el.border
                  )}
                >
                  <span className={cn("h-1.5 w-1.5 rounded-full", el.dot)} />
                  {ch.vision}
                </span>
                <img
                  src={ch.image}
                  alt={ch.name}
                  className="h-[92%] w-auto object-contain object-bottom"
                />
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute -inset-x-px -bottom-px h-5 bg-gradient-to-t from-surface to-transparent"
                />
              </div>

              <div className="flex flex-1 flex-col p-3">
                <div className="flex items-center justify-between gap-1.5">
                  <button
                    type="button"
                    onClick={() => onSelectCharacter?.(ch.id)}
                    className="truncate text-left font-heading text-sm font-semibold text-ink-primary hover:text-irminsul"
                  >
                    {ch.name}
                  </button>
                  <RarityBadge rarity={ch.rarity} />
                </div>
                <div className="mt-1.5 flex items-center justify-between gap-2">
                  <span className="truncate rounded-md border border-border-subtle bg-surface-subtle px-2 py-0.5 font-mono text-[10px] text-ink-secondary">
                    {ch.roles[0] || "Flexible"}
                  </span>
                  <span className="font-mono text-[10px] text-ink-dim">{ch.weapon}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Synergy Breakdown */}
      {selectedChars.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-3">
          {/* Resonances */}
          <div className="rounded-2xl border border-border bg-surface p-5 shadow-card">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-irminsul" />
                <h2 className="font-heading text-sm font-semibold text-ink-primary">
                  Elemental Resonances
                </h2>
              </div>
              {analyzing && <span className="font-mono text-[10px] text-ink-dim">Updating...</span>}
            </div>
            {analysis && analysis.activeResonances.length > 0 ? (
              <div className="mt-3 space-y-2.5">
                {analysis.activeResonances.map((res) => (
                  <div
                    key={res.id}
                    className="rounded-xl border border-[#B8D8CE] bg-irminsul-soft/50 p-3"
                  >
                    <p className="font-heading text-xs font-semibold text-irminsul">{res.name}</p>
                    <p className="mt-1 text-xs leading-relaxed text-ink-secondary">
                      {res.description}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-xs leading-relaxed text-ink-dim">
                No active Elemental Resonance yet. Pair 2 characters of the same element, or use 4 unique elements.
              </p>
            )}
          </div>

          {/* Reactions */}
          <div className="rounded-2xl border border-border bg-surface p-5 shadow-card">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-irminsul" />
              <h2 className="font-heading text-sm font-semibold text-ink-primary">
                Triggerable Reactions
              </h2>
            </div>
            {analysis && analysis.triggerableReactions.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {analysis.triggerableReactions.map((rx) => (
                  <div
                    key={rx.name}
                    className="w-full rounded-xl border border-border-subtle bg-canvas/70 px-3 py-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-heading text-xs font-semibold text-ink-primary">
                        {rx.name}
                      </span>
                      <Badge>{rx.category}</Badge>
                    </div>
                    <p className="mt-0.5 font-mono text-[10px] text-irminsul">{rx.scaling}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-xs leading-relaxed text-ink-dim">
                Add characters of different elements to see available Elemental Reactions.
              </p>
            )}
          </div>

          {/* Role Coverage & Notes */}
          <div className="rounded-2xl border border-border bg-surface p-5 shadow-card">
            <h2 className="font-heading text-sm font-semibold text-ink-primary">
              Role Balance &amp; Tips
            </h2>
            {analysis && (
              <>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  {Object.entries(analysis.roleCounts).map(([role, count]) => (
                    <div
                      key={role}
                      className="rounded-xl border border-border-subtle bg-canvas/70 px-2 py-2"
                    >
                      <p className="font-serif text-xl text-ink-primary">{count}</p>
                      <p className="truncate font-mono text-[10px] text-ink-dim">{role}</p>
                    </div>
                  ))}
                </div>
                <ul className="mt-3 space-y-1.5 text-xs leading-relaxed text-ink-secondary">
                  {analysis.synergyNotes.map((note, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-irminsul" />
                      <span>{note}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </div>
      )}

      {/* Character Roster Picker */}
      <div className="rounded-3xl border border-border bg-surface p-5 shadow-card sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-serif text-2xl text-ink-primary">Pick Party Members</h2>
            <p className="text-xs text-ink-secondary">
              Click any character below to add or remove them from your 4-slot party.
            </p>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-dim" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search character..."
              className="w-full rounded-xl border border-border bg-canvas py-2 pl-9 pr-8 text-xs text-ink-primary placeholder:text-ink-dim focus:border-irminsul focus:outline-none"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-dim hover:text-ink-primary"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        <div className="mt-3 flex items-center gap-1.5 overflow-x-auto pb-1">
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
                    ? "border-irminsul bg-irminsul text-white"
                    : "border-transparent bg-surface-subtle text-ink-secondary hover:text-ink-primary"
                )}
              >
                {el && (
                  <span className={cn("h-1.5 w-1.5 rounded-full", active ? "bg-white" : el.dot)} />
                )}
                {v}
              </button>
            );
          })}
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2.5 sm:grid-cols-5 md:grid-cols-7 lg:grid-cols-9">
          {filteredPool.map((c) => {
            const isSelected = selectedIds.includes(c.id);
            const el = getElementStyle(c.vision);
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => toggleCharacter(c.id)}
                className={cn(
                  "group relative flex min-w-0 flex-col items-center rounded-xl border p-2 text-center transition-all",
                  isSelected
                    ? "border-irminsul bg-irminsul-soft/60 shadow-sm"
                    : "border-border-subtle bg-canvas/60 hover:border-border-focus hover:bg-surface"
                )}
              >
                <div
                  className={cn(
                    "relative h-12 w-12 overflow-hidden rounded-xl border border-border-subtle bg-gradient-to-b",
                    el.cardTint
                  )}
                >
                  <img
                    src={c.image}
                    alt={c.name}
                    loading="lazy"
                    className="h-full w-full object-cover object-top"
                  />
                  <span
                    className={cn(
                      "absolute left-1 top-1 h-2 w-2 rounded-full ring-1 ring-white",
                      el.dot
                    )}
                  />
                </div>
                <p className="mt-1.5 w-full truncate text-[11px] font-medium text-ink-primary">
                  {c.name}
                </p>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
