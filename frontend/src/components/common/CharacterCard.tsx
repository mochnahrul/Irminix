import { ArrowUpRight } from "lucide-react";
import { RarityBadge } from "@/components/ui/RarityBadge";
import { cn, getElementStyle, getRarityAccent } from "@/lib/utils";
import type { CharacterSummary } from "@/types/genshin";

interface CharacterCardProps {
  character: CharacterSummary;
  onSelect: (id: string) => void;
}

export function CharacterCard({ character, onSelect }: CharacterCardProps) {
  const el = getElementStyle(character.vision);
  const primaryRole = character.roles[0] || "FLEXIBLE";

  return (
    <button
      type="button"
      onClick={() => onSelect(character.id)}
      className="group relative flex h-full min-w-0 flex-col overflow-hidden rounded-2xl border border-border bg-surface text-left shadow-card transition-all duration-200 hover:border-border-focus hover:shadow-hover"
    >
      {/* Subtle 5★ / 4★ top accent line */}
      <div className={cn("h-1 w-full shrink-0", getRarityAccent(character.rarity))} />

      {/* Portrait Stage (isolated stacking context prevents hover layer glitches) */}
      <div
        className={cn(
          "relative isolate flex aspect-square w-full items-end justify-center overflow-hidden bg-gradient-to-b pt-4",
          el.cardTint
        )}
      >
        {/* Top Metadata Row */}
        <div className="pointer-events-none absolute inset-x-2.5 top-2.5 z-10 flex items-center justify-between gap-1.5">
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full border bg-surface/95 px-2 py-0.5 text-[11px] font-medium shadow-sm",
              el.badgeText,
              el.border
            )}
          >
            <span className={cn("h-1.5 w-1.5 rounded-full", el.dot)} />
            {character.vision}
          </span>

          <RarityBadge rarity={character.rarity} className="shadow-sm" />
        </div>

        <img
          src={character.image}
          alt={character.name}
          loading="lazy"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.opacity = "0.2";
          }}
          className="h-[86%] w-auto object-contain object-bottom drop-shadow-sm transition-transform duration-300 ease-out will-change-transform group-hover:scale-[1.03]"
        />

        {/* Static bottom fade into white card body */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -inset-x-px -bottom-px h-8 bg-gradient-to-t from-surface to-transparent"
        />
      </div>

      {/* Uniform Editorial Footer */}
      <div className="flex flex-1 flex-col px-3.5 pb-3.5 pt-1.5">
        <div className="flex items-start justify-between gap-1.5">
          <h3 className="truncate font-heading text-[15px] font-semibold tracking-tight text-ink-primary transition-colors group-hover:text-irminsul">
            {character.name}
          </h3>
          <ArrowUpRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-dim opacity-0 transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-irminsul group-hover:opacity-100" />
        </div>
        <p className="mt-0.5 truncate text-xs text-ink-secondary">
          {character.weapon} · {character.region}
        </p>

        <div className="mt-auto flex items-center justify-between gap-2 pt-2.5">
          <span className="truncate rounded-md border border-border-subtle bg-surface-subtle px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-ink-secondary">
            {primaryRole}
          </span>
          {character.roles.length > 1 && (
            <span className="shrink-0 font-mono text-[10px] text-ink-dim">
              +{character.roles.length - 1}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}
