import { motion } from "framer-motion";
import { BookOpen, LogOut, Map as MapIcon, RefreshCw, Sparkles, UserCheck } from "lucide-react";
import { IrminsulLogo } from "@/components/common/IrminsulLogo";
import { Button } from "@/components/ui/button";
import { useSession } from "@/contexts/SessionContext";
import { cn } from "@/lib/utils";

export type ActiveTab = "codex" | "showcase" | "advisor" | "map";

interface NavbarProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  onResetCharacter?: () => void;
}

export function Navbar({ activeTab, onTabChange, onResetCharacter }: NavbarProps) {
  const { profile, isConnecting, refreshProfile, disconnect } = useSession();

  const navItems: Array<{ id: ActiveTab; label: string; shortLabel: string; icon: typeof BookOpen }> = [
    { id: "codex", label: "Character Builds", shortLabel: "Builds", icon: BookOpen },
    { id: "showcase", label: "My Profile", shortLabel: "Profile", icon: UserCheck },
    { id: "advisor", label: "Build Advisor", shortLabel: "Advisor", icon: Sparkles },
    { id: "map", label: "Teyvat Map", shortLabel: "Map", icon: MapIcon },
  ];

  const handleSelect = (tab: ActiveTab) => {
    onResetCharacter?.();
    onTabChange(tab);
  };

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-canvas/85 backdrop-blur-xl">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        {/* Main Row */}
        <div className="flex h-16 items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => handleSelect("codex")}
            className="group flex shrink-0 items-center gap-2.5 text-left"
          >
            <IrminsulLogo className="h-8 w-8 transition-transform duration-200 group-hover:scale-105" />
            <div className="flex items-baseline gap-2">
              <span className="font-serif text-2xl tracking-tight text-ink-primary">
                Irminix
              </span>
              <span className="hidden rounded-md border border-border bg-surface px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-ink-dim md:inline-block">
                Codex
              </span>
            </div>
          </button>

          {/* Desktop Nav */}
          <nav className="hidden items-center gap-1 rounded-full border border-border bg-surface p-1 shadow-sm md:flex">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelect(item.id)}
                  className={cn(
                    "relative flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
                    active ? "text-irminsul" : "text-ink-secondary hover:text-ink-primary"
                  )}
                >
                  {active && (
                    <motion.span
                      layoutId="activeNavPill"
                      transition={{ type: "spring", stiffness: 420, damping: 32 }}
                      className="absolute inset-0 rounded-full bg-irminsul-soft"
                    />
                  )}
                  <Icon className="relative z-10 h-3.5 w-3.5" />
                  <span className="relative z-10">{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Right Profile / Auth Actions */}
          <div className="flex shrink-0 items-center gap-1.5">
            {profile ? (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => handleSelect("showcase")}
                  className="flex items-center gap-2 rounded-full border border-border bg-surface py-1 pl-1.5 pr-2.5 shadow-sm transition-colors hover:border-border-focus sm:pr-3"
                >
                  {profile.profilePictureUrl ? (
                    <img
                      src={profile.profilePictureUrl}
                      alt={profile.nickname}
                      className="h-6 w-6 rounded-full object-cover"
                    />
                  ) : (
                    <div className="h-2.5 w-2.5 rounded-full bg-irminsul" />
                  )}
                  <span className="max-w-[90px] truncate text-xs font-medium text-ink-primary sm:max-w-none">
                    {profile.nickname}
                  </span>
                  <span className="hidden font-mono text-[11px] text-ink-dim sm:inline">
                    AR {profile.level}
                  </span>
                </button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={refreshProfile}
                  disabled={isConnecting}
                  title="Refresh Showcase"
                  className="h-8 w-8 rounded-full p-0"
                >
                  <RefreshCw className={cn("h-3.5 w-3.5", isConnecting && "animate-spin")} />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={disconnect}
                  title="Disconnect UID"
                  className="h-8 w-8 rounded-full p-0"
                >
                  <LogOut className="h-3.5 w-3.5" />
                </Button>
              </div>
            ) : (
              <Button
                variant="secondary"
                size="sm"
                onClick={disconnect}
                className="rounded-full"
              >
                Connect UID
              </Button>
            )}
          </div>
        </div>

        {/* Mobile Nav Row */}
        <nav className="grid grid-cols-4 gap-1 pb-2.5 md:hidden">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelect(item.id)}
                className={cn(
                  "flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-medium transition-colors",
                  active
                    ? "bg-irminsul-soft text-irminsul"
                    : "bg-surface/70 text-ink-secondary hover:text-ink-primary"
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{item.shortLabel}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
