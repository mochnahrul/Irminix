import { useEffect, useMemo, useState } from "react";
import { BookOpen, Calculator, Calendar, Coins, MapPin, Swords, UserCheck } from "lucide-react";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { Badge } from "@/components/ui/badge";
import { useSession } from "@/contexts/SessionContext";
import { cn, getElementStyle, getRarityBackdrop } from "@/lib/utils";
import { fetchCharacterMaterialPlan, fetchDailyFarming } from "@/services/api";
import type {
  CharacterMaterialPlanResponse,
  CharacterSummary,
  DailyFarmingResponse,
  MaterialBrief,
} from "@/types/genshin";

const DAYS = [
  { id: "monday", short: "Mon" },
  { id: "tuesday", short: "Tue" },
  { id: "wednesday", short: "Wed" },
  { id: "thursday", short: "Thu" },
  { id: "friday", short: "Fri" },
  { id: "saturday", short: "Sat" },
  { id: "sunday", short: "Sun" },
] as const;

const ASCENSION_OPTIONS = [
  { promote: 0, label: "Lv. 1–20" },
  { promote: 1, label: "Lv. 20+" },
  { promote: 2, label: "Lv. 40+" },
  { promote: 3, label: "Lv. 50+" },
  { promote: 4, label: "Lv. 60+" },
  { promote: 5, label: "Lv. 70+" },
  { promote: 6, label: "Lv. 80–90" },
];

interface FarmingPlannerViewProps {
  characters: CharacterSummary[];
  initialSubTab?: "daily" | "calculator";
  initialCharacterId?: string | null;
  onSelectCharacter?: (id: string) => void;
}

export function FarmingPlannerView({
  characters,
  initialSubTab,
  initialCharacterId,
  onSelectCharacter,
}: FarmingPlannerViewProps) {
  const { profile } = useSession();
  const [subTab, setSubTab] = useState<"daily" | "calculator">(initialSubTab || "daily");

  // Daily Farming state
  const [selectedDay, setSelectedDay] = useState<string>("");
  const [dailyData, setDailyData] = useState<DailyFarmingResponse | null>(null);
  const [loadingDaily, setLoadingDaily] = useState(true);
  const [dailyError, setDailyError] = useState<string | null>(null);

  // Calculator state
  const [calcCharId, setCalcCharId] = useState<string>(
    initialCharacterId || characters[0]?.id || "arlecchino"
  );
  const [plan, setPlan] = useState<CharacterMaterialPlanResponse | null>(null);
  const [loadingPlan, setLoadingPlan] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);

  const [ascFrom, setAscFrom] = useState(0);
  const [ascTo, setAscTo] = useState(6);
  const [naFrom, setNaFrom] = useState(1);
  const [naTo, setNaTo] = useState(9);
  const [skillFrom, setSkillFrom] = useState(1);
  const [skillTo, setSkillTo] = useState(9);
  const [burstFrom, setBurstFrom] = useState(1);
  const [burstTo, setBurstTo] = useState(9);

  const showcaseNames = useMemo(
    () => new Set((profile?.showcaseCharacters || []).map((c) => c.name.toLowerCase())),
    [profile]
  );

  useEffect(() => {
    if (initialSubTab) setSubTab(initialSubTab);
  }, [initialSubTab]);

  useEffect(() => {
    if (initialCharacterId) {
      setCalcCharId(initialCharacterId);
    } else if (characters.length > 0 && !characters.some((c) => c.id === calcCharId)) {
      setCalcCharId(characters[0].id);
    }
  }, [initialCharacterId, characters, calcCharId]);

  useEffect(() => {
    let cancelled = false;
    setLoadingDaily(true);
    setDailyError(null);
    fetchDailyFarming(selectedDay || undefined)
      .then((res) => {
        if (!cancelled) {
          setDailyData(res);
          if (!selectedDay) setSelectedDay(res.day);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setDailyError(err instanceof Error ? err.message : "Failed to load daily domain schedule.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingDaily(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedDay]);

  useEffect(() => {
    if (subTab !== "calculator" || !calcCharId) return;
    let cancelled = false;
    setLoadingPlan(true);
    setPlanError(null);
    fetchCharacterMaterialPlan(calcCharId)
      .then((res) => {
        if (!cancelled) setPlan(res);
      })
      .catch((err) => {
        if (!cancelled) {
          setPlan(null);
          setPlanError(err instanceof Error ? err.message : "Failed to load character material plan.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingPlan(false);
      });
    return () => {
      cancelled = true;
    };
  }, [subTab, calcCharId]);

  const totals = useMemo(() => {
    if (!plan) return { items: [] as MaterialBrief[], totalMora: 0 };
    const map = new Map<number, MaterialBrief>();
    let totalMora = 0;

    const addItem = (item: MaterialBrief) => {
      const existing = map.get(item.id);
      if (existing) {
        existing.count += item.count;
      } else {
        map.set(item.id, { ...item });
      }
    };

    for (const stage of plan.ascensionStages) {
      if (stage.promoteLevel > ascFrom && stage.promoteLevel <= ascTo) {
        totalMora += stage.coinCost;
        for (const it of stage.items) addItem(it);
      }
    }

    const talentRanges = [
      [naFrom, naTo],
      [skillFrom, skillTo],
      [burstFrom, burstTo],
    ];
    for (const [from, to] of talentRanges) {
      for (const stage of plan.talentStages) {
        if (stage.level > from && stage.level <= to) {
          totalMora += stage.coinCost;
          for (const it of stage.items) addItem(it);
        }
      }
    }

    const items = Array.from(map.values()).sort((a, b) => b.rank - a.rank || a.name.localeCompare(b.name));
    return { items, totalMora };
  }, [plan, ascFrom, ascTo, naFrom, naTo, skillFrom, skillTo, burstFrom, burstTo]);

  return (
    <div className="space-y-6">
      {/* Editorial Hero */}
      <div className="relative overflow-hidden rounded-3xl border border-border bg-surface p-5 shadow-card sm:p-7">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-12 -top-12 h-56 w-56 rounded-full bg-[radial-gradient(circle,rgba(36,106,86,0.08),transparent_70%)]"
        />
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-widest text-irminsul">
                <Calendar className="h-3.5 w-3.5" />
                Resin &amp; Progression
              </span>
              {dailyData && (
                <span className="rounded-full border border-[#B8D8CE] bg-irminsul-soft px-2.5 py-0.5 font-mono text-[11px] font-medium capitalize text-irminsul">
                  {dailyData.day} Schedule
                </span>
              )}
            </div>
            <h1 className="mt-1.5 font-serif text-3xl tracking-tight text-ink-primary sm:text-4xl">
              Farming Schedule &amp; Material Planner
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-ink-secondary">
              Check which Talent &amp; Weapon domains are open today, or calculate exact materials for any character.
            </p>
          </div>

          <div className="flex items-center gap-1 self-start rounded-xl bg-surface-subtle p-1 lg:self-auto">
            <button
              type="button"
              onClick={() => setSubTab("daily")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all",
                subTab === "daily"
                  ? "bg-surface text-irminsul shadow-sm"
                  : "text-ink-secondary hover:text-ink-primary"
              )}
            >
              <Calendar className="h-3.5 w-3.5" />
              Daily Domains
            </button>
            <button
              type="button"
              onClick={() => setSubTab("calculator")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all",
                subTab === "calculator"
                  ? "bg-surface text-irminsul shadow-sm"
                  : "text-ink-secondary hover:text-ink-primary"
              )}
            >
              <Calculator className="h-3.5 w-3.5" />
              Material Calculator
            </button>
          </div>
        </div>
      </div>

      {subTab === "daily" ? (
        <div className="space-y-6">
          {/* Day Selector */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-surface p-3.5 shadow-card">
            <div className="flex flex-wrap items-center gap-1.5">
              {DAYS.map((d) => {
                const active = (selectedDay || dailyData?.day) === d.id;
                return (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => setSelectedDay(d.id)}
                    className={cn(
                      "rounded-full px-3 py-1.5 font-mono text-xs font-medium transition-colors",
                      active
                        ? "bg-irminsul text-white shadow-sm"
                        : "bg-surface-subtle text-ink-secondary hover:text-ink-primary"
                    )}
                  >
                    {d.short}
                  </button>
                );
              })}
            </div>
            {showcaseNames.size > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[#E3D3AE] bg-irminsul-goldSoft px-2.5 py-1 text-[11px] font-medium text-irminsul-gold">
                <UserCheck className="h-3 w-3" />
                Highlighting your UID Showcase characters
              </span>
            )}
          </div>

          {loadingDaily ? (
            <LoadingSpinner label="Loading daily domain rotation..." />
          ) : dailyData ? (
            <>
              {/* Talent Domains */}
              <section className="space-y-3">
                <div className="flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-irminsul" />
                  <h2 className="font-serif text-2xl text-ink-primary">Talent Book Domains</h2>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  {dailyData.talentDomains.map((dom) => (
                    <div
                      key={dom.id}
                      className="flex min-w-0 flex-col justify-between rounded-2xl border border-border bg-surface p-5 shadow-card"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h3 className="font-heading text-sm font-semibold text-ink-primary">
                              {dom.name}
                            </h3>
                            <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-ink-dim">
                              <MapPin className="h-3 w-3" />
                              {dom.city}
                            </p>
                          </div>
                          <Badge>Talent</Badge>
                        </div>

                        <div className="mt-3 flex flex-wrap gap-2">
                          {dom.materials.slice(0, 3).map((mat) => (
                            <div
                              key={mat.id}
                              className="flex items-center gap-2 rounded-xl border border-border-subtle bg-canvas/70 px-2.5 py-1.5"
                            >
                              {mat.icon && (
                                <img
                                  src={mat.icon}
                                  alt={mat.name}
                                  loading="lazy"
                                  referrerPolicy="no-referrer"
                                  onError={(e) => {
                                    (e.currentTarget as HTMLImageElement).style.display = "none";
                                  }}
                                  className={cn(
                                    "h-7 w-7 rounded-lg border object-contain p-0.5",
                                    getRarityBackdrop(mat.rank)
                                  )}
                                />
                              )}
                              <span className="text-[11px] font-medium text-ink-primary">
                                {mat.name}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {dom.characters.length > 0 && (
                        <div className="mt-4 border-t border-border-subtle pt-3">
                          <p className="mb-2 font-mono text-[10px] uppercase tracking-wider text-ink-dim">
                            Used By ({dom.characters.length})
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {dom.characters.map((ch) => {
                              const inShowcase = showcaseNames.has(ch.name.toLowerCase());
                              const el = getElementStyle(ch.vision);
                              return (
                                <button
                                  key={ch.id}
                                  type="button"
                                  onClick={() => onSelectCharacter?.(ch.id)}
                                  className={cn(
                                    "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors hover:border-irminsul",
                                    inShowcase
                                      ? "border-[#C7A664] bg-irminsul-goldSoft text-irminsul-gold"
                                      : "border-border-subtle bg-canvas text-ink-primary"
                                  )}
                                >
                                  <img
                                    src={ch.image}
                                    alt={ch.name}
                                    loading="lazy"
                                    referrerPolicy="no-referrer"
                                    onError={(e) => {
                                      (e.currentTarget as HTMLImageElement).style.display = "none";
                                    }}
                                    className={cn(
                                      "h-4 w-4 rounded-full object-cover",
                                      el.dot
                                    )}
                                  />
                                  <span>{ch.name}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>

              {/* Weapon Domains */}
              <section className="space-y-3">
                <div className="flex items-center gap-2">
                  <Swords className="h-4 w-4 text-irminsul" />
                  <h2 className="font-serif text-2xl text-ink-primary">
                    Weapon Ascension Domains
                  </h2>
                </div>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {dailyData.weaponDomains.map((dom) => (
                    <div
                      key={dom.id}
                      className="rounded-2xl border border-border bg-surface p-5 shadow-card"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="font-heading text-sm font-semibold text-ink-primary">
                            {dom.name}
                          </h3>
                          <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-ink-dim">
                            <MapPin className="h-3 w-3" />
                            {dom.city}
                          </p>
                        </div>
                        <Badge>Weapon</Badge>
                      </div>

                      <div className="mt-3 space-y-1.5">
                        {dom.materials.slice(0, 4).map((mat) => (
                          <div
                            key={mat.id}
                            className="flex items-center gap-2 rounded-xl border border-border-subtle bg-canvas/70 px-2.5 py-1.5"
                          >
                            {mat.icon && (
                              <img
                                src={mat.icon}
                                alt={mat.name}
                                loading="lazy"
                                referrerPolicy="no-referrer"
                                onError={(e) => {
                                  (e.currentTarget as HTMLImageElement).style.display = "none";
                                }}
                                className={cn(
                                  "h-7 w-7 shrink-0 rounded-lg border object-contain p-0.5",
                                  getRarityBackdrop(mat.rank)
                                )}
                              />
                            )}
                            <span className="truncate text-[11px] font-medium text-ink-primary">
                              {mat.name}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </>
          ) : dailyError ? (
            <div className="rounded-2xl border border-[#E8C5BC] bg-[#FBF0ED] p-5 text-xs text-[#9A3B26]">
              {dailyError}
            </div>
          ) : null}
        </div>
      ) : (
        /* Material Calculator */
        <div className="space-y-6">
          <div className="rounded-2xl border border-border bg-surface p-5 shadow-card">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
              <div className="lg:col-span-2">
                <label className="block font-mono text-[10px] uppercase tracking-wider text-ink-dim">
                  Character
                </label>
                <select
                  value={calcCharId}
                  onChange={(e) => setCalcCharId(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-border bg-canvas px-3.5 py-2.5 text-sm font-medium text-ink-primary focus:border-irminsul focus:outline-none"
                >
                  {characters.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.vision})
                    </option>
                  ))}
                </select>
              </div>

              <div className="lg:col-span-2">
                <label className="block font-mono text-[10px] uppercase tracking-wider text-ink-dim">
                  Ascension (From → To)
                </label>
                <div className="mt-1.5 flex items-center gap-1.5">
                  <select
                    value={ascFrom}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setAscFrom(val);
                      if (ascTo < val) setAscTo(val);
                    }}
                    className="w-full rounded-xl border border-border bg-canvas px-2 py-2.5 text-xs text-ink-primary focus:border-irminsul focus:outline-none"
                  >
                    {ASCENSION_OPTIONS.map((o) => (
                      <option key={o.promote} value={o.promote}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  <select
                    value={ascTo}
                    onChange={(e) => setAscTo(Math.max(ascFrom, Number(e.target.value)))}
                    className="w-full rounded-xl border border-border bg-canvas px-2 py-2.5 text-xs text-ink-primary focus:border-irminsul focus:outline-none"
                  >
                    {ASCENSION_OPTIONS.map((o) => (
                      <option key={o.promote} value={o.promote}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-end lg:col-span-2">
                <button
                  type="button"
                  onClick={() => {
                    setNaFrom(1);
                    setSkillFrom(1);
                    setBurstFrom(1);
                    setAscFrom(0);
                    setAscTo(6);
                    setNaTo(9);
                    setSkillTo(9);
                    setBurstTo(9);
                  }}
                  className="w-full rounded-xl border border-border bg-canvas px-3 py-2.5 font-mono text-xs font-medium text-ink-secondary transition-colors hover:border-irminsul hover:text-irminsul"
                >
                  Preset: Full 1 → 90 (9/9/9)
                </button>
              </div>
            </div>

            {/* Talent From -> To Ranges */}
            <div className="mt-4 grid gap-3 border-t border-border-subtle pt-4 sm:grid-cols-3">
              {[
                { label: "Normal Attack (From → To)", from: naFrom, to: naTo, setFrom: setNaFrom, setTo: setNaTo },
                { label: "Elemental Skill (From → To)", from: skillFrom, to: skillTo, setFrom: setSkillFrom, setTo: setSkillTo },
                { label: "Elemental Burst (From → To)", from: burstFrom, to: burstTo, setFrom: setBurstFrom, setTo: setBurstTo },
              ].map((t) => (
                <div key={t.label}>
                  <label className="block font-mono text-[10px] uppercase tracking-wider text-ink-dim">
                    {t.label}
                  </label>
                  <div className="mt-1.5 flex items-center gap-1.5">
                    <select
                      value={t.from}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        t.setFrom(val);
                        if (t.to < val) t.setTo(val);
                      }}
                      className="w-full rounded-xl border border-border bg-canvas px-2 py-2 text-xs text-ink-primary focus:border-irminsul focus:outline-none"
                    >
                      {Array.from({ length: 10 }, (_, i) => i + 1).map((lv) => (
                        <option key={lv} value={lv}>
                          Lv.{lv}
                        </option>
                      ))}
                    </select>
                    <span className="text-xs text-ink-dim">→</span>
                    <select
                      value={t.to}
                      onChange={(e) => t.setTo(Math.max(t.from, Number(e.target.value)))}
                      className="w-full rounded-xl border border-border bg-canvas px-2 py-2 text-xs text-ink-primary focus:border-irminsul focus:outline-none"
                    >
                      {Array.from({ length: 10 }, (_, i) => i + 1).map((lv) => (
                        <option key={lv} value={lv}>
                          Lv.{lv}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {loadingPlan ? (
            <LoadingSpinner label="Calculating ascension & talent materials..." />
          ) : planError ? (
            <div className="rounded-2xl border border-[#E8C5BC] bg-[#FBF0ED] p-5 text-xs text-[#9A3B26]">
              {planError}
            </div>
          ) : plan ? (
            <div className="rounded-3xl border border-border bg-surface p-5 shadow-card sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border-subtle pb-4">
                <div className="flex items-center gap-3">
                  <img
                    src={plan.image}
                    alt={plan.name}
                    className="h-12 w-12 rounded-xl border border-border object-cover object-top"
                  />
                  <div>
                    <h2 className="font-serif text-2xl text-ink-primary">{plan.name}</h2>
                    <p className="text-xs text-ink-secondary">
                      Required materials for selected Ascension &amp; Talent targets
                    </p>
                  </div>
                </div>

                <div className="inline-flex items-center gap-2 rounded-xl border border-[#E3D3AE] bg-irminsul-goldSoft px-3.5 py-2 font-mono text-xs font-semibold text-irminsul-gold">
                  <Coins className="h-4 w-4" />
                  {totals.totalMora.toLocaleString()} Mora
                </div>
              </div>

              {totals.items.length === 0 ? (
                <p className="py-8 text-center text-sm text-ink-dim">
                  Target levels match starting levels — increase Ascension or Talent targets above.
                </p>
              ) : (
                <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                  {totals.items.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 rounded-2xl border border-border-subtle bg-canvas/70 p-3"
                    >
                      {item.icon && (
                        <img
                          src={item.icon}
                          alt={item.name}
                          loading="lazy"
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).style.display = "none";
                          }}
                          className={cn(
                            "h-11 w-11 shrink-0 rounded-xl border object-contain p-1",
                            getRarityBackdrop(item.rank)
                          )}
                        />
                      )}
                      <div className="min-w-0">
                        <p className="font-mono text-sm font-bold text-ink-primary">
                          ×{item.count.toLocaleString()}
                        </p>
                        <p className="line-clamp-2 text-[11px] leading-snug text-ink-secondary">
                          {item.name}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
