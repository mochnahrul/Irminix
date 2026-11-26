import { cn } from "@/lib/utils";

interface RefinementSelectorProps {
  count: number;
  activeIdx: number;
  onSelect: (idx: number) => void;
  className?: string;
}

export function RefinementSelector({
  count,
  activeIdx,
  onSelect,
  className,
}: RefinementSelectorProps) {
  if (count <= 1) return null;

  return (
    <div
      className={cn(
        "flex items-center gap-1 rounded-xl border border-border-subtle bg-surface-subtle p-1",
        className
      )}
    >
      {Array.from({ length: count }, (_, rIdx) => (
        <button
          key={`refine-${rIdx + 1}`}
          type="button"
          onClick={() => onSelect(rIdx)}
          className={cn(
            "flex-1 rounded-lg py-1 font-mono text-[11px] font-semibold transition-colors",
            activeIdx === rIdx
              ? "bg-irminsul text-white shadow-sm"
              : "text-ink-secondary hover:text-ink-primary"
          )}
        >
          R{rIdx + 1}
        </button>
      ))}
    </div>
  );
}
