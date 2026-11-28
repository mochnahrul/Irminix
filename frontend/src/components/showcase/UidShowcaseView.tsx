import React, { useMemo, useState } from "react";
import {
  ArrowUpRight,
  Award,
  ChevronDown,
  ChevronUp,
  HelpCircle,
  Info,
  RefreshCw,
  Search,
  Share2,
  Shield,
  Sparkles,
  Trophy,
  Users,
  X,
} from "lucide-react";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { RarityBadge } from "@/components/ui/RarityBadge";
import { AchievementTrackerPanel } from "@/components/showcase/AchievementTrackerPanel";
import { ShareShowcaseCardModal } from "@/components/showcase/ShareShowcaseCardModal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useSession } from "@/contexts/SessionContext";
import { cn, getElementStyle, getRarityBackdrop } from "@/lib/utils";
import type { CharacterSummary, ShowcaseCharacter } from "@/types/genshin";

interface UidShowcaseViewProps {
  allCharacters: CharacterSummary[];
  onOpenAdvisor: (characterName: string) => void;
  onOpenCodexCharacter: (characterId: string) => void;
}

function computeCharacterValue(ch: ShowcaseCharacter): number {
  const isFiveStar = ch.rarity === 5;
  const rarityScore = isFiveStar ? 120 : 60;
  const constScore = ch.constellationsUnlocked * (isFiveStar ? 30 : 8);
  const cvScore = ch.critValue;
  const levelScore = ch.level * 1.2;

  const sortedTalents = [...ch.talentLevels.slice(0, 3)].sort((a, b) => b - a);
  const talentScore =
    (sortedTalents[0] || 0) * 4 +
    (sortedTalents[1] || 0) * 4 +
    (sortedTalents[2] || 0) * 1.5;

  const weaponScore = ch.weapon
    ? ch.weapon.rarity * 12 + ch.weapon.refinement * 6
    : 0;

  return Math.round(
    rarityScore + constScore + cvScore + levelScore + talentScore + weaponScore
  );
}

function abbreviateStat(stat: string): string {
  return stat
    .replace("Energy Recharge", "ER")
    .replace("Elemental Mastery", "EM")
    .replace("Crit Rate", "CR")
    .replace("Crit DMG", "CD");
}

function computeArtifactCv(
  subStats: ShowcaseCharacter["artifacts"][number]["subStats"]
): {
  cv: number;
  grade: string;
  badgeClass: string;
} {
  let cr = 0;
  let cd = 0;
  for (const s of subStats) {
    const num = parseFloat(String(s.value).replace("%", "")) || 0;
    const low = s.stat.toLowerCase();
    if (low.includes("crit rate")) cr += num;
    else if (low.includes("crit dmg")) cd += num;
  }
  const cv = Math.round((cr * 2 + cd) * 10) / 10;
  if (cv >= 40) {
    return {
      cv,
      grade: "SS",
      badgeClass: "border-[#C7A664]/40 bg-irminsul-goldSoft text-irminsul-gold",
    };
  }
  if (cv >= 30) {
    return {
      cv,
      grade: "S",
      badgeClass: "border-[#B8D8CE] bg-irminsul-soft text-irminsul",
    };
  }
  if (cv >= 20) {
    return {
      cv,
      grade: "A",
      badgeClass: "border-[#B9D3E6] bg-[#EDF5FA] text-[#3A7CA5]",
    };
  }
  return {
    cv,
    grade: "B",
    badgeClass: "border-border-subtle bg-surface-subtle text-ink-secondary",
  };
}

function ShowcaseCharacterCard({
  ch,
  rank,
  valueScore,
  onOpenAdvisor,
  onShare,
}: {
  ch: ShowcaseCharacter;
  rank: number;
  valueScore: number;
  onOpenAdvisor: (name: string) => void;
  onShare: () => void;
}) {
  const [showArtifacts, setShowArtifacts] = useState(false);
  const el = getElementStyle(ch.element);

  return (
    <div className="min-w-0 overflow-hidden rounded-2xl border border-border bg-surface shadow-card transition-shadow hover:shadow-hover">
      {/* Calm Elemental Header Strip */}
      <div
        className={cn(
          "flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle bg-gradient-to-r px-4 py-3.5 sm:flex-nowrap sm:px-5 sm:py-4",
          el.cardTint
        )}
      >
        <div className="flex min-w-0 items-center gap-3.5">
          {ch.iconUrl && (
            <img
              src={ch.iconUrl}
              alt={ch.name}
              className="h-14 w-14 shrink-0 rounded-xl border border-border bg-surface/90 object-cover shadow-sm"
            />
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[11px] font-semibold text-ink-dim">
                #{rank}
              </span>
              <h3 className="truncate font-heading text-base font-semibold text-ink-primary">
                {ch.name}
              </h3>
              <span
                className={cn(
                  "inline-flex shrink-0 items-center gap-1 rounded-full border bg-surface/85 px-2 py-0.5 text-[11px] font-medium",
                  el.badgeText,
                  el.border
                )}
              >
                <span className={cn("h-1.5 w-1.5 rounded-full", el.dot)} />
                {ch.element}
              </span>
            </div>

            <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 font-mono text-xs text-ink-secondary">
              <RarityBadge rarity={ch.rarity} />
              <span>Lv.{ch.level}</span>
              <span>C{ch.constellationsUnlocked}</span>
              <span>Talents {ch.talentLevels.slice(0, 3).join("/") || "—"}</span>
            </div>
          </div>
        </div>

        <div className="shrink-0 text-right">
          <p className="font-mono text-[10px] uppercase tracking-wider text-ink-dim">
            Crit Value
          </p>
          <p className="font-mono text-xl font-semibold leading-tight text-irminsul">
            {ch.critValue}
          </p>
          <p className="font-mono text-[10px] text-ink-dim">Rank Score {valueScore}</p>
        </div>
      </div>

      {/* Body */}
      <div className="space-y-4 p-5">
        {/* Unified Stat Strip (no box-in-box clutter) */}
        <div className="rounded-xl border border-border-subtle bg-canvas/70">
          <div className="grid grid-cols-3 divide-x divide-border-subtle border-b border-border-subtle py-2.5 text-center">
            {[
              { key: "Crit Rate", label: "Crit Rate" },
              { key: "Crit DMG", label: "Crit DMG" },
              { key: "Energy Recharge", label: "Energy Recharge" },
            ].map((s) => (
              <div key={s.key} className="px-2">
                <p className="text-[11px] text-ink-dim">{s.label}</p>
                <p className="mt-0.5 font-mono text-sm font-semibold text-ink-primary">
                  {ch.stats[s.key] || "—"}
                </p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 divide-x divide-y divide-border-subtle text-center sm:grid-cols-4 sm:divide-y-0">
            {[
              { key: "Max HP", label: "HP" },
              { key: "ATK", label: "ATK" },
              { key: "DEF", label: "DEF" },
              { key: "Elemental Mastery", label: "EM" },
            ].map((s) => (
              <div key={s.key} className="px-2">
                <p className="text-[10px] text-ink-dim">{s.label}</p>
                <p className="font-mono text-xs font-medium text-ink-secondary">
                  {ch.stats[s.key] || "—"}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Weapon Row */}
        {ch.weapon && (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-border-subtle bg-surface-subtle/50 px-3.5 py-2.5">
            <div className="flex min-w-0 items-center gap-3">
              {ch.weapon.iconUrl && (
                <img
                  src={ch.weapon.iconUrl}
                  alt={ch.weapon.name}
                  className={cn(
                    "h-9 w-9 shrink-0 rounded-lg border object-contain p-0.5",
                    getRarityBackdrop(ch.weapon.rarity),
                  )}
                />
              )}
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold text-ink-primary">
                  {ch.weapon.name}
                </p>
                <p className="truncate font-mono text-[11px] text-ink-dim">
                  {ch.weapon.baseAtk ? `ATK ${ch.weapon.baseAtk}` : ""}
                  {ch.weapon.subStat ? ` · ${ch.weapon.subStat}` : ""}
                </p>
              </div>
            </div>
            <span className="shrink-0 rounded-md border border-border-subtle bg-surface px-2 py-0.5 font-mono text-[11px] text-ink-secondary">
              Lv.{ch.weapon.level} · R{ch.weapon.refinement}
            </span>
          </div>
        )}

        {/* Expandable 5-Piece Artifacts */}
        {showArtifacts && ch.artifacts.length > 0 && (
          <div className="space-y-2 border-t border-border-subtle pt-3">
            {ch.artifacts.map((art, idx) => {
              const cvInfo = computeArtifactCv(art.subStats);
              return (
              <div
                key={`${art.slot}-${idx}`}
                className="flex flex-col gap-2 rounded-xl border border-border-subtle bg-canvas/60 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  {art.iconUrl && (
                    <img
                      src={art.iconUrl}
                      alt={art.slot}
                      className={cn(
                        "h-8 w-8 shrink-0 rounded-md border object-contain p-0.5",
                        getRarityBackdrop(art.rarity),
                      )}
                    />
                  )}
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="truncate text-xs font-medium text-ink-primary">
                        {art.slot} ·{" "}
                        <span className="font-mono font-semibold text-irminsul">
                          {art.mainStat} {art.mainStatValue}
                        </span>
                      </p>
                      <span
                        className={cn(
                          "inline-flex items-center rounded border px-1.5 py-0.5 font-mono text-[9px] font-semibold leading-none",
                          cvInfo.badgeClass
                        )}
                      >
                        {cvInfo.cv.toFixed(1)} CV · {cvInfo.grade}
                      </span>
                    </div>
                    <p className="truncate font-mono text-[10px] text-ink-dim">
                      +{art.level} · {art.setName !== "Artifact Set" ? art.setName : art.name}
                    </p>
                  </div>
                </div>

                <div className="grid shrink-0 grid-cols-2 gap-x-3 gap-y-0.5 border-t border-border-subtle pt-1.5 font-mono text-[10px] text-ink-secondary sm:border-t-0 sm:pt-0 sm:text-right">
                  {art.subStats.map((sub, si) => (
                    <span key={si} className="whitespace-nowrap">
                      {abbreviateStat(sub.stat)} +{sub.value}
                    </span>
                  ))}
                </div>
              </div>
              );
            })}
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-between border-t border-border-subtle pt-3">
          <button
            type="button"
            onClick={() => setShowArtifacts((prev) => !prev)}
            className="inline-flex items-center gap-1 text-xs font-medium text-ink-secondary transition-colors hover:text-irminsul"
          >
            {showArtifacts ? "Hide" : "Inspect"} {ch.artifacts.length}/5 Artifacts
            {showArtifacts ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
          </button>
          <div className="flex items-center gap-1.5">
            <Button variant="ghost" size="sm" onClick={onShare} title="Share Build Card">
              <Share2 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Share</span>
            </Button>
            <Button variant="secondary" size="sm" onClick={() => onOpenAdvisor(ch.name)}>
              <Sparkles className="h-3.5 w-3.5 text-irminsul" />
              Evaluate Build
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function UidShowcaseView({
  allCharacters,
  onOpenAdvisor,
  onOpenCodexCharacter,
}: UidShowcaseViewProps) {
  const { profile, isConnecting, error, connectUid, refreshProfile } = useSession();
  const [uidInput, setUidInput] = useState("");
  const [search, setSearch] = useState("");
  const [showFormula, setShowFormula] = useState(false);
  const [profileSection, setProfileSection] = useState<"showcase" | "achievements">("showcase");
  const [shareTarget, setShareTarget] = useState<{
    ch: ShowcaseCharacter;
    rank: number;
    score: number;
  } | null>(null);

  const rankedShowcase = useMemo(() => {
    if (!profile) return [];
    return profile.showcaseCharacters
      .map((ch) => ({ ch, score: computeCharacterValue(ch) }))
      .sort((a, b) => b.score - a.score)
      .map((item, idx) => ({ ...item, rank: idx + 1 }));
  }, [profile]);

  const query = search.trim().toLowerCase();

  const visibleShowcase = useMemo(() => {
    if (!query) return rankedShowcase.slice(0, 12);
    return rankedShowcase.filter((item) => item.ch.name.toLowerCase().includes(query));
  }, [rankedShowcase, query]);

  const missingFromShowcase = useMemo(() => {
    if (!query) return [];
    const showcaseNames = new Set(rankedShowcase.map((r) => r.ch.name.toLowerCase()));
    return allCharacters
      .filter(
        (c) =>
          c.name.toLowerCase().includes(query) && !showcaseNames.has(c.name.toLowerCase())
      )
      .slice(0, 6);
  }, [allCharacters, rankedShowcase, query]);

  const handleQuickConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uidInput.trim()) return;
    try {
      await connectUid(uidInput.trim());
    } catch {
      // handled by context
    }
  };

  if (isConnecting && !profile) {
    return <LoadingSpinner label="Fetching live Enka.Network showcase..." />;
  }

  if (!profile) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-border bg-surface p-6 text-center shadow-card sm:p-8">
        <Shield className="mx-auto h-8 w-8 text-irminsul" />
        <h2 className="mt-3 font-serif text-3xl text-ink-primary">
          Connect Your Genshin UID
        </h2>
        <p className="mt-2 text-sm text-ink-secondary">
          Pull your public in-game Character Showcase from Enka.Network to inspect equipped artifacts, Crit Value, and AI recommendations.
        </p>
        <form onSubmit={handleQuickConnect} className="mt-5 flex gap-2">
          <input
            type="text"
            inputMode="numeric"
            maxLength={10}
            value={uidInput}
            onChange={(e) => setUidInput(e.target.value.replace(/\D/g, ""))}
            placeholder="Enter 9- or 10-digit UID"
            className="flex-1 rounded-lg border border-border bg-canvas px-3.5 py-2 font-mono text-sm text-ink-primary placeholder:text-ink-dim focus:border-border-focus focus:outline-none"
          />
          <Button type="submit" disabled={isConnecting || uidInput.length < 9}>
            Sync UID
          </Button>
        </form>
        {error && <p className="mt-3 text-xs text-[#9A3B26]">{error}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Player Header */}
      <div className="flex flex-col justify-between gap-4 rounded-2xl border border-border bg-surface p-6 shadow-card sm:flex-row sm:items-center">
        <div className="flex items-center gap-4">
          {profile.profilePictureUrl && (
            <img
              src={profile.profilePictureUrl}
              alt={profile.nickname}
              className="h-14 w-14 rounded-full border border-border bg-surface-subtle object-cover"
            />
          )}
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-serif text-3xl text-ink-primary">{profile.nickname}</h1>
              <Badge className="font-mono">UID {profile.uid}</Badge>
            </div>
            <p className="mt-1 text-sm text-ink-secondary">
              {profile.signature || "No in-game signature"}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge>AR {profile.level}</Badge>
          <Badge>WL {profile.worldLevel}</Badge>
          <Badge>
            <Award className="h-3 w-3 text-irminsul" />
            {profile.finishAchievementNum} Achievements
          </Badge>
          {profile.towerFloorIndex != null && profile.towerFloorIndex > 0 && (
            <Badge>
              Abyss {profile.towerFloorIndex}-{profile.towerLevelIndex}
              {profile.towerStarIndex != null ? ` (${profile.towerStarIndex}★)` : ""}
            </Badge>
          )}
          {profile.theaterActIndex != null && (
            <Badge>
              Theater Act {profile.theaterActIndex}
              {profile.theaterStarIndex != null ? ` (${profile.theaterStarIndex}★)` : ""}
            </Badge>
          )}
          {profile.stygianIndex != null && (
            <Badge>
              Stygian D{profile.stygianIndex}
              {profile.stygianSeconds != null ? ` · ${profile.stygianSeconds}s` : ""}
            </Badge>
          )}
          <Button variant="secondary" size="sm" onClick={refreshProfile} disabled={isConnecting}>
            <RefreshCw className={cn("h-3.5 w-3.5", isConnecting && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-[#E8C5BC] bg-[#FBF0ED] px-4 py-2.5 text-xs text-[#9A3B26]">
          {error}
        </div>
      )}

      {/* Profile Sub-Tabs */}
      <div className="flex items-center gap-1 rounded-xl border border-border bg-surface p-1 w-fit shadow-card">
        <button
          type="button"
          onClick={() => setProfileSection("showcase")}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-medium transition-colors sm:text-sm",
            profileSection === "showcase"
              ? "bg-irminsul-soft text-irminsul"
              : "text-ink-secondary hover:text-ink-primary"
          )}
        >
          <Users className="h-3.5 w-3.5" />
          Character Showcase ({rankedShowcase.length})
        </button>
        <button
          type="button"
          onClick={() => setProfileSection("achievements")}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-medium transition-colors sm:text-sm",
            profileSection === "achievements"
              ? "bg-irminsul-soft text-irminsul"
              : "text-ink-secondary hover:text-ink-primary"
          )}
        >
          <Trophy className="h-3.5 w-3.5" />
          Achievement Tracker
        </button>
      </div>

      {profileSection === "achievements" ? (
        <AchievementTrackerPanel
          uid={profile.uid}
          uidAchievementCount={profile.finishAchievementNum}
        />
      ) : (
        <>
      {/* Info + Search Bar */}
      <div className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-surface px-4 py-2.5 text-xs text-ink-secondary">
            <Info className="h-4 w-4 shrink-0 text-irminsul" />
            <span>
              Showing{" "}
              <strong>
                {query ? visibleShowcase.length : Math.min(12, rankedShowcase.length)}
              </strong>{" "}
              of <strong>{rankedShowcase.length}</strong> showcase characters, ranked by
              value.
            </span>
            <button
              type="button"
              onClick={() => setShowFormula((prev) => !prev)}
              className="inline-flex items-center gap-1 rounded-md border border-border-subtle bg-surface-subtle px-2 py-0.5 font-mono text-[11px] font-medium text-irminsul transition-colors hover:border-border-focus"
            >
              <HelpCircle className="h-3 w-3" />
              {showFormula ? "Hide Formula" : "How Ranking Works"}
            </button>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-dim" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search showcase or codex..."
              className="w-full rounded-xl border border-border bg-surface py-2 pl-9 pr-8 text-sm text-ink-primary shadow-sm placeholder:text-ink-dim focus:border-border-focus focus:outline-none"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-dim hover:text-ink-primary"
                aria-label="Clear search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {showFormula && (
          <div className="grid gap-2.5 rounded-2xl border border-border bg-surface p-4 text-xs shadow-card sm:grid-cols-5">
            <div className="rounded-lg bg-canvas/70 px-3 py-2">
              <p className="font-mono text-[10px] uppercase text-ink-dim">Rarity</p>
              <p className="mt-0.5 font-medium text-ink-primary">5★: 120 · 4★: 60</p>
            </div>
            <div className="rounded-lg bg-canvas/70 px-3 py-2">
              <p className="font-mono text-[10px] uppercase text-ink-dim">Constellations</p>
              <p className="mt-0.5 font-medium text-ink-primary">5★: +30 · 4★: +8 / C</p>
            </div>
            <div className="rounded-lg bg-canvas/70 px-3 py-2">
              <p className="font-mono text-[10px] uppercase text-ink-dim">Artifact CV</p>
              <p className="mt-0.5 font-medium text-ink-primary">1.0 × Total CV</p>
            </div>
            <div className="rounded-lg bg-canvas/70 px-3 py-2">
              <p className="font-mono text-[10px] uppercase text-ink-dim">Talents</p>
              <p className="mt-0.5 font-medium text-ink-primary">Top 2 × 4 + 3rd × 1.5</p>
            </div>
            <div className="rounded-lg bg-canvas/70 px-3 py-2">
              <p className="font-mono text-[10px] uppercase text-ink-dim">Level &amp; Weapon</p>
              <p className="mt-0.5 font-medium text-ink-primary">Lv×1.2 + Rarity×12 + R×6</p>
            </div>
          </div>
        )}
      </div>

      {/* Showcase Characters */}
      {rankedShowcase.length === 0 ? (
        <div className="rounded-2xl border border-border bg-surface p-10 text-center">
          <p className="font-heading text-base font-medium text-ink-primary">
            Character Showcase is Hidden or Empty
          </p>
          <p className="mt-1 text-sm text-ink-secondary">
            Enable "Show Character Details" in your Genshin Impact profile settings, then click Refresh.
          </p>
        </div>
      ) : visibleShowcase.length > 0 ? (
        <div className="grid items-start gap-5 lg:grid-cols-2">
          {visibleShowcase.map(({ ch, rank, score }) => (
            <ShowcaseCharacterCard
              key={ch.avatarId}
              ch={ch}
              rank={rank}
              valueScore={score}
              onOpenAdvisor={onOpenAdvisor}
              onShare={() => setShareTarget({ ch, rank, score })}
            />
          ))}
        </div>
      ) : null}

      {/* Fallback matches from Codex when searching characters not in Showcase */}
      {query && missingFromShowcase.length > 0 && (
        <div className="space-y-3 rounded-2xl border border-border bg-surface p-5 shadow-card">
          <p className="font-mono text-[11px] uppercase tracking-wider text-ink-dim">
            Not in your public in-game Showcase · Open from Codex
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {missingFromShowcase.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-border-subtle bg-canvas/70 p-3"
              >
                <div className="flex items-center gap-3">
                  <img
                    src={c.image}
                    alt={c.name}
                    className="h-10 w-10 rounded-lg border border-border-subtle bg-surface object-contain"
                  />
                  <div>
                    <p className="text-sm font-semibold text-ink-primary">{c.name}</p>
                    <p className="text-xs text-ink-secondary">
                      {c.vision} · {c.weapon}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onOpenCodexCharacter(c.id)}
                    title="Open Build Guide"
                  >
                    <ArrowUpRight className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => onOpenAdvisor(c.name)}
                  >
                    <Sparkles className="h-3.5 w-3.5 text-irminsul" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
        </>
      )}

      {shareTarget && profile && (
        <ShareShowcaseCardModal
          character={shareTarget.ch}
          profile={profile}
          rank={shareTarget.rank}
          valueScore={shareTarget.score}
          onClose={() => setShareTarget(null)}
        />
      )}
    </div>
  );
}
