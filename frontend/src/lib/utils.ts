import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export interface ElementStyle {
  badgeBg: string;
  badgeText: string;
  border: string;
  dot: string;
  cardTint: string;
}

/** Calm, desaturated botanical/mineral palette for Genshin Visions on light paper. */
export const ELEMENT_STYLES: Record<string, ElementStyle> = {
  Pyro: {
    badgeBg: "bg-[#FBF0ED]",
    badgeText: "text-[#9A3B26]",
    border: "border-[#E8C5BC]",
    dot: "bg-[#C25338]",
    cardTint: "from-[#FAF2EF] to-[#F3E6E1]",
  },
  Hydro: {
    badgeBg: "bg-[#EDF4F9]",
    badgeText: "text-[#255A80]",
    border: "border-[#B9D3E6]",
    dot: "bg-[#3A7CA5]",
    cardTint: "from-[#F0F6FA] to-[#E3EEF5]",
  },
  Electro: {
    badgeBg: "bg-[#F3EFF9]",
    badgeText: "text-[#5C3D8A]",
    border: "border-[#D3C4E8]",
    dot: "bg-[#7A56B0]",
    cardTint: "from-[#F5F2FA] to-[#EAE3F4]",
  },
  Cryo: {
    badgeBg: "bg-[#EEF6F7]",
    badgeText: "text-[#2D6770]",
    border: "border-[#BDD9DE]",
    dot: "bg-[#4A8D96]",
    cardTint: "from-[#F1F7F8] to-[#E3EFF1]",
  },
  Anemo: {
    badgeBg: "bg-[#ECF6F3]",
    badgeText: "text-[#246A56]",
    border: "border-[#B8D8CE]",
    dot: "bg-[#388E75]",
    cardTint: "from-[#EFF7F4] to-[#E1EFEA]",
  },
  Geo: {
    badgeBg: "bg-[#F8F3E8]",
    badgeText: "text-[#805F24]",
    border: "border-[#E3D3AE]",
    dot: "bg-[#A88236]",
    cardTint: "from-[#FAF6ED] to-[#F1E9D6]",
  },
  Dendro: {
    badgeBg: "bg-[#EEF6EC]",
    badgeText: "text-[#35692B]",
    border: "border-[#C0DBBA]",
    dot: "bg-[#4E8C42]",
    cardTint: "from-[#F1F7F0] to-[#E4EFE1]",
  },
};

export function getElementStyle(vision: string): ElementStyle {
  return (
    ELEMENT_STYLES[vision] ?? {
      badgeBg: "bg-surface-subtle",
      badgeText: "text-ink-secondary",
      border: "border-border",
      dot: "bg-ink-dim",
      cardTint: "from-[#F5F3EE] to-[#ECE8E0]",
    }
  );
}
