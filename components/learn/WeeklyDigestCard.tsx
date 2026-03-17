"use client";

/**
 * Weekly intelligence digest card for the Learn page.
 * Fetches the latest weekly_digest insight and shows it inline.
 * Dismissable per session via localStorage.
 */

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/Card";
import { Sparkles, X, ArrowRight } from "lucide-react";
import type { SkillIntelligence } from "@/lib/types/intelligence";

const DISMISS_KEY = "fp_digest_dismissed";

export function WeeklyDigestCard() {
  const [digest, setDigest] = useState<SkillIntelligence | null>(null);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    // Check if already dismissed this session
    if (typeof window !== "undefined") {
      const stored = sessionStorage.getItem(DISMISS_KEY);
      if (stored) return;
      setDismissed(false);
    }

    async function load(): Promise<void> {
      try {
        const res = await fetch(
          "/api/intelligence/feed?type=weekly_digest&limit=1"
        );
        if (!res.ok) return;
        const json = (await res.json()) as { insights: SkillIntelligence[] };
        if (json.insights?.length > 0) {
          setDigest(json.insights[0]);
        }
      } catch {
        // Silent fail
      }
    }

    load();
  }, []);

  if (dismissed || !digest) return null;

  const handleDismiss = () => {
    setDismissed(true);
    sessionStorage.setItem(DISMISS_KEY, "1");
  };

  return (
    <Card className="relative p-4 space-y-2 animate-fade-in">
      {/* Dismiss button */}
      <button
        type="button"
        onClick={handleDismiss}
        className="absolute top-3 right-3 p-1 rounded-full transition-colors hover:bg-shell-100 cursor-pointer"
      >
        <X size={14} className="text-shell-500" />
      </button>

      {/* Badge */}
      <div className="flex items-center gap-1.5">
        <Sparkles size={12} style={{ color: "var(--sg-teal-600)" }} />
        <span
          className="text-[10px] font-semibold uppercase tracking-wider"
          style={{ color: "var(--sg-teal-600)" }}
        >
          Weekly Intelligence
        </span>
      </div>

      {/* Content */}
      <h4 className="text-sm font-medium text-shell-900 leading-snug pr-6">
        {digest.headline}
      </h4>
      <p className="text-xs text-shell-500 line-clamp-2">
        {digest.analysis}
      </p>

      {/* Link to Pulse */}
      <a
        href="/pulse"
        className="inline-flex items-center gap-1 text-xs font-medium transition-colors hover:underline"
        style={{ color: "var(--sg-teal-600)" }}
      >
        View full intelligence
        <ArrowRight size={10} />
      </a>
    </Card>
  );
}
