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
    <div className="relative flex min-h-screen flex-col overflow-x-hidden bg-canvas text-ink-primary">
      {/* Subtle warm botanical ambient wash at top — calm, non-intrusive */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-x-0 top-0 h-96 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(36,106,86,0.07),transparent),radial-gradient(circle_at_85%_10%,rgba(156,122,60,0.05),transparent_50%)]"
      />

      <Navbar
        activeTab={activeTab}
        onTabChange={onTabChange}
        onResetCharacter={onResetCharacter}
      />
      <main className="relative mx-auto w-full max-w-6xl flex-1 px-4 py-7 sm:px-6 sm:py-8">
        {children}
      </main>
      <footer className="relative z-10 border-t border-border bg-surface/60 py-5 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 text-center text-xs text-ink-dim sm:flex-row sm:px-6 sm:text-left">
          <span className="font-medium text-ink-secondary">
            Irminix · Genshin Impact Build Codex
          </span>
          <span>
            Build guides by Genshin Impact Helper Team · Data via Enka.Network &amp; gi.yatta.moe · Not affiliated with HoYoverse
          </span>
        </div>
      </footer>
    </div>
  );
}
