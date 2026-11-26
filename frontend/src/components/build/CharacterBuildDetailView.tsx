import { useEffect, useRef, useState } from "react";
import { toPng } from "html-to-image";
import {
  ArrowLeft,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Download,
  Layers,
  Sparkles,
  Swords,
} from "lucide-react";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { RarityBadge } from "@/components/ui/RarityBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn, getElementStyle, getRarityBackdrop } from "@/lib/utils";
import { fetchCharacterDetail } from "@/services/api";
import type { CharacterDetail } from "@/types/genshin";

interface CharacterBuildDetailViewProps {
  characterId: string;
  onBack: () => void;
  onOpenAdvisor: (characterName: string, role?: string) => void;
}

function ExpandableText({
  text,
  lines = 2,
  className,
}: {
  text: string;
  lines?: 2 | 3 | 4;
  className?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const isLong = text.length > 140 || text.includes("\n");
  const clampClass =
    lines === 2 ? "line-clamp-2" : lines === 3 ? "line-clamp-3" : "line-clamp-4";

  return (
    <div>
      <p
        className={cn(
          "whitespace-pre-line text-xs leading-relaxed text-ink-secondary",
          !expanded && isLong && clampClass,
          className
        )}
      >
        {text}
      </p>
      {isLong && (
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className="mt-1 inline-flex items-center gap-0.5 text-[11px] font-medium text-irminsul hover:underline"
        >
          {expanded ? (
            <>
              Show less <ChevronUp className="h-3 w-3" />
            </>
          ) : (
            <>
              Read more <ChevronDown className="h-3 w-3" />
            </>
          )}
        </button>
      )}
    </div>
  );
}

export function CharacterBuildDetailView({
  characterId,
  onBack,
  onOpenAdvisor,
}: CharacterBuildDetailViewProps) {
  const [detail, setDetail] = useState<CharacterDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeBuildIdx, setActiveBuildIdx] = useState(0);
  const [kitTab, setKitTab] = useState<"talents" | "constellations">("talents");
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setActiveBuildIdx(0);
    setKitTab("talents");
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
    const dataUrl = await toPng(cardRef.current, {
      backgroundColor: "#F7F5F0",
      pixelRatio: 2,
    });
    const link = document.createElement("a");
    link.download = `irminix-${detail.id}-build.png`;
    link.href = dataUrl;
    link.click();
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
        <div className="flex items-center gap-2">
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
        className="overflow-hidden rounded-3xl border border-border bg-surface shadow-card"
      >
        {/* Elemental Hero Header */}
        <div
          className={cn(
            "flex flex-col gap-5 border-b border-border bg-gradient-to-br p-6 sm:p-8 md:flex-row md:items-center",
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
                    onClick={() => setActiveBuildIdx(idx)}
                    className={cn(
                      "rounded-lg px-3 py-1.5 font-mono text-xs uppercase tracking-wide transition-colors",
                      activeBuildIdx === idx
                        ? "bg-irminsul text-white"
                        : "bg-surface-subtle text-ink-secondary hover:text-ink-primary"
                    )}
                  >
                    {b.role}
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
                  <div className="min-w-0 rounded-xl bg-surface/90 p-3 shadow-sm">
                    <p className="font-mono text-[10px] uppercase tracking-wider text-irminsul">
                      #1 Best Weapon
                    </p>
                    <p className="mt-1 break-words text-sm font-semibold leading-snug text-ink-primary">
                      {activeBuild.weapons[0]?.name || "Flexible Crit / Synergy"}
                    </p>
                  </div>
                  <div className="min-w-0 rounded-xl bg-surface/90 p-3 shadow-sm">
                    <p className="font-mono text-[10px] uppercase tracking-wider text-irminsul">
                      Best Artifact Set
                    </p>
                    <p className="mt-1 break-words text-sm font-semibold leading-snug text-ink-primary">
                      {activeBuild.artifacts[0]?.name ||
                        (activeBuild.artifacts[0]?.mix
                          ? activeBuild.artifacts[0].mix.map((m) => m.name).join(" + ")
                          : "Elemental Synergy")}
                    </p>
                  </div>
                  <div className="min-w-0 rounded-xl bg-surface/90 p-3 shadow-sm">
                    <p className="font-mono text-[10px] uppercase tracking-wider text-irminsul">
                      Level Talents First
                    </p>
                    <p className="mt-1 break-words text-sm font-semibold leading-snug text-ink-primary">
                      {activeBuild.talentPriority.length > 0
                        ? activeBuild.talentPriority.join(" → ")
                        : "Burst → Skill"}
                    </p>
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
                    <div className="space-y-2.5">
                      {activeBuild.weapons.map((w, i) => (
                        <div
                          key={`${w.name}-${i}`}
                          className="rounded-xl border border-border bg-surface p-3"
                        >
                          <div className="flex items-start gap-3">
                            <span className="mt-1 font-mono text-xs text-ink-dim">
                              #{i + 1}
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
                                  "h-11 w-11 shrink-0 rounded-lg border object-contain p-1",
                                  getRarityBackdrop(w.rarity)
                                )}
                              />
                            )}
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <p className="text-sm font-semibold text-ink-primary">
                                  {w.name}
                                </p>
                                <div className="flex items-center gap-1.5">
                                  {w.subStat && (
                                    <span className="rounded-md bg-irminsul-soft px-2 py-0.5 font-mono text-[10px] font-medium text-irminsul">
                                      {w.subStat}
                                    </span>
                                  )}
                                  <RarityBadge
                                    rarity={w.rarity}
                                    suffix={w.refine > 0 ? ` R${w.refine}` : ""}
                                  />
                                </div>
                              </div>
                              {w.passiveName && (
                                <p className="mt-1 text-xs font-medium text-ink-primary">
                                  {w.passiveName}
                                </p>
                              )}
                              {w.description && (
                                <ExpandableText text={w.description} lines={2} className="mt-0.5" />
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
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
                    <div className="space-y-2.5">
                      {activeBuild.artifacts.slice(0, 5).map((art, i) => (
                        <div
                          key={i}
                          className="rounded-xl border border-border bg-surface p-3"
                        >
                          {art.mix && art.mix.length > 0 ? (
                            <div className="space-y-2">
                              <span className="font-mono text-[10px] uppercase tracking-wider text-irminsul">
                                2pc + 2pc Mix Options
                              </span>
                              <div className="space-y-2">
                                {art.mix.map((m) => (
                                  <div
                                    key={m.name}
                                    className="flex items-start gap-2.5 rounded-lg border border-border-subtle bg-surface-subtle/60 p-2"
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
                                        <span className="text-xs font-semibold text-ink-primary">
                                          {m.name}
                                        </span>
                                        <Badge>{m.piece}pc</Badge>
                                      </div>
                                      {m.bonuses && m.bonuses[0] && (
                                        <p className="mt-0.5 text-[11px] leading-relaxed text-ink-secondary">
                                          2-Piece: {m.bonuses[0]}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-start gap-3">
                              {art.image && (
                                <img
                                  src={art.image}
                                  alt={art.name || "Artifact"}
                                  loading="lazy"
                                  onError={(e) => {
                                    (e.currentTarget as HTMLImageElement).style.display = "none";
                                  }}
                                  className={cn(
                                    "h-11 w-11 shrink-0 rounded-lg border object-contain p-1",
                                    getRarityBackdrop(art.rarity)
                                  )}
                                />
                              )}
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-sm font-semibold text-ink-primary">
                                    {art.name}
                                  </span>
                                  <Badge>{art.piece}pc</Badge>
                                </div>
                                {art.bonuses && art.bonuses.length > 0 && (
                                  <div className="mt-1.5 space-y-1 text-xs leading-relaxed text-ink-secondary">
                                    {art.bonuses.map((bonus, bi) => (
                                      <p key={bi}>
                                        <span className="font-mono text-[10px] font-medium text-irminsul">
                                          {bi === 0 ? "2pc:" : "4pc:"}
                                        </span>{" "}
                                        {bonus}
                                      </p>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
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
                    {activeBuild.mainStats.map((ms) => (
                      <div
                        key={ms}
                        className="rounded-lg border border-border bg-surface px-3 py-2 text-xs font-medium text-ink-primary"
                      >
                        {ms}
                      </div>
                    ))}
                  </div>
                  {activeBuild.subStats.length > 0 && (
                    <div className="mt-4">
                      <p className="font-mono text-[11px] uppercase tracking-wider text-ink-dim">
                        Substat Priority
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {activeBuild.subStats.map((sub, i) => (
                          <Badge key={`${sub}-${i}`}>
                            {i + 1}. {sub}
                          </Badge>
                        ))}
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

            <div className="grid items-start gap-3 md:grid-cols-2">
              {(kitTab === "talents" ? detail.talents : detail.constellations).map(
                (item, idx) => (
                  <div
                    key={`${item.name}-${idx}`}
                    className="flex min-w-0 items-start gap-3.5 rounded-xl border border-border bg-canvas/60 p-3.5 sm:p-4"
                  >
                    {item.icon ? (
                      <img
                        src={item.icon}
                        alt={item.name}
                        loading="lazy"
                        className="h-11 w-11 shrink-0 rounded-xl border border-border bg-ink-primary p-1.5"
                      />
                    ) : (
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border bg-surface-subtle font-mono text-xs text-ink-dim">
                        {kitTab === "constellations" ? `C${idx + 1}` : `T${idx + 1}`}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <h3 className="font-heading text-sm font-semibold text-ink-primary">
                        {kitTab === "constellations" ? `C${idx + 1} · ${item.name}` : item.name}
                      </h3>
                      <ExpandableText text={item.description} lines={4} className="mt-1.5" />
                    </div>
                  </div>
                )
              )}
            </div>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}
