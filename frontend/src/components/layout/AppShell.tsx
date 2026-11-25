import React from "react";
import { Navbar, type ActiveTab } from "@/components/common/Navbar";

interface AppShellProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  onResetCharacter?: () => void;
  children: React.ReactNode;
}

export function AppShell({
  activeTab,
  onTabChange,
  onResetCharacter,
  children,
}: AppShellProps) {
  return (
    <div className="relative flex min-h-screen flex-col bg-canvas text-ink-primary">
      {/* Subtle warm botanical ambient wash at top — calm, non-intrusive */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-x-0 top-0 h-80 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(36,106,86,0.06),transparent)]"
      />

      <Navbar
        activeTab={activeTab}
        onTabChange={onTabChange}
        onResetCharacter={onResetCharacter}
      />
      <main className="relative z-10 mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
        {children}
      </main>
      <footer className="relative z-10 border-t border-border bg-surface/50 py-5 text-center text-xs text-ink-dim backdrop-blur-sm">
        Irminix · Build guides by Genshin Impact Helper Team · Data via Enka.Network &amp; gi.yatta.moe · Not affiliated with HoYoverse
      </footer>
    </div>
  );
}
