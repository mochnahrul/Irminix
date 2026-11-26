import { Star } from "lucide-react";
import { cn, getRarityStyle } from "@/lib/utils";

interface RarityBadgeProps {
  rarity: number;
  suffix?: string;
  className?: string;
}

export function RarityBadge({ rarity, suffix = "", className }: RarityBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-0.5 rounded-full border px-2 py-0.5 font-mono text-[10px] font-semibold",
        getRarityStyle(rarity),
        className
      )}
    >
      {rarity}
      <Star className="h-2.5 w-2.5 fill-current" />
      {suffix}
    </span>
  );
}
