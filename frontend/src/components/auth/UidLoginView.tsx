import React, { useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, BookOpen, ShieldCheck, Trophy, UserCheck } from "lucide-react";
import { IrminsulLogo } from "@/components/common/IrminsulLogo";
import { Button } from "@/components/ui/button";
import { useSession } from "@/contexts/SessionContext";

export function UidLoginView() {
  const { connectUid, enterGuestMode, isConnecting, error } = useSession();
  const [uidInput, setUidInput] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uidInput.trim()) return;
    try {
      await connectUid(uidInput.trim());
    } catch {
      // error is handled in SessionContext
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-canvas px-4 py-12">
      {/* Subtle botanical ambient glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-96 bg-[radial-gradient(ellipse_70%_50%_at_50%_0%,rgba(36,106,86,0.08),transparent)]"
      />

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="relative z-10 w-full max-w-md"
      >
        <div className="mb-8 flex flex-col items-center text-center">
          <IrminsulLogo className="mb-4 h-12 w-12 shadow-sm" />
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-irminsul">
            Inspired by Irminsul
          </span>
          <h1 className="mt-1.5 font-serif text-5xl tracking-tight text-ink-primary">
            Irminix
          </h1>
          <p className="mt-2 max-w-sm text-sm leading-relaxed text-ink-secondary">
            Genshin Impact character build guides, live UID showcase &amp; achievement tracker.
          </p>
        </div>

        <div className="rounded-3xl border border-border bg-surface p-6 shadow-hover sm:p-7">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <div className="flex items-center justify-between">
                <label
                  htmlFor="genshin-uid"
                  className="text-xs font-medium uppercase tracking-wider text-ink-secondary"
                >
                  Genshin Impact UID
                </label>
                <span className="font-mono text-[10px] text-ink-dim">9–10 digits</span>
              </div>
              <input
                id="genshin-uid"
                type="text"
                inputMode="numeric"
                maxLength={10}
                value={uidInput}
                onChange={(e) => setUidInput(e.target.value.replace(/\D/g, ""))}
                placeholder="e.g. 812454303"
                className="mt-2 w-full rounded-xl border border-border bg-canvas px-4 py-3 font-mono text-sm text-ink-primary transition-colors placeholder:text-ink-dim focus:border-irminsul focus:outline-none"
              />
              <p className="mt-2 flex items-center gap-1.5 text-xs text-ink-dim">
                <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-irminsul" />
                Zero-password Enka.Network lookup. Nothing saved to a database.
              </p>
            </div>

            {error && (
              <div className="rounded-xl border border-[#E8C5BC] bg-[#FBF0ED] px-3.5 py-2.5 text-xs text-[#9A3B26]">
                {error}
              </div>
            )}

            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full rounded-xl"
              disabled={isConnecting || uidInput.length < 9}
            >
              {isConnecting ? "Syncing Traveler Profile..." : "Connect UID & Enter"}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </form>

          <div className="my-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-[11px] uppercase tracking-wider text-ink-dim">or</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <Button
            type="button"
            variant="secondary"
            size="lg"
            className="w-full rounded-xl"
            onClick={enterGuestMode}
          >
            <BookOpen className="h-4 w-4 text-irminsul" />
            Browse Build Codex as Guest
          </Button>
        </div>

        {/* Minimal Capability Strip */}
        <div className="mt-6 grid grid-cols-3 gap-2 text-center text-[11px] text-ink-secondary">
          <div className="flex flex-col items-center gap-1 rounded-xl border border-border-subtle bg-surface/60 py-2.5">
            <BookOpen className="h-3.5 w-3.5 text-irminsul" />
            <span>Community Builds</span>
          </div>
          <div className="flex flex-col items-center gap-1 rounded-xl border border-border-subtle bg-surface/60 py-2.5">
            <UserCheck className="h-3.5 w-3.5 text-irminsul" />
            <span>Live UID Showcase</span>
          </div>
          <div className="flex flex-col items-center gap-1 rounded-xl border border-border-subtle bg-surface/60 py-2.5">
            <Trophy className="h-3.5 w-3.5 text-irminsul" />
            <span>1,900+ Achievements</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
