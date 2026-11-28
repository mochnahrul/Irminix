import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { BookOpen, CheckCircle2, Compass, Sparkles, TrendingUp, UserCheck } from "lucide-react";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useSession } from "@/contexts/SessionContext";
import { cn } from "@/lib/utils";
import { fetchBuildAdvice } from "@/services/api";
import type { BuildAdvisorResponse, CharacterSummary } from "@/types/genshin";

interface AiBuildAdvisorViewProps {
  characters: CharacterSummary[];
  initialCharacter?: string | null;
  initialRole?: string | null;
}

const TONES = [
  { id: "scholar", label: "Balanced" },
  { id: "strategist", label: "Min-Max" },
  { id: "concise", label: "Short" },
] as const;

export function AiBuildAdvisorView({
  characters,
  initialCharacter,
  initialRole,
}: AiBuildAdvisorViewProps) {
  const { uid, profile } = useSession();
  const [selectedName, setSelectedName] = useState<string>(
    initialCharacter || characters[0]?.name || "Arlecchino"
  );
  const [tone, setTone] = useState<"scholar" | "strategist" | "concise">("scholar");
  const [result, setResult] = useState<BuildAdvisorResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const analyzeSeqRef = useRef(0);

  const isInShowcase = useMemo(
    () =>
      Boolean(
        profile?.showcaseCharacters.some(
          (ch) => ch.name.toLowerCase() === selectedName.toLowerCase()
        )
      ),
    [profile, selectedName]
  );

  useEffect(() => {
    if (initialCharacter) {
      setSelectedName(initialCharacter);
    }
  }, [initialCharacter]);

  useEffect(() => {
    if (characters.length > 0) {
      setSelectedName((prev) =>
        prev && characters.some((c) => c.name === prev) ? prev : characters[0].name
      );
    }
  }, [characters]);

  const quickPickNames = useMemo(() => {
    if (profile && profile.showcaseCharacters.length > 0) {
      return profile.showcaseCharacters.map((c) => c.name);
    }
    return ["Arlecchino", "Furina", "Neuvillette", "Mavuika"];
  }, [profile]);

  const handleAnalyze = async (overrideName?: string) => {
    const target = overrideName || selectedName;
    if (!target) return;
    if (overrideName) setSelectedName(overrideName);
    const seq = ++analyzeSeqRef.current;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchBuildAdvice({
        characterName: target,
        uid: uid || undefined,
        role:
          initialCharacter && target.toLowerCase() === initialCharacter.toLowerCase()
            ? initialRole || undefined
            : undefined,
        tone,
      });
      if (analyzeSeqRef.current === seq) {
        setResult(data);
      }
    } catch (err) {
      if (analyzeSeqRef.current === seq) {
        setError(err instanceof Error ? err.message : "Failed to analyze build.");
      }
    } finally {
      if (analyzeSeqRef.current === seq) {
        setLoading(false);
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-3xl border border-border bg-surface p-5 shadow-card sm:p-7">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-12 -top-12 h-56 w-56 rounded-full bg-[radial-gradient(circle,rgba(36,106,86,0.08),transparent_70%)]"
        />
        <div className="relative">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-widest text-irminsul">
              <Sparkles className="h-3.5 w-3.5" />
              Smart Guide
            </span>
            <span className="rounded-full border border-[#B8D8CE] bg-irminsul-soft px-2.5 py-0.5 font-mono text-[11px] font-medium text-irminsul">
              AI-Powered Evaluation
            </span>
          </div>
          <h1 className="mt-1.5 font-serif text-3xl tracking-tight text-ink-primary sm:text-4xl">
            Build Advisor
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-secondary">
            Get a clear build score, what is already working, and what to farm next.
          </p>
        </div>
      </div>

      {/* Modern Controls Bar */}
      <div className="space-y-3 rounded-2xl border border-border bg-surface p-4 shadow-card">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="block font-mono text-[10px] uppercase tracking-wider text-ink-dim">
              Character
            </label>
            <select
              value={selectedName}
              onChange={(e) => setSelectedName(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-border bg-canvas px-3.5 py-2.5 text-sm font-medium text-ink-primary focus:border-irminsul focus:outline-none"
            >
              {characters.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.name} ({c.vision})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-mono text-[10px] uppercase tracking-wider text-ink-dim">
              Advice Style
            </label>
            <div className="mt-1.5 flex items-center gap-1 rounded-xl border border-border bg-surface-subtle p-1">
              {TONES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTone(t.id)}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                    tone === t.id
                      ? "bg-surface text-irminsul shadow-sm"
                      : "text-ink-secondary hover:text-ink-primary"
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <Button
            onClick={() => handleAnalyze()}
            disabled={loading}
            size="lg"
            className="rounded-xl sm:w-auto"
          >
            <Sparkles className="h-4 w-4" />
            {loading ? "Checking..." : "Check Build"}
          </Button>
        </div>

        {/* Quick Pick Row */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1 text-xs">
          <span className="mr-1 font-mono text-[10px] uppercase tracking-wider text-ink-dim">
            {profile?.showcaseCharacters.length ? "Your Showcase:" : "Popular:"}
          </span>
          {quickPickNames.map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => handleAnalyze(name)}
              className={cn(
                "rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors",
                selectedName === name
                  ? "border-irminsul bg-irminsul-soft text-irminsul"
                  : "border-border-subtle bg-surface-subtle text-ink-secondary hover:text-ink-primary"
              )}
            >
              {name}
            </button>
          ))}
        </div>

        {/* Plain-Language Source Indicator */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border-subtle pt-3 text-xs">
          {isInShowcase ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#B8D8CE] bg-irminsul-soft px-2.5 py-0.5 font-medium text-irminsul">
              <UserCheck className="h-3.5 w-3.5" />
              Checking Your Equipped Build
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#E3D3AE] bg-irminsul-goldSoft px-2.5 py-0.5 font-medium text-irminsul-gold">
              <BookOpen className="h-3.5 w-3.5" />
              Recommended Build Plan
            </span>
          )}
          <span className="text-ink-secondary">
            {isInShowcase
              ? `Using your actual weapon & artifacts from UID ${uid}.`
              : uid
              ? `Not in your UID ${uid} Showcase — showing what gear & stats to aim for.`
              : "Showing recommended gear & stats to farm for this character."}
          </span>
        </div>
      </div>

      {!result && !loading && !error && (
        <div className="grid gap-3 rounded-2xl border border-border-subtle bg-surface/60 p-4 text-xs text-ink-secondary sm:grid-cols-3">
          <div className="rounded-xl bg-surface p-3">
            <span className="font-mono text-[10px] font-semibold text-irminsul">STEP 1</span>
            <p className="mt-1 font-medium text-ink-primary">Pick any character</p>
            <p className="mt-0.5 text-ink-dim">Use the dropdown or click a quick-pick character above.</p>
          </div>
          <div className="rounded-xl bg-surface p-3">
            <span className="font-mono text-[10px] font-semibold text-irminsul">STEP 2</span>
            <p className="mt-1 font-medium text-ink-primary">Choose advice style</p>
            <p className="mt-0.5 text-ink-dim">Balanced for general tips, Min-Max for endgame, or Short.</p>
          </div>
          <div className="rounded-xl bg-surface p-3">
            <span className="font-mono text-[10px] font-semibold text-irminsul">STEP 3</span>
            <p className="mt-1 font-medium text-ink-primary">Click Check Build</p>
            <p className="mt-0.5 text-ink-dim">See your build grade, strengths, and next domain to farm.</p>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-[#E8C5BC] bg-[#FBF0ED] p-4 text-xs text-[#9A3B26]">
          {error}
        </div>
      )}

      {loading && <LoadingSpinner label="Evaluating build dimensions..." />}

      {result && !loading && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="space-y-6 rounded-2xl border border-border bg-surface p-6 shadow-card sm:p-7"
        >
          <div className="flex flex-col justify-between gap-4 border-b border-border pb-5 sm:flex-row sm:items-center">
            <div>
              <div className="flex items-center gap-2">
                <Badge className="font-mono">{result.poweredBy}</Badge>
                <span className="font-mono text-xs text-ink-dim">
                  {result.characterName}
                </span>
              </div>
              <h2 className="mt-2 font-serif text-3xl text-ink-primary">
                {result.headline}
              </h2>
              <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-ink-secondary">
                {result.summary}
              </p>
            </div>

            <div className="flex h-20 w-20 shrink-0 flex-col items-center justify-center rounded-2xl border border-[#B8D8CE] bg-irminsul-soft">
              <span className="font-mono text-[10px] uppercase tracking-wider text-irminsul">
                Grade
              </span>
              <span className="font-serif text-3xl font-semibold text-irminsul">
                {result.overallGrade}
              </span>
            </div>
          </div>

          {/* Animated Dimensions */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {result.dimensions.map((d) => (
              <div
                key={d.label}
                className="min-w-0 rounded-xl border border-border-subtle bg-canvas/70 p-3.5"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="text-ink-secondary">{d.label}</span>
                  <span className="font-mono font-semibold text-ink-primary">
                    {d.score}
                  </span>
                </div>
                <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-surface-subtle">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(100, Math.max(0, d.score))}%` }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                    className="h-full rounded-full bg-irminsul"
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-border-subtle bg-canvas/50 p-4">
              <h3 className="flex items-center gap-2 font-heading text-sm font-semibold text-ink-primary">
                <CheckCircle2 className="h-4 w-4 text-irminsul" />
                Strengths
              </h3>
              <ul className="mt-3 space-y-2 text-xs leading-relaxed text-ink-secondary">
                {result.strengths.map((s, i) => (
                  <li key={i}>• {s}</li>
                ))}
              </ul>
            </div>

            <div className="rounded-xl border border-border-subtle bg-canvas/50 p-4">
              <h3 className="flex items-center gap-2 font-heading text-sm font-semibold text-ink-primary">
                <TrendingUp className="h-4 w-4 text-irminsul-gold" />
                Recommended Upgrades
              </h3>
              <ul className="mt-3 space-y-2 text-xs leading-relaxed text-ink-secondary">
                {result.improvements.map((s, i) => (
                  <li key={i}>• {s}</li>
                ))}
              </ul>
            </div>
          </div>

          <div className="flex items-center gap-2.5 rounded-xl border border-[#B8D8CE] bg-irminsul-soft/60 px-4 py-3 text-xs text-irminsul">
            <Compass className="h-4 w-4 shrink-0" />
            <span>
              <strong>Next Resin Priority:</strong> {result.recommendedNextFarm}
            </span>
          </div>
        </motion.div>
      )}
    </div>
  );
}
