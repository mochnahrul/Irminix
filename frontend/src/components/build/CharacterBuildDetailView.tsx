import { useEffect, useRef, useState } from "react";
import { toPng } from "html-to-image";
import {
  ArrowLeft,
  BookOpen,
  Calculator,
  Download,
  Info,
  Layers,
  Sparkles,
  Swords,
} from "lucide-react";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { WeaponHoverPopover } from "@/components/build/WeaponHoverPopover";
import { RarityBadge } from "@/components/ui/RarityBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn, getElementStyle, getRarityAccent, getRarityBackdrop } from "@/lib/utils";
import { fetchCharacterDetail } from "@/services/api";
import type { BuildNoteItem, CharacterDetail } from "@/types/genshin";

interface CharacterBuildDetailViewProps {
  characterId: string;
  onBack: () => void;
  onOpenAdvisor: (characterName: string, role?: string) => void;
  onOpenCalculator?: (characterId: string) => void;
}

function normalizeNoteKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function findMatchingNotes(notes: BuildNoteItem[] | undefined, name: string): BuildNoteItem[] {
  if (!notes || !name) return [];
  const target = normalizeNoteKey(name);
  return notes.filter((n) => normalizeNoteKey(n.label) === target);
}

function resolveTalentInfo(
  priorityLabel: string,
  talents: CharacterDetail["talents"]
): { shortLabel: string; talent?: CharacterDetail["talents"][number] } {
  const low = priorityLabel.toLowerCase();
  if (low.includes("normal")) {
    return { shortLabel: "Normal", talent: talents[0] };
  }
  if (low.includes("skill")) {
    return { shortLabel: "Skill", talent: talents[1] };
  }
  if (low.includes("burst")) {
    return {
      shortLabel: "Burst",
      talent: talents.find((t) => t.unlock === "1") || talents[2],
    };
  }
  return { shortLabel: priorityLabel, talent: undefined };
}

function NoteInfoButton({
  notes,
  title = "Build Note",
  align = "left",
  onHoverStart,
}: {
  notes: BuildNoteItem[];
  title?: string;
  align?: "left" | "right";
  onHoverStart?: () => void;
}) {
  const [open, setOpen] = useState(false);
  if (!notes || notes.length === 0) return null;

  return (
    <div
      className="relative inline-flex shrink-0"
      onMouseEnter={() => {
        onHoverStart?.();
        setOpen(true);
      }}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onHoverStart?.();
          setOpen((prev) => !prev);
        }}
        aria-label={title}
        className={cn(
          "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors",
          open
            ? "border-irminsul bg-irminsul text-white"
            : "border-[#B8D8CE] bg-irminsul-soft text-irminsul hover:border-irminsul"
        )}
      >
        <Info className="h-3 w-3" />
      </button>

      {open && (
        <div
          onClick={(e) => e.stopPropagation()}
          className={cn(
            "fixed inset-x-4 bottom-4 z-50 sm:inset-x-auto sm:bottom-auto sm:absolute sm:top-full sm:w-80 sm:pt-1.5",
            align === "right" ? "sm:right-0" : "sm:left-0"
          )}
        >
          <div className="max-h-[65vh] space-y-1.5 overflow-y-auto rounded-2xl border border-[#B8D8CE] bg-surface p-3.5 text-xs leading-relaxed text-ink-primary shadow-hover">
            <div className="flex items-center justify-between gap-2">
              <p className="font-mono text-[10px] font-semibold uppercase tracking-wider text-irminsul">
                {title}
              </p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md px-1.5 py-0.5 font-mono text-[10px] text-ink-dim hover:bg-surface-subtle sm:hidden"
              >
                Close
              </button>
            </div>
            {notes.map((n, idx) => (
              <p key={idx} className="text-ink-secondary">
                {notes.length > 1 && (
                  <span className="font-semibold text-irminsul">{n.label}: </span>
                )}
                {n.note}
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function CharacterBuildDetailView({
  characterId,
  onBack,
  onOpenAdvisor,
  onOpenCalculator,
}: CharacterBuildDetailViewProps) {
  const [detail, setDetail] = useState<CharacterDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeBuildIdx, setActiveBuildIdx] = useState(0);
  const [kitTab, setKitTab] = useState<"talents" | "constellations">("talents");
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const [weaponRefineMap, setWeaponRefineMap] = useState<Record<string, number>>({});
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setActiveBuildIdx(0);
    setKitTab("talents");
    setWeaponRefineMap({});
    setHoveredKey(null);
    fetchCharacterDetail(characterId)
      .then((res) => {
        if (!cancelled) setDetail(res);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load character.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [characterId]);

  const handleExportPng = async () => {
    if (!cardRef.current || !detail) return;
    try {
      const dataUrl = await toPng(cardRef.current, {
        backgroundColor: "#F7F5F0",
        pixelRatio: 2,
        cacheBust: true,
      });
      const link = document.createElement("a");
      link.download = `irminix-${detail.id}-build.png`;
      link.href = dataUrl;
      link.click();
    } catch {
      // Ignore CORS-tainted canvas failures silently
    }
  };

  if (loading) return <LoadingSpinner label="Retrieving character manuscript..." />;
  if (error || !detail) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
          Back to Codex
        </Button>
        <div className="rounded-xl border border-[#E8C5BC] bg-[#FBF0ED] p-6 text-sm text-[#9A3B26]">
          {error || "Character not found."}
        </div>
      </div>
    );
  }

  const el = getElementStyle(detail.vision);
  const activeBuild = detail.builds[activeBuildIdx] ?? detail.builds[0];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
          Back to Codex
        </Button>
        <div className="flex flex-wrap items-center gap-2">
          {onOpenCalculator && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onOpenCalculator(detail.id)}
            >
              <Calculator className="h-3.5 w-3.5" />
              Material Calculator
            </Button>
          )}
          <Button variant="secondary" size="sm" onClick={handleExportPng}>
            <Download className="h-3.5 w-3.5" />
            Export Card
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => onOpenAdvisor(detail.name, activeBuild?.role)}
          >
            <Sparkles className="h-3.5 w-3.5" />
            Analyze Build
          </Button>
        </div>
      </div>

      <div
        ref={cardRef}
        className="overflow-visible rounded-3xl border border-border bg-surface shadow-card"
      >
        {/* Elemental Hero Header */}
        <div
          className={cn(
            "flex flex-col gap-5 rounded-t-3xl border-b border-border bg-gradient-to-br p-6 sm:p-8 md:flex-row md:items-center",
            el.cardTint
          )}
        >
          <div className="flex h-36 w-36 shrink-0 items-end justify-center overflow-hidden rounded-2xl border border-border bg-surface/80 pt-2 shadow-sm sm:h-40 sm:w-40">
            <img
              src={detail.image}
              alt={detail.name}
              crossOrigin="anonymous"
              className="h-full w-auto object-contain object-bottom"
            />
          </div>

          <div className="min-w-0 flex-1 space-y-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border bg-surface/90 px-2.5 py-0.5 text-xs font-medium",
                  el.badgeText,
                  el.border
                )}
              >
                <span className={cn("h-1.5 w-1.5 rounded-full", el.dot)} />
                {detail.vision}
              </span>
              <Badge className="bg-surface/80">{detail.weapon}</Badge>
              <Badge className="bg-surface/80">{detail.region}</Badge>
              {detail.constellation && (
                <Badge className="bg-surface/80">{detail.constellation}</Badge>
              )}
              <RarityBadge rarity={detail.rarity} />
            </div>

            <h1 className="font-serif text-4xl tracking-tight text-ink-primary sm:text-5xl">
              {detail.name}
            </h1>
            {detail.title && (
              <p className="text-sm font-medium text-irminsul">{detail.title}</p>
            )}
            {detail.description && (
              <p className="max-w-2xl text-sm leading-relaxed text-ink-secondary">
                {detail.description}
              </p>
            )}
          </div>
        </div>

        <div className="space-y-6 p-6 sm:p-8">

        {/* Role Tabs */}
        {detail.builds.length > 0 && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="mr-1 font-mono text-[11px] uppercase tracking-wider text-ink-dim">
                  Build Role
                </span>
                {detail.builds.map((b, idx) => (
                  <button
                    key={`${b.role}-${idx}`}
                    type="button"
                    onClick={() => {
                      setActiveBuildIdx(idx);
                      setHoveredKey(null);
                    }}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-mono text-xs uppercase tracking-wide transition-colors",
                      activeBuildIdx === idx
                        ? "bg-irminsul text-white"
                        : "bg-surface-subtle text-ink-secondary hover:text-ink-primary"
                    )}
                  >
                    <span>{b.role}</span>
                    {b.isBest && (
                      <span
                        className={cn(
                          "rounded px-1.5 py-0.5 text-[9px] font-semibold tracking-wider",
                          activeBuildIdx === idx
                            ? "bg-white/20 text-white"
                            : "bg-irminsul-goldSoft text-irminsul-gold"
                        )}
                      >
                        Best
                      </span>
                    )}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {detail.buildLastUpdated ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-[#B8D8CE] bg-irminsul-soft px-2.5 py-0.5 font-mono text-[11px] font-medium text-irminsul">
                    Build Updated v{detail.buildLastUpdated}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full border border-[#E3D3AE] bg-irminsul-goldSoft px-2.5 py-0.5 font-mono text-[11px] font-medium text-irminsul-gold">
                    {detail.source.includes("yatta-live") ? "General Guide" : "Legacy Baseline"}
                  </span>
                )}
                {detail.versionReleased && (
                  <span className="rounded-full border border-border bg-surface-subtle px-2.5 py-0.5 font-mono text-[11px] text-ink-secondary">
                    Released v{detail.versionReleased}
                  </span>
                )}
              </div>
            </div>

            {activeBuild && (
              <div className="space-y-6">
                {/* At-a-Glance Quick Summary */}
                <div className="grid gap-3 rounded-2xl border border-[#B8D8CE] bg-irminsul-soft/50 p-3.5 sm:grid-cols-3 sm:p-4">
                  {/* #1 Best Weapon (hoverable) */}
                  {(() => {
                    const topW = activeBuild.weapons[0];
                    const swKey = `summary-weapon-${activeBuildIdx}-${topW?.name || ""}`;
                    const swHovered = Boolean(topW && hoveredKey === swKey);
                    const swRefIdx = weaponRefineMap[swKey] ?? (topW && topW.refine > 0 ? topW.refine - 1 : 0);
                    return (
                      <div
                        onMouseEnter={() => topW && setHoveredKey(swKey)}
                        onMouseLeave={() => setHoveredKey((prev) => (prev === swKey ? null : prev))}
                        onClick={() => topW && setHoveredKey((prev) => (prev === swKey ? null : swKey))}
                        className={cn(
                          "relative min-w-0 rounded-xl border border-transparent bg-surface/90 p-3 shadow-sm transition-colors",
                          topW && "cursor-pointer hover:border-irminsul"
                        )}
                      >
                        <p className="font-mono text-[10px] uppercase tracking-wider text-irminsul">
                          #1 Best Weapon
                        </p>
                        <div className="mt-1.5 flex items-center gap-2.5">
                          {topW?.image && (
                            <img
                              src={topW.image}
                              alt={topW.name}
                              className={cn(
                                "h-10 w-10 shrink-0 rounded-lg border object-contain p-0.5",
                                getRarityBackdrop(topW.rarity)
                              )}
                            />
                          )}
                          <p className="min-w-0 break-words text-sm font-semibold leading-snug text-ink-primary">
                            {topW?.name || "Flexible Crit / Synergy"}
                          </p>
                        </div>

                        {swHovered && topW && (
                          <WeaponHoverPopover
                            weapon={topW}
                            refineIdx={swRefIdx}
                            onSelectRefine={(rIdx) =>
                              setWeaponRefineMap((prev) => ({ ...prev, [swKey]: rIdx }))
                            }
                          />
                        )}
                      </div>
                    );
                  })()}

                  {/* Best Artifact Set (hoverable) */}
                  {(() => {
                    const topArt = activeBuild.artifacts[0];
                    const saKey = "summary-artifact";
                    const saHovered = Boolean(topArt && hoveredKey === saKey);
                    const hasArtDetails = Boolean(
                      topArt &&
                        ((topArt.bonuses && topArt.bonuses.length > 0) ||
                          (topArt.mix && topArt.mix.some((m) => m.bonuses && m.bonuses.length > 0)))
                    );
                    return (
                      <div
                        onMouseEnter={() => hasArtDetails && setHoveredKey(saKey)}
                        onMouseLeave={() => setHoveredKey((prev) => (prev === saKey ? null : prev))}
                        onClick={() =>
                          hasArtDetails && setHoveredKey((prev) => (prev === saKey ? null : saKey))
                        }
                        className={cn(
                          "relative min-w-0 rounded-xl border border-transparent bg-surface/90 p-3 shadow-sm transition-colors",
                          hasArtDetails && "cursor-pointer hover:border-irminsul"
                        )}
                      >
                        <p className="font-mono text-[10px] uppercase tracking-wider text-irminsul">
                          Best Artifact Set
                        </p>
                        <div className="mt-1.5 flex items-center gap-2.5">
                          {topArt?.mix && topArt.mix.length > 0 ? (
                            <div className="flex shrink-0 items-center -space-x-1.5">
                              {topArt.mix.slice(0, 2).map(
                                (m, mi) =>
                                  m.image && (
                                    <img
                                      key={`${m.name}-${mi}`}
                                      src={m.image}
                                      alt={m.name}
                                      className={cn(
                                        "h-9 w-9 rounded-lg border object-contain p-0.5 shadow-sm",
                                        getRarityBackdrop(m.rarity)
                                      )}
                                    />
                                  )
                              )}
                            </div>
                          ) : (
                            topArt?.image && (
                              <img
                                src={topArt.image}
                                alt={topArt.name || "Artifact"}
                                className={cn(
                                  "h-10 w-10 shrink-0 rounded-lg border object-contain p-0.5",
                                  getRarityBackdrop(topArt.rarity)
                                )}
                              />
                            )
                          )}
                          <p className="min-w-0 break-words text-sm font-semibold leading-snug text-ink-primary">
                            {topArt?.name ||
                              (topArt?.mix
                                ? topArt.mix.map((m) => m.name).join(" + ")
                                : "Elemental Synergy")}
                          </p>
                        </div>

                        {saHovered && topArt && hasArtDetails && (
                          <div
                            onClick={(e) => e.stopPropagation()}
                            className="fixed inset-x-4 bottom-4 z-40 sm:absolute sm:inset-x-auto sm:bottom-auto sm:left-0 sm:top-full sm:w-[380px] sm:pt-1.5"
                          >
                            <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-hover">
                              <div className={cn("h-1 w-full shrink-0", getRarityAccent(topArt.rarity))} />
                              <div className="max-h-[65vh] space-y-3 overflow-y-auto overscroll-contain p-4 text-xs leading-relaxed sm:max-h-[330px]">
                                {topArt.mix && topArt.mix.length > 0 ? (
                                  <div className="space-y-2.5">
                                    <p className="font-mono text-[10px] font-semibold uppercase tracking-wider text-irminsul">
                                      2pc Mix Options
                                    </p>
                                    {topArt.mix.map((m, mi) => (
                                      <div key={`${m.name}-${mi}`} className="flex items-start gap-2.5">
                                        {m.image && (
                                          <img
                                            src={m.image}
                                            alt={m.name}
                                            className={cn(
                                              "h-9 w-9 shrink-0 rounded-lg border object-contain p-0.5",
                                              getRarityBackdrop(m.rarity)
                                            )}
                                          />
                                        )}
                                        <div className="min-w-0">
                                          <p className="font-heading font-semibold text-ink-primary">
                                            {m.name} ({m.piece}pc)
                                          </p>
                                          {m.bonuses && m.bonuses[0] && (
                                            <p className="text-ink-secondary">{m.bonuses[0]}</p>
                                          )}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <>
                                    <div className="flex items-center justify-between gap-3">
                                      <div className="flex items-center gap-2.5">
                                        {topArt.image && (
                                          <img
                                            src={topArt.image}
                                            alt={topArt.name || "Artifact"}
                                            className={cn(
                                              "h-11 w-11 shrink-0 rounded-xl border object-contain p-1",
                                              getRarityBackdrop(topArt.rarity)
                                            )}
                                          />
                                        )}
                                        <div>
                                          <p className="font-heading text-sm font-semibold text-ink-primary">
                                            {topArt.name}
                                          </p>
                                          <p className="font-mono text-[11px] text-irminsul">
                                            {topArt.piece}-Piece Set
                                          </p>
                                        </div>
                                      </div>
                                      <RarityBadge rarity={topArt.rarity} />
                                    </div>
                                    <div className="space-y-1.5">
                                      {topArt.bonuses?.map((bonus, bi) => (
                                        <p key={bi} className="text-ink-secondary">
                                          <span className="font-mono text-[10px] font-semibold text-irminsul">
                                            {bi === 0 ? "2pc:" : "4pc:"}
                                          </span>{" "}
                                          {bonus}
                                        </p>
                                      ))}
                                    </div>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Level Talents First (with Skill Icons + Hover) */}
                  <div className="min-w-0 rounded-xl bg-surface/90 p-3 shadow-sm">
                    <p className="font-mono text-[10px] uppercase tracking-wider text-irminsul">
                      Level Talents First
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      {(activeBuild.talentPriority.length > 0
                        ? activeBuild.talentPriority
                        : ["Elemental Burst", "Elemental Skill"]
                      ).map((t, idx, arr) => {
                        const { shortLabel, talent } = resolveTalentInfo(t, detail.talents);
                        const stKey = `summary-talent-${idx}-${shortLabel}`;
                        const stHovered = Boolean(talent?.description && hoveredKey === stKey);
                        return (
                          <div key={`${t}-${idx}`} className="flex items-center gap-1.5">
                            <div
                              onMouseEnter={() => talent?.description && setHoveredKey(stKey)}
                              onMouseLeave={() =>
                                setHoveredKey((prev) => (prev === stKey ? null : prev))
                              }
                              onClick={() =>
                                talent?.description &&
                                setHoveredKey((prev) => (prev === stKey ? null : stKey))
                              }
                              className={cn(
                                "relative inline-flex items-center gap-1.5 rounded-lg border border-border-subtle bg-canvas/80 py-1 pl-1 pr-2 transition-colors",
                                talent?.description && "cursor-pointer hover:border-irminsul hover:bg-surface"
                              )}
                            >
                              {talent?.icon ? (
                                <img
                                  src={talent.icon}
                                  alt={talent.name}
                                  className="h-6 w-6 shrink-0 rounded-md bg-ink-primary object-contain p-0.5"
                                />
                              ) : (
                                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-irminsul-soft font-mono text-[10px] font-semibold text-irminsul">
                                  {idx + 1}
                                </span>
                              )}
                              <span className="text-xs font-semibold text-ink-primary">
                                {shortLabel}
                              </span>

                              {stHovered && talent && (
                                <div
                                  onClick={(e) => e.stopPropagation()}
                                  className="fixed inset-x-4 bottom-4 z-40 sm:absolute sm:inset-x-auto sm:bottom-auto sm:right-0 sm:top-full sm:w-[380px] sm:pt-1.5"
                                >
                                  <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-hover">
                                    <div className="max-h-[65vh] overflow-y-auto overscroll-contain p-4 sm:max-h-[340px]">
                                      <div className="flex items-center gap-2.5 border-b border-border-subtle pb-2.5">
                                        {talent.icon && (
                                          <img
                                            src={talent.icon}
                                            alt={talent.name}
                                            className="h-9 w-9 shrink-0 rounded-lg border border-border bg-ink-primary p-1"
                                          />
                                        )}
                                        <div>
                                          <p className="font-heading text-sm font-semibold text-ink-primary">
                                            {talent.name}
                                          </p>
                                          <p className="font-mono text-[10px] font-medium text-irminsul">
                                            Priority #{idx + 1} · {t}
                                          </p>
                                        </div>
                                      </div>
                                      <p className="mt-2.5 whitespace-pre-line text-xs leading-relaxed text-ink-secondary">
                                        {talent.description}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                            {idx < arr.length - 1 && (
                              <span className="font-mono text-xs text-ink-dim">→</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="grid items-start gap-5 lg:grid-cols-2 lg:gap-6">
                {/* Weapons */}
                <section className="min-w-0 space-y-3 rounded-xl border border-border bg-canvas/60 p-3.5 sm:p-4">
                  <div className="flex items-center gap-2">
                    <Swords className="h-4 w-4 text-irminsul" />
                    <h2 className="font-heading text-sm font-semibold text-ink-primary">
                      Recommended Weapons
                    </h2>
                  </div>
                  {activeBuild.weapons.length === 0 ? (
                    <p className="text-xs text-ink-secondary">
                      Use Crit or {detail.vision} synergy {detail.weapon.toLowerCase()}s.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {activeBuild.weapons.map((w, i) => {
                        const wNotes = findMatchingNotes(activeBuild.weaponNotes, w.name);
                        const wHoverKey = `w-${i}-${w.name}`;
                        const isHovered = hoveredKey === wHoverKey;
                        const prevRank = i > 0 ? activeBuild.weapons[i - 1]?.rank : undefined;
                        const isTied = Boolean(w.rank && prevRank && w.rank === prevRank);
                        const rankLabel = isTied ? "≈" : `#${w.rank || i + 1}`;
                        const refineIdx = weaponRefineMap[wHoverKey] ?? (w.refine > 0 ? w.refine - 1 : 0);
                        const openUpward = activeBuild.weapons.length > 4 && i >= activeBuild.weapons.length - 2;
                        return (
                          <div
                            key={`${w.name}-${i}`}
                            onMouseEnter={() => setHoveredKey(wHoverKey)}
                            onMouseLeave={() => setHoveredKey((prev) => (prev === wHoverKey ? null : prev))}
                            onClick={() => setHoveredKey((prev) => (prev === wHoverKey ? null : wHoverKey))}
                            className="relative cursor-pointer rounded-xl border border-border bg-surface px-3 py-2.5 transition-colors hover:border-irminsul"
                          >
                            <div className="flex items-center gap-3">
                              <span
                                title={isTied ? `Tied at #${w.rank}` : undefined}
                                className={cn(
                                  "w-5 shrink-0 font-mono text-xs",
                                  isTied ? "font-semibold text-irminsul" : "text-ink-dim"
                                )}
                              >
                                {rankLabel}
                              </span>
                              {w.image && (
                                <img
                                  src={w.image}
                                  alt={w.name}
                                  loading="lazy"
                                  onError={(e) => {
                                    (e.currentTarget as HTMLImageElement).style.display = "none";
                                  }}
                                  className={cn(
                                    "h-10 w-10 shrink-0 rounded-lg border object-contain p-0.5",
                                    getRarityBackdrop(w.rarity)
                                  )}
                                />
                              )}
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex min-w-0 items-center gap-1.5">
                                    <p className="truncate text-sm font-semibold text-ink-primary">
                                      {w.name}
                                    </p>
                                    {wNotes.length > 0 && (
                                      <NoteInfoButton
                                        notes={wNotes}
                                        title={`Weapon Note · ${w.name}`}
                                        onHoverStart={() => setHoveredKey(null)}
                                      />
                                    )}
                                  </div>
                                  <div className="flex shrink-0 items-center gap-1.5">
                                    {w.subStat && (
                                      <span className="hidden rounded-md bg-irminsul-soft px-2 py-0.5 font-mono text-[10px] font-medium text-irminsul sm:inline-block">
                                        {w.subStat}
                                      </span>
                                    )}
                                    <RarityBadge
                                      rarity={w.rarity}
                                      suffix={w.refine > 0 ? ` R${w.refine}` : ""}
                                    />
                                  </div>
                                </div>
                              </div>
                            </div>

                            {isHovered && (
                              <WeaponHoverPopover
                                weapon={w}
                                refineIdx={refineIdx}
                                openUpward={openUpward}
                                onSelectRefine={(rIdx) =>
                                  setWeaponRefineMap((prev) => ({
                                    ...prev,
                                    [wHoverKey]: rIdx,
                                  }))
                                }
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>

                {/* Artifacts */}
                <section className="min-w-0 space-y-3 rounded-xl border border-border bg-canvas/60 p-3.5 sm:p-4">
                  <div className="flex items-center gap-2">
                    <Layers className="h-4 w-4 text-irminsul" />
                    <h2 className="font-heading text-sm font-semibold text-ink-primary">
                      Recommended Artifacts
                    </h2>
                  </div>
                  {activeBuild.artifacts.length === 0 ? (
                    <p className="text-xs text-ink-secondary">
                      4-Piece elemental synergy or 2-Piece + 2-Piece ATK%/EM/ER mix.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {activeBuild.artifacts.map((art, i) => {
                        const aNotes = art.name
                          ? findMatchingNotes(activeBuild.artifactNotes, art.name)
                          : [];
                        const aHoverKey = `a-${i}-${art.name || "mix"}`;
                        const aHovered = hoveredKey === aHoverKey;
                        const prevRank = i > 0 ? activeBuild.artifacts[i - 1]?.rank : undefined;
                        const isTied = Boolean(art.rank && prevRank && art.rank === prevRank);
                        const rankLabel = isTied ? "≈" : `#${art.rank || i + 1}`;
                        return (
                          <div key={i} className="rounded-xl border border-border bg-surface px-3 py-2.5">
                            {art.mix && art.mix.length > 0 ? (
                              <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-xs text-ink-dim">
                                    {rankLabel}
                                  </span>
                                  <span className="font-mono text-[10px] uppercase tracking-wider text-irminsul">
                                    2pc Mix Options (Choose Two)
                                  </span>
                                </div>
                                <div className="space-y-1.5">
                                  {art.mix.map((m, mi) => {
                                    const mNotes = findMatchingNotes(activeBuild.artifactNotes, m.name);
                                    const mHoverKey = `am-${i}-${mi}-${m.name}`;
                                    const mHovered = hoveredKey === mHoverKey;
                                    return (
                                      <div
                                        key={`${m.name}-${mi}`}
                                        onMouseEnter={() => setHoveredKey(mHoverKey)}
                                        onMouseLeave={() =>
                                          setHoveredKey((prev) => (prev === mHoverKey ? null : prev))
                                        }
                                        onClick={() =>
                                          setHoveredKey((prev) => (prev === mHoverKey ? null : mHoverKey))
                                        }
                                        className="relative flex cursor-pointer items-center gap-2.5 rounded-lg border border-border-subtle bg-surface-subtle/60 p-2 transition-colors hover:border-irminsul"
                                      >
                                        {m.image && (
                                          <img
                                            src={m.image}
                                            alt={m.name}
                                            loading="lazy"
                                            onError={(e) => {
                                              (e.currentTarget as HTMLImageElement).style.display = "none";
                                            }}
                                            className={cn(
                                              "h-9 w-9 shrink-0 rounded-md border object-contain p-0.5",
                                              getRarityBackdrop(m.rarity)
                                            )}
                                          />
                                        )}
                                        <div className="min-w-0 flex-1">
                                          <div className="flex items-center justify-between gap-2">
                                            <div className="flex min-w-0 items-center gap-1.5">
                                              <span className="truncate text-xs font-semibold text-ink-primary">
                                                {m.name}
                                              </span>
                                              {mNotes.length > 0 && (
                                                <NoteInfoButton
                                                  notes={mNotes}
                                                  title={`Artifact Note · ${m.name}`}
                                                  onHoverStart={() => setHoveredKey(null)}
                                                />
                                              )}
                                            </div>
                                            <Badge>{m.piece}pc</Badge>
                                          </div>
                                        </div>

                                        {mHovered && m.bonuses && m.bonuses.length > 0 && (
                                          <div
                                            onClick={(e) => e.stopPropagation()}
                                            className="fixed inset-x-4 bottom-4 z-40 sm:absolute sm:inset-x-auto sm:bottom-auto sm:left-0 sm:top-full sm:w-[360px] sm:pt-1.5"
                                          >
                                            <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-hover">
                                              <div className={cn("h-1 w-full shrink-0", getRarityAccent(m.rarity))} />
                                              <div className="max-h-[65vh] space-y-3 overflow-y-auto overscroll-contain p-4 text-xs sm:max-h-[310px]">
                                                <div className="flex items-center justify-between gap-3">
                                                  <div className="flex items-center gap-2.5">
                                                    {m.image && (
                                                      <img
                                                        src={m.image}
                                                        alt={m.name}
                                                        className={cn(
                                                          "h-11 w-11 shrink-0 rounded-xl border object-contain p-1",
                                                          getRarityBackdrop(m.rarity)
                                                        )}
                                                      />
                                                    )}
                                                    <div>
                                                      <p className="font-heading text-sm font-semibold text-ink-primary">
                                                        {m.name}
                                                      </p>
                                                      <p className="font-mono text-[11px] text-irminsul">
                                                        {m.piece}-Piece Bonus
                                                      </p>
                                                    </div>
                                                  </div>
                                                  <RarityBadge rarity={m.rarity} />
                                                </div>
                                                <p className="leading-relaxed text-ink-secondary">
                                                  <span className="font-mono text-[10px] font-semibold text-irminsul">
                                                    2pc:{" "}
                                                  </span>
                                                  {m.bonuses[0]}
                                                </p>
                                              </div>
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            ) : (
                              <div
                                onMouseEnter={() => setHoveredKey(aHoverKey)}
                                onMouseLeave={() =>
                                  setHoveredKey((prev) => (prev === aHoverKey ? null : prev))
                                }
                                onClick={() =>
                                  setHoveredKey((prev) => (prev === aHoverKey ? null : aHoverKey))
                                }
                                className="relative flex cursor-pointer items-center gap-3"
                              >
                                <span
                                  title={isTied ? `Tied at #${art.rank}` : undefined}
                                  className={cn(
                                    "w-5 shrink-0 font-mono text-xs",
                                    isTied ? "font-semibold text-irminsul" : "text-ink-dim"
                                  )}
                                >
                                  {rankLabel}
                                </span>
                                {art.image && (
                                  <img
                                    src={art.image}
                                    alt={art.name || "Artifact"}
                                    loading="lazy"
                                    onError={(e) => {
                                      (e.currentTarget as HTMLImageElement).style.display = "none";
                                    }}
                                    className={cn(
                                      "h-10 w-10 shrink-0 rounded-lg border object-contain p-0.5",
                                      getRarityBackdrop(art.rarity)
                                    )}
                                  />
                                )}
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="flex min-w-0 items-center gap-1.5">
                                      <span className="truncate text-sm font-semibold text-ink-primary">
                                        {art.name}
                                      </span>
                                      {aNotes.length > 0 && (
                                        <NoteInfoButton
                                          notes={aNotes}
                                          title={`Artifact Note · ${art.name}`}
                                          onHoverStart={() => setHoveredKey(null)}
                                        />
                                      )}
                                    </div>
                                    <Badge>{art.piece}pc</Badge>
                                  </div>
                                </div>

                                {aHovered && art.bonuses && art.bonuses.length > 0 && (
                                  <div
                                    onClick={(e) => e.stopPropagation()}
                                    className="fixed inset-x-4 bottom-4 z-40 sm:absolute sm:inset-x-auto sm:bottom-auto sm:left-0 sm:top-full sm:w-[380px] sm:pt-1.5"
                                  >
                                    <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-hover">
                                      <div className={cn("h-1 w-full shrink-0", getRarityAccent(art.rarity))} />
                                      <div className="max-h-[65vh] space-y-3 overflow-y-auto overscroll-contain p-4 text-xs leading-relaxed sm:max-h-[330px]">
                                        <div className="flex items-center justify-between gap-3">
                                          <div className="flex items-center gap-2.5">
                                            {art.image && (
                                              <img
                                                src={art.image}
                                                alt={art.name || "Artifact"}
                                                className={cn(
                                                  "h-11 w-11 shrink-0 rounded-xl border object-contain p-1",
                                                  getRarityBackdrop(art.rarity)
                                                )}
                                              />
                                            )}
                                            <div>
                                              <p className="font-heading text-sm font-semibold text-ink-primary">
                                                {art.name}
                                              </p>
                                              <p className="font-mono text-[11px] text-irminsul">
                                                {art.piece}-Piece Set
                                              </p>
                                            </div>
                                          </div>
                                          <RarityBadge rarity={art.rarity} />
                                        </div>
                                        <div className="space-y-1.5">
                                          {art.bonuses.map((bonus, bi) => (
                                            <p key={bi} className="text-ink-secondary">
                                              <span className="font-mono text-[10px] font-semibold text-irminsul">
                                                {bi === 0 ? "2pc:" : "4pc:"}
                                              </span>{" "}
                                              {bonus}
                                            </p>
                                          ))}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                      {(activeBuild.artifactNotes || [])
                        .filter((n) => n.label.toLowerCase().includes("(conditional)"))
                        .map((cond) => (
                          <div
                            key={cond.label}
                            className="flex items-center justify-between gap-2 rounded-xl border border-dashed border-[#B8D8CE] bg-surface px-3 py-2.5"
                          >
                            <span className="text-xs font-semibold text-ink-primary">
                              {cond.label}
                            </span>
                            <NoteInfoButton
                              notes={[cond]}
                              align="right"
                              title={`Conditional Artifact · ${cond.label}`}
                            />
                          </div>
                        ))}
                    </div>
                  )}
                </section>

                {/* Main Stats & Substats */}
                <section className="min-w-0 rounded-xl border border-border bg-canvas/60 p-3.5 sm:p-4">
                  <h2 className="font-heading text-sm font-semibold text-ink-primary">
                    Main Stats &amp; Substats
                  </h2>
                  <div className="mt-3 space-y-2">
                    {activeBuild.mainStats.map((ms) => {
                      const slotName = ms.split(" - ")[0]?.trim().toLowerCase() || "";
                      const msNotes = (activeBuild.mainStatNotes || []).filter((n) =>
                        n.label.toLowerCase().startsWith(slotName)
                      );
                      return (
                        <div
                          key={ms}
                          className="flex items-center justify-between gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-xs font-medium text-ink-primary"
                        >
                          <span>{ms}</span>
                          {msNotes.length > 0 && (
                            <NoteInfoButton
                              notes={msNotes}
                              align="right"
                              title={`Main Stat Note · ${slotName.toUpperCase()}`}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {activeBuild.subStats.length > 0 && (
                    <div className="mt-4">
                      <p className="font-mono text-[11px] uppercase tracking-wider text-ink-dim">
                        Substat Priority
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {activeBuild.subStats.map((sub, i) => {
                          const sNotes = findMatchingNotes(activeBuild.subStatNotes, sub);
                          return (
                            <div key={`${sub}-${i}`} className="inline-flex items-center gap-1">
                              <Badge>
                                {i + 1}. {sub}
                              </Badge>
                              {sNotes.length > 0 && (
                                <NoteInfoButton
                                  notes={sNotes}
                                  title={`Substat Note · ${sub}`}
                                />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </section>

                {/* Talent Priority */}
                <section className="min-w-0 rounded-xl border border-border bg-canvas/60 p-3.5 sm:p-4">
                  <h2 className="font-heading text-sm font-semibold text-ink-primary">
                    Talent Priority
                  </h2>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {activeBuild.talentPriority.map((t, i) => (
                      <div
                        key={t}
                        className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-xs font-medium text-ink-primary"
                      >
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-irminsul-soft font-mono text-[11px] text-irminsul">
                          {i + 1}
                        </span>
                        {t}
                      </div>
                    ))}
                  </div>
                </section>
              </div>

              {/* Helper Team Build Notes */}
              {activeBuild.notes && activeBuild.notes.length > 0 && (
                <section className="min-w-0 space-y-3 rounded-xl border border-border bg-canvas/60 p-3.5 sm:p-4">
                  <div className="flex items-center gap-2">
                    <BookOpen className="h-4 w-4 text-irminsul" />
                    <h2 className="font-heading text-sm font-semibold text-ink-primary">
                      Build Notes &amp; Playstyle Tips
                    </h2>
                  </div>

                  <div className="space-y-3 rounded-xl border border-border-subtle bg-surface p-4 text-xs leading-relaxed text-ink-secondary">
                    {activeBuild.notes.map((note, idx) => {
                      const lines = note
                        .split("\n")
                        .map((l) => l.trim())
                        .filter(Boolean);
                      return (
                        <div
                          key={idx}
                          className={cn(
                            "space-y-1.5",
                            idx > 0 && "border-t border-border-subtle pt-3"
                          )}
                        >
                          {lines.map((line, li) => {
                            if (/^#{1,4}\s+/.test(line)) {
                              const heading = line.replace(/^#{1,4}\s+/, "");
                              return (
                                <p
                                  key={li}
                                  className="pt-1 font-mono text-[11px] font-semibold uppercase tracking-wider text-irminsul"
                                >
                                  {heading}
                                </p>
                              );
                            }
                            if (/^[-*]\s+/.test(line)) {
                              const itemText = line.replace(/^[-*]\s+/, "");
                              return (
                                <div key={li} className="flex items-start gap-2 pl-1">
                                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-irminsul" />
                                  <span>{itemText}</span>
                                </div>
                              );
                            }
                            if (line.endsWith(":") && line.length < 48) {
                              return (
                                <p key={li} className="font-semibold text-ink-primary">
                                  {line}
                                </p>
                              );
                            }
                            return (
                              <p key={li} className="text-ink-secondary">
                                {line}
                              </p>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}
              </div>
            )}
          </div>
        )}

        {/* Character Skills & Constellations */}
        {(detail.talents.length > 0 || detail.constellations.length > 0) && (
          <div className="space-y-4 border-t border-border pt-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-irminsul" />
                <h2 className="font-serif text-2xl text-ink-primary">
                  Combat Kit &amp; Constellations
                </h2>
              </div>

              <div className="flex items-center gap-1 rounded-xl border border-border bg-surface-subtle p-1">
                <button
                  type="button"
                  onClick={() => setKitTab("talents")}
                  className={cn(
                    "rounded-lg px-3 py-1 text-xs font-medium transition-colors",
                    kitTab === "talents"
                      ? "bg-surface text-irminsul shadow-sm"
                      : "text-ink-secondary hover:text-ink-primary"
                  )}
                >
                  Skills &amp; Talents ({detail.talents.length})
                </button>
                <button
                  type="button"
                  onClick={() => setKitTab("constellations")}
                  className={cn(
                    "rounded-lg px-3 py-1 text-xs font-medium transition-colors",
                    kitTab === "constellations"
                      ? "bg-surface text-irminsul shadow-sm"
                      : "text-ink-secondary hover:text-ink-primary"
                  )}
                >
                  Constellations ({detail.constellations.length})
                </button>
              </div>
            </div>

            <div className="grid items-start gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {(kitTab === "talents" ? detail.talents : detail.constellations).map(
                (item, idx) => {
                  const kitKey = `kit-${kitTab}-${idx}-${item.name}`;
                  const kitHovered = hoveredKey === kitKey;
                  const titleText =
                    kitTab === "constellations" ? `C${idx + 1} · ${item.name}` : item.name;
                  const typeLabel =
                    kitTab === "constellations"
                      ? `Constellation Lv.${idx + 1}`
                      : item.unlock === "2"
                      ? "Passive Talent"
                      : item.unlock === "1"
                      ? "Elemental Burst"
                      : idx === 0
                      ? "Normal Attack"
                      : idx === 1
                      ? "Elemental Skill"
                      : "Combat Skill";
                  const isActiveSkill = kitTab === "talents" && item.unlock !== "2";
                  return (
                    <div
                      key={`${item.name}-${idx}`}
                      onMouseEnter={() => setHoveredKey(kitKey)}
                      onMouseLeave={() =>
                        setHoveredKey((prev) => (prev === kitKey ? null : prev))
                      }
                      onClick={() =>
                        setHoveredKey((prev) => (prev === kitKey ? null : kitKey))
                      }
                      className="relative flex min-w-0 cursor-pointer items-center gap-3 rounded-xl border border-border bg-canvas/60 p-3 transition-colors hover:border-irminsul hover:bg-surface"
                    >
                      {item.icon ? (
                        <img
                          src={item.icon}
                          alt={item.name}
                          loading="lazy"
                          className="h-10 w-10 shrink-0 rounded-xl border border-border bg-ink-primary p-1.5"
                        />
                      ) : (
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-surface-subtle font-mono text-xs text-ink-dim">
                          {kitTab === "constellations" ? `C${idx + 1}` : `T${idx + 1}`}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <h3 className="truncate font-heading text-xs font-semibold text-ink-primary sm:text-sm">
                          {titleText}
                        </h3>
                        <p
                          className={cn(
                            "mt-0.5 font-mono text-[10px] font-medium",
                            isActiveSkill ? "text-irminsul" : "text-ink-dim"
                          )}
                        >
                          {typeLabel}
                        </p>
                      </div>

                      {kitHovered && item.description && (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className={cn(
                            "fixed inset-x-4 bottom-4 z-40 sm:absolute sm:inset-x-auto sm:bottom-full sm:top-auto sm:w-[400px] sm:pb-1.5",
                            idx % 2 === 1 ? "sm:left-auto sm:right-0" : "sm:left-0",
                            idx % 3 === 2 ? "lg:left-auto lg:right-0" : "lg:left-0 lg:right-auto"
                          )}
                        >
                          <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-hover">
                            <div className="max-h-[65vh] overflow-y-auto overscroll-contain p-4 sm:max-h-[340px]">
                            <div className="flex items-center justify-between gap-2.5 border-b border-border-subtle pb-2.5">
                              <div className="flex items-center gap-2.5">
                                {item.icon && (
                                  <img
                                    src={item.icon}
                                    alt={item.name}
                                    className="h-9 w-9 shrink-0 rounded-lg border border-border bg-ink-primary p-1"
                                  />
                                )}
                                <div>
                                  <h4 className="font-heading text-sm font-semibold text-ink-primary">
                                    {titleText}
                                  </h4>
                                  <p className="font-mono text-[10px] font-medium text-irminsul">
                                    {typeLabel}
                                  </p>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => setHoveredKey(null)}
                                className="rounded-md px-1.5 py-0.5 font-mono text-[10px] text-ink-dim hover:bg-surface-subtle sm:hidden"
                              >
                                Close
                              </button>
                            </div>
                            <p className="mt-2.5 whitespace-pre-line text-xs leading-relaxed text-ink-secondary">
                              {item.description}
                            </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                }
              )}
            </div>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}
