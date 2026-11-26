import { RarityBadge } from "@/components/ui/RarityBadge";
import { RefinementSelector } from "@/components/ui/RefinementSelector";
import { cn, getRarityAccent, getRarityBackdrop } from "@/lib/utils";
import type { BuildWeapon } from "@/types/genshin";

interface WeaponHoverPopoverProps {
  weapon: BuildWeapon;
  refineIdx: number;
  onSelectRefine: (idx: number) => void;
  openUpward?: boolean;
}

export function WeaponHoverPopover({
  weapon,
  refineIdx,
  onSelectRefine,
  openUpward = false,
}: WeaponHoverPopoverProps) {
  const refinements = weapon.passiveRefinements || [];
  const activeDesc = refinements[refineIdx] || refinements[0] || weapon.description || "";

  if (!weapon.passiveName && !activeDesc && !weapon.baseAtk) return null;

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className={cn(
        "fixed inset-x-4 bottom-4 z-40 sm:absolute sm:inset-x-auto sm:left-0 sm:w-[400px]",
        openUpward
          ? "sm:bottom-full sm:top-auto sm:pb-1.5"
          : "sm:bottom-auto sm:top-full sm:pt-1.5"
      )}
    >
      <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-hover">
        <div className={cn("h-1 w-full shrink-0", getRarityAccent(weapon.rarity))} />
        <div className="max-h-[65vh] space-y-3 overflow-y-auto overscroll-contain p-4 sm:max-h-[350px]">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              {weapon.image && (
                <img
                  src={weapon.image}
                  alt={weapon.name}
                  className={cn(
                    "h-11 w-11 shrink-0 rounded-xl border object-contain p-1",
                    getRarityBackdrop(weapon.rarity)
                  )}
                />
              )}
              <div>
                <p className="font-heading text-sm font-semibold text-ink-primary">
                  {weapon.name}
                </p>
                {weapon.subStat && (
                  <p className="font-mono text-[11px] text-irminsul">
                    Substat: {weapon.subStat}
                  </p>
                )}
              </div>
            </div>
            <RarityBadge rarity={weapon.rarity} />
          </div>

          {(weapon.baseAtk || weapon.subStatValue) && (
            <div className="divide-y divide-border-subtle rounded-xl border border-border-subtle bg-canvas/70 px-3 py-1.5 text-xs">
              {weapon.baseAtk && (
                <div className="flex items-center justify-between py-1">
                  <span className="text-ink-secondary">Base ATK (Lv.1 / 90)</span>
                  <span className="font-mono font-semibold text-ink-primary">
                    {weapon.baseAtk}
                  </span>
                </div>
              )}
              {weapon.subStat && weapon.subStatValue && (
                <div className="flex items-center justify-between py-1">
                  <span className="text-ink-secondary">{weapon.subStat}</span>
                  <span className="font-mono font-semibold text-irminsul">
                    {weapon.subStatValue}
                  </span>
                </div>
              )}
            </div>
          )}

          <RefinementSelector
            count={refinements.length}
            activeIdx={refineIdx}
            onSelect={onSelectRefine}
          />

          <div className="space-y-1 text-xs leading-relaxed">
            {weapon.passiveName && (
              <p className="font-semibold text-irminsul">
                {weapon.passiveName}
                {refinements.length > 0 ? ` (R${refineIdx + 1})` : ""}
              </p>
            )}
            {activeDesc && (
              <p className="whitespace-pre-line text-ink-secondary">{activeDesc}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
