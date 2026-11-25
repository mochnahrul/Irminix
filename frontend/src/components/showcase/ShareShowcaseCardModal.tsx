import { useRef, useState } from "react";
import { toPng } from "html-to-image";
import { Check, Copy, Download, Star, X } from "lucide-react";
import { IrminsulLogo } from "@/components/common/IrminsulLogo";
import { Button } from "@/components/ui/button";
import { cn, getElementStyle } from "@/lib/utils";
import type { PlayerProfile, ShowcaseCharacter } from "@/types/genshin";

interface ShareShowcaseCardModalProps {
  character: ShowcaseCharacter;
  profile: PlayerProfile;
  rank: number;
  valueScore: number;
  onClose: () => void;
}

export function ShareShowcaseCardModal({
  character,
  profile,
  rank,
  valueScore,
  onClose,
}: ShareShowcaseCardModalProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const el = getElementStyle(character.element);

  const handleDownloadPng = async () => {
    if (!cardRef.current) return;
    setExporting(true);
    setExportError(null);
    try {
      const dataUrl = await toPng(cardRef.current, {
        backgroundColor: "#F7F5F0",
        pixelRatio: 2,
        cacheBust: true,
      });
      const link = document.createElement("a");
      link.download = `irminix-${character.name.toLowerCase().replace(/\s+/g, "-")}-uid-${profile.uid}.png`;
      link.href = dataUrl;
      link.click();
    } catch {
      setExportError("Unable to export PNG due to image CORS. Use Copy Discord Text instead.");
    } finally {
      setExporting(false);
    }
  };

  const handleCopyDiscord = async () => {
    const weaponLine = character.weapon
      ? `${character.weapon.name} (Lv.${character.weapon.level} R${character.weapon.refinement})`
      : "—";
    const lines = [
      `**${character.name}** (${character.element} · ${character.rarity}★) — **${character.critValue} CV**`,
      `Player: \`${profile.nickname}\` (UID \`${profile.uid}\`) · Lv.${character.level} · C${character.constellationsUnlocked} · Talents ${character.talentLevels.slice(0, 3).join("/")}`,
      `Weapon: ${weaponLine}`,
      `Stats: CR ${character.stats["Crit Rate"] || "—"} | CD ${character.stats["Crit DMG"] || "—"} | ER ${character.stats["Energy Recharge"] || "—"} | EM ${character.stats["Elemental Mastery"] || "—"}`,
      `Ranked #${rank} (Score ${valueScore}) via Irminix`,
    ];
    await navigator.clipboard.writeText(lines.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink-primary/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-border bg-canvas p-5 shadow-hover sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="font-serif text-2xl text-ink-primary">Share Build Card</h2>
            <p className="text-xs text-ink-secondary">
              Download as PNG or copy a clean Discord summary.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-surface text-ink-secondary hover:text-ink-primary"
            aria-label="Close modal"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Printable / Exportable Showcase Card */}
        <div
          ref={cardRef}
          className="overflow-hidden rounded-3xl border border-border bg-surface shadow-card"
        >
          {/* Elemental Hero Header */}
          <div
            className={cn(
              "flex flex-col justify-between gap-4 border-b border-border bg-gradient-to-br p-5 sm:flex-row sm:items-center",
              el.cardTint
            )}
          >
            <div className="flex items-center gap-4">
              {character.iconUrl && (
                <img
                  src={character.iconUrl}
                  alt={character.name}
                  crossOrigin="anonymous"
                  className="h-20 w-20 rounded-2xl border border-border bg-surface/90 object-cover shadow-sm"
                />
              )}
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-md bg-surface/90 px-2 py-0.5 font-mono text-[11px] font-semibold text-irminsul">
                    #{rank}
                  </span>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full border bg-surface/90 px-2.5 py-0.5 text-xs font-medium",
                      el.badgeText,
                      el.border
                    )}
                  >
                    <span className={cn("h-1.5 w-1.5 rounded-full", el.dot)} />
                    {character.element}
                  </span>
                  <span className="inline-flex items-center gap-0.5 font-mono text-xs text-irminsul-gold">
                    {character.rarity}
                    <Star className="h-3 w-3 fill-current" />
                  </span>
                </div>

                <h3 className="mt-1 font-serif text-3xl text-ink-primary">
                  {character.name}
                </h3>
                <p className="font-mono text-xs text-ink-secondary">
                  Lv.{character.level} · C{character.constellationsUnlocked} · Talents{" "}
                  {character.talentLevels.slice(0, 3).join("/") || "—"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4 sm:flex-col sm:items-end sm:gap-1">
              <div className="text-left sm:text-right">
                <p className="font-mono text-[10px] uppercase tracking-wider text-ink-dim">
                  Crit Value
                </p>
                <p className="font-mono text-3xl font-semibold leading-none text-irminsul">
                  {character.critValue}
                </p>
              </div>
              <span className="rounded-full border border-border bg-surface/80 px-2.5 py-0.5 font-mono text-[11px] text-ink-secondary">
                Rank Score {valueScore}
              </span>
            </div>
          </div>

          <div className="space-y-4 p-5">
            {/* Key Stats Strip */}
            <div className="grid grid-cols-3 gap-2 rounded-2xl border border-border-subtle bg-canvas/80 p-3 text-center sm:grid-cols-6">
              {[
                { key: "Max HP", label: "HP" },
                { key: "ATK", label: "ATK" },
                { key: "Elemental Mastery", label: "EM" },
                { key: "Crit Rate", label: "CR" },
                { key: "Crit DMG", label: "CD" },
                { key: "Energy Recharge", label: "ER" },
              ].map((s) => (
                <div key={s.key}>
                  <p className="font-mono text-[10px] text-ink-dim">{s.label}</p>
                  <p className="mt-0.5 font-mono text-xs font-semibold text-ink-primary">
                    {character.stats[s.key] || "—"}
                  </p>
                </div>
              ))}
            </div>

            {/* Weapon */}
            {character.weapon && (
              <div className="flex items-center justify-between gap-3 rounded-xl border border-border-subtle bg-surface-subtle/60 px-3.5 py-2.5">
                <div className="flex items-center gap-3">
                  {character.weapon.iconUrl && (
                    <img
                      src={character.weapon.iconUrl}
                      alt={character.weapon.name}
                      crossOrigin="anonymous"
                      className="h-9 w-9 rounded-lg border border-border-subtle bg-surface object-contain p-0.5"
                    />
                  )}
                  <div>
                    <p className="text-xs font-semibold text-ink-primary">
                      {character.weapon.name}
                    </p>
                    <p className="font-mono text-[11px] text-ink-dim">
                      {character.weapon.baseAtk ? `ATK ${character.weapon.baseAtk}` : ""}
                      {character.weapon.subStat ? ` · ${character.weapon.subStat}` : ""}
                    </p>
                  </div>
                </div>
                <span className="font-mono text-xs font-medium text-ink-secondary">
                  Lv.{character.weapon.level} · R{character.weapon.refinement}
                </span>
              </div>
            )}

            {/* 5 Artifacts Compact Grid */}
            {character.artifacts.length > 0 && (
              <div className="grid gap-2 sm:grid-cols-5">
                {character.artifacts.map((art, idx) => (
                  <div
                    key={`${art.slot}-${idx}`}
                    className="flex flex-col justify-between rounded-xl border border-border-subtle bg-canvas/70 p-2.5"
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-mono text-[10px] uppercase text-ink-dim">
                        {art.slot}
                      </span>
                      <span className="font-mono text-[10px] text-ink-dim">
                        +{art.level}
                      </span>
                    </div>
                    <p className="mt-1 truncate font-mono text-[11px] font-semibold text-irminsul">
                      {art.mainStat} {art.mainStatValue}
                    </p>
                    <p className="mt-0.5 truncate text-[10px] text-ink-secondary">
                      {art.setName}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {/* Card Watermark Footer */}
            <div className="flex items-center justify-between border-t border-border-subtle pt-3 text-[11px] text-ink-dim">
              <div className="flex items-center gap-2">
                <IrminsulLogo className="h-5 w-5" />
                <span className="font-serif text-sm text-ink-primary">Irminix</span>
              </div>
              <span className="font-mono">
                {profile.nickname} · UID {profile.uid}
              </span>
            </div>
          </div>
        </div>

        {exportError && (
          <p className="mt-3 text-xs text-[#9A3B26]">{exportError}</p>
        )}

        <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
          <Button variant="secondary" onClick={handleCopyDiscord}>
            {copied ? <Check className="h-4 w-4 text-irminsul" /> : <Copy className="h-4 w-4" />}
            {copied ? "Copied!" : "Copy Discord Summary"}
          </Button>
          <Button variant="primary" onClick={handleDownloadPng} disabled={exporting}>
            <Download className="h-4 w-4" />
            {exporting ? "Exporting..." : "Download PNG Card"}
          </Button>
        </div>
      </div>
    </div>
  );
}
