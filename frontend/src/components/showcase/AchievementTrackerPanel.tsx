import { useEffect, useMemo, useState } from "react";
import { Check, HelpCircle, Loader2, Search, Sparkles, X } from "lucide-react";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { fetchAchievementGuide, fetchAchievements } from "@/services/api";
import type {
  AchievementCatalogResponse,
  AchievementGuideResponse,
  AchievementItem,
} from "@/types/genshin";

interface AchievementTrackerPanelProps {
  uid: string;
  uidAchievementCount: number;
}

const PAGE_SIZE = 40;

export function AchievementTrackerPanel({
  uid,
  uidAchievementCount,
}: AchievementTrackerPanelProps) {
  const storageKey = `irminsul:achievements:${uid}`;
  const [catalog, setCatalog] = useState<AchievementCatalogResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [completedIds, setCompletedIds] = useState<Set<number>>(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      return raw ? new Set(JSON.parse(raw) as number[]) : new Set();
    } catch {
      return new Set();
    }
  });

  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "done">("pending");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const [guides, setGuides] = useState<Record<number, AchievementGuideResponse>>({});
  const [loadingGuideId, setLoadingGuideId] = useState<number | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      setCompletedIds(raw ? new Set(JSON.parse(raw) as number[]) : new Set());
    } catch {
      setCompletedIds(new Set());
    }
  }, [storageKey]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchAchievements()
      .then((res) => {
        if (!cancelled) setCatalog(res);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load achievements.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const toggleCompleted = (id: number) => {
    setCompletedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      localStorage.setItem(storageKey, JSON.stringify(Array.from(next)));
      return next;
    });
  };

  const handleLoadGuide = async (item: AchievementItem) => {
    if (guides[item.id]) return;
    setLoadingGuideId(item.id);
    try {
      const guide = await fetchAchievementGuide({
        title: item.title,
        description: item.description,
        categoryName: item.categoryName,
      });
      setGuides((prev) => ({ ...prev, [item.id]: guide }));
    } catch {
      setError("Failed to generate achievement guide. Please try again.");
    } finally {
      setLoadingGuideId(null);
    }
  };

  const filtered = useMemo(() => {
    if (!catalog) return [];
    const q = search.trim().toLowerCase();
    return catalog.items.filter((item) => {
      const isDone = completedIds.has(item.id);
      if (statusFilter === "pending" && isDone) return false;
      if (statusFilter === "done" && !isDone) return false;
      if (categoryId !== "all" && item.categoryId !== categoryId) return false;
      if (
        q &&
        !item.title.toLowerCase().includes(q) &&
        !item.description.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [catalog, completedIds, statusFilter, categoryId, search]);

  if (loading) return <LoadingSpinner label="Loading Teyvat achievement archive..." />;
  if (error || !catalog) {
    return (
      <div className="rounded-xl border border-[#E8C5BC] bg-[#FBF0ED] p-5 text-xs text-[#9A3B26]">
        {error || "Unable to load achievement catalog."}
      </div>
    );
  }

  const uidPct = Math.min(
    100,
    Math.round((uidAchievementCount / Math.max(1, catalog.total)) * 100)
  );
  const visibleItems = filtered.slice(0, visibleCount);

  return (
    <div className="space-y-5">
      {/* Summary & Sync Note */}
      <div className="rounded-2xl border border-border bg-surface p-5 shadow-card">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-wider text-irminsul">
              UID Progress vs Archive
            </p>
            <h2 className="mt-1 font-serif text-2xl text-ink-primary">
              {uidAchievementCount.toLocaleString()}{" "}
              <span className="font-sans text-sm font-normal text-ink-secondary">
                / {catalog.total.toLocaleString()} total achievements ({uidPct}%)
              </span>
            </h2>
            <p className="mt-1 text-xs text-ink-secondary">
              HoYoverse UID only exposes total count; use the local checklist below (saved in your browser) to track &amp; unlock remaining achievements.
            </p>
          </div>

          <div className="flex shrink-0 flex-col items-start gap-1 rounded-xl border border-border-subtle bg-canvas/70 px-4 py-2.5 sm:items-end">
            <span className="font-mono text-[10px] uppercase text-ink-dim">
              Local Checklist
            </span>
            <span className="font-mono text-sm font-semibold text-irminsul">
              {completedIds.size} marked done
            </span>
          </div>
        </div>

        <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-surface-subtle">
          <div
            className="h-full rounded-full bg-irminsul transition-all"
            style={{ width: `${uidPct}%` }}
          />
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4 shadow-card sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-dim" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setVisibleCount(PAGE_SIZE);
            }}
            placeholder="Search achievement title or requirement..."
            className="w-full rounded-xl border border-border bg-canvas py-2 pl-9 pr-8 text-sm text-ink-primary placeholder:text-ink-dim focus:border-border-focus focus:outline-none"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-dim hover:text-ink-primary"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <select
          value={categoryId}
          onChange={(e) => {
            setCategoryId(e.target.value);
            setVisibleCount(PAGE_SIZE);
          }}
          className="rounded-xl border border-border bg-canvas px-3 py-2 text-xs font-medium text-ink-primary focus:border-border-focus focus:outline-none sm:w-56"
        >
          <option value="all">All Categories ({catalog.total})</option>
          {catalog.categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name} ({cat.count})
            </option>
          ))}
        </select>

        <div className="flex items-center gap-1 rounded-xl bg-surface-subtle p-1">
          {(
            [
              { id: "pending", label: "Incomplete" },
              { id: "done", label: "Completed" },
              { id: "all", label: "All" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setStatusFilter(tab.id);
                setVisibleCount(PAGE_SIZE);
              }}
              className={cn(
                "rounded-lg px-2.5 py-1 text-xs font-medium transition-colors",
                statusFilter === tab.id
                  ? "bg-surface text-irminsul shadow-sm"
                  : "text-ink-secondary hover:text-ink-primary"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Achievement List */}
      <div className="space-y-2.5">
        {visibleItems.length === 0 ? (
          <div className="rounded-2xl border border-border bg-surface py-12 text-center text-sm text-ink-secondary">
            No achievements match these filters.
          </div>
        ) : (
          visibleItems.map((item) => {
            const isDone = completedIds.has(item.id);
            const guide = guides[item.id];
            const isGuideLoading = loadingGuideId === item.id;

            return (
              <div
                key={item.id}
                className={cn(
                  "rounded-xl border border-border bg-surface p-4 shadow-card transition-colors",
                  isDone && "bg-surface-subtle/60 opacity-80"
                )}
              >
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start sm:gap-4">
                  <div className="flex min-w-0 items-start gap-3">
                    <button
                      type="button"
                      onClick={() => toggleCompleted(item.id)}
                      aria-label={`Mark ${item.title} as ${isDone ? "incomplete" : "complete"}`}
                      className={cn(
                        "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors",
                        isDone
                          ? "border-irminsul bg-irminsul text-white"
                          : "border-border bg-canvas hover:border-irminsul"
                      )}
                    >
                      {isDone && <Check className="h-3.5 w-3.5" />}
                    </button>

                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3
                          className={cn(
                            "font-heading text-sm font-semibold text-ink-primary",
                            isDone && "line-through text-ink-dim"
                          )}
                        >
                          {item.title}
                        </h3>
                        <Badge>{item.categoryName}</Badge>
                        {item.version && (
                          <span className="font-mono text-[10px] text-ink-dim">
                            v{item.version}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-ink-secondary">
                        {item.description}
                      </p>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center justify-between gap-2 pl-8 sm:justify-end sm:pl-0">
                    <span className="rounded-md bg-irminsul-goldSoft px-2 py-0.5 font-mono text-[11px] font-medium text-irminsul-gold">
                      +{item.primogems} Primo
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleLoadGuide(item)}
                      disabled={isGuideLoading}
                    >
                      {isGuideLoading ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <HelpCircle className="h-3.5 w-3.5 text-irminsul" />
                      )}
                      <span>How to Unlock</span>
                    </Button>
                  </div>
                </div>

                {guide && (
                  <div className="mt-3 rounded-xl border border-border-subtle bg-canvas/80 p-3.5 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 font-medium text-irminsul">
                        <Sparkles className="h-3.5 w-3.5" />
                        Unlock Walkthrough
                      </span>
                      <span className="font-mono text-[10px] text-ink-dim">
                        {guide.poweredBy}
                      </span>
                    </div>
                    <ul className="mt-2 space-y-1 text-ink-secondary">
                      {guide.steps.map((step, i) => (
                        <li key={i}>
                          {i + 1}. {step}
                        </li>
                      ))}
                    </ul>
                    {guide.tip && (
                      <p className="mt-2 border-t border-border-subtle pt-2 text-[11px] text-ink-dim">
                        Tip: {guide.tip}
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {visibleItems.length < filtered.length && (
        <div className="flex justify-center pt-2">
          <Button
            variant="secondary"
            onClick={() => setVisibleCount((prev) => prev + PAGE_SIZE)}
          >
            Load More ({filtered.length - visibleItems.length} remaining)
          </Button>
        </div>
      )}
    </div>
  );
}
