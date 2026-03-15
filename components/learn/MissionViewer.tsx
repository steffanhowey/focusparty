"use client";

import { useState, useCallback, useEffect } from "react";
import {
  Copy,
  Check,
  ExternalLink,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import type { PathItem, ItemState, AiTool } from "@/lib/types";

// ─── Types ──────────────────────────────────────────────────

interface MissionViewerProps {
  item: PathItem;
  isCompleted: boolean;
  onComplete: (stateData: Partial<ItemState>) => void;
}

type MissionPhase = "briefing" | "working" | "submission" | "feedback";

interface MissionFeedback {
  feedback: string;
  quality: "strong" | "good" | "needs_work";
  criteria_results?: { criterion: string; passed: boolean }[];
}

// ─── Constants ──────────────────────────────────────────────

const QUALITY_COLORS: Record<string, string> = {
  strong: "var(--color-green-700)",
  good: "var(--color-cyan-700)",
  needs_work: "var(--color-amber-700)",
};

const QUALITY_LABELS: Record<string, string> = {
  strong: "Nailed it",
  good: "Good",
  needs_work: "Needs iteration",
};

const GUIDANCE_LABELS: Record<string, string> = {
  guided: "Guided",
  scaffolded: "Scaffolded",
  independent: "Independent",
  solo: "Solo",
};

// ─── Component ──────────────────────────────────────────────

/**
 * Renders "do" task items — the Tool Mission 4-phase interactive experience.
 * Reads from item.mission (MissionBriefing) for all structured data.
 */
export function MissionViewer({
  item,
  isCompleted,
  onComplete,
}: MissionViewerProps) {
  const mission = item.mission;
  if (!mission) return null;

  const [phase, setPhase] = useState<MissionPhase>("briefing");
  const [submission, setSubmission] = useState("");
  const [feedback, setFeedback] = useState<MissionFeedback | null>(null);
  const [loading, setLoading] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Reset state when navigating to a different item
  useEffect(() => {
    setPhase("briefing");
    setSubmission("");
    setFeedback(null);
    setAttempts(0);
  }, [item.item_id]);

  const tool: AiTool = mission.tool;

  const handleCopyAndOpen = useCallback(() => {
    navigator.clipboard.writeText(mission.tool_prompt).then(
      () => setToastMessage(`Prompt copied! Opening ${tool.name}...`),
      () =>
        setToastMessage(
          "Couldn't copy automatically — copy the prompt above."
        )
    );
    window.open(tool.url, "_blank", "noopener,noreferrer");
    setPhase("working");
  }, [mission.tool_prompt, tool]);

  const handleRecopy = useCallback(() => {
    navigator.clipboard.writeText(mission.tool_prompt).then(
      () => setToastMessage("Prompt re-copied!"),
      () => setToastMessage("Couldn't copy — copy from the briefing.")
    );
  }, [mission.tool_prompt]);

  const handleSubmit = useCallback(async () => {
    if (!submission.trim()) return;
    setLoading(true);
    const attempt = attempts + 1;
    setAttempts(attempt);
    try {
      const res = await fetch("/api/learn/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          practice_type: "tool_challenge",
          question: mission.objective,
          success_criteria: mission.success_criteria.join("; "),
          user_response: submission,
          context: mission.context,
        }),
      });
      const data = await res.json();
      setFeedback(data);
      setPhase("feedback");
    } catch {
      setFeedback({
        feedback: "Could not evaluate right now. Try again later.",
        quality: "good",
      });
      setPhase("feedback");
    } finally {
      setLoading(false);
    }
  }, [submission, mission, attempts]);

  const handleTryAgain = useCallback(() => {
    setPhase("briefing");
    setSubmission("");
    setFeedback(null);
  }, []);

  const handleComplete = useCallback(() => {
    onComplete({
      submission_text: submission || undefined,
      evaluation: feedback
        ? {
            quality:
              feedback.quality === "strong"
                ? "nailed_it"
                : feedback.quality === "good"
                  ? "good"
                  : "needs_iteration",
            feedback: feedback.feedback,
            criteria_results: feedback.criteria_results,
          }
        : undefined,
      attempts: attempts || undefined,
    });
  }, [onComplete, submission, feedback, attempts]);

  const handleSkip = useCallback(() => {
    onComplete({ skipped: true });
  }, [onComplete]);

  if (isCompleted) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-6 p-8 animate-fade-in">
        <Card className="p-6 max-w-2xl w-full">
          <p className="text-xs text-[var(--color-text-tertiary)] flex items-center gap-1.5">
            <Check size={12} style={{ color: "var(--color-green-700)" }} />
            Completed
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center h-full gap-6 p-8 animate-fade-in">
      <Card className="p-6 max-w-2xl w-full space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <p
            className="text-xs font-semibold uppercase tracking-widest"
            style={{ color: "var(--color-accent-primary)" }}
          >
            Tool Mission
          </p>
          <span
            className="text-[10px] font-medium px-2 py-0.5 rounded-full"
            style={{
              background: "rgba(255,255,255,0.08)",
              color: "var(--color-text-tertiary)",
            }}
          >
            {GUIDANCE_LABELS[mission.guidance_level] ?? mission.guidance_level}
          </span>
        </div>

        {/* Objective */}
        <p className="text-sm text-[var(--color-text-primary)] leading-relaxed font-medium">
          {mission.objective}
        </p>

        {/* ── Phase 1: Briefing ── */}
        {phase === "briefing" && (
          <>
            {/* Context */}
            {mission.context && (
              <p className="text-xs text-[var(--color-text-tertiary)] italic">
                {mission.context}
              </p>
            )}

            {/* Steps */}
            {mission.steps.length > 0 && (
              <ol className="space-y-2 pl-5 list-decimal">
                {mission.steps.map((step, i) => (
                  <li
                    key={i}
                    className="text-sm text-[var(--color-text-secondary)] leading-relaxed"
                  >
                    {step}
                  </li>
                ))}
              </ol>
            )}

            {/* Pre-built prompt */}
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-[var(--color-text-secondary)]">
                Your prompt (ready to paste)
              </p>
              <CodeBlock code={mission.tool_prompt} />
            </div>

            {/* Starter code */}
            {mission.starter_code && (
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-[var(--color-text-secondary)]">
                  Starter code
                </p>
                <CodeBlock code={mission.starter_code} />
              </div>
            )}

            {/* Success criteria */}
            {mission.success_criteria.length > 0 && (
              <div
                className="rounded-lg px-3 py-2.5 space-y-1.5"
                style={{
                  background: "var(--color-bg-primary)",
                  border: "1px solid var(--color-border-default)",
                }}
              >
                <p className="text-xs font-medium text-[var(--color-text-secondary)]">
                  Success criteria
                </p>
                {mission.success_criteria.map((c, i) => (
                  <p
                    key={i}
                    className="text-xs text-[var(--color-text-tertiary)] flex items-start gap-1.5"
                  >
                    <span className="shrink-0 mt-0.5">•</span>
                    {c}
                  </p>
                ))}
              </div>
            )}

            {/* Tool CTA */}
            <div className="space-y-2 pt-1">
              <Button
                variant="cta"
                rightIcon={<ExternalLink size={14} />}
                onClick={handleCopyAndOpen}
              >
                Copy Prompt & Open {tool.name}
              </Button>
              <div>
                <Button variant="ghost" size="sm" onClick={handleSkip}>
                  Skip
                </Button>
              </div>
            </div>
          </>
        )}

        {/* ── Phase 2: Working (in external tool) ── */}
        {phase === "working" && (
          <>
            {/* Pinned objective */}
            <div
              className="rounded-lg px-3 py-2.5 text-sm"
              style={{
                background: "var(--color-bg-primary)",
                borderLeft: "3px solid var(--color-accent-primary)",
                color: "var(--color-text-primary)",
              }}
            >
              {mission.objective}
            </div>

            {/* Success criteria reminder */}
            {mission.success_criteria.length > 0 && (
              <div
                className="rounded-lg px-3 py-2.5 text-xs"
                style={{
                  background: "var(--color-bg-primary)",
                  border: "1px solid var(--color-border-default)",
                  color: "var(--color-text-tertiary)",
                }}
              >
                <span className="font-medium text-[var(--color-text-secondary)]">
                  Success looks like:{" "}
                </span>
                {mission.success_criteria.join(" · ")}
              </div>
            )}

            <div className="flex items-center gap-3 pt-1">
              <Button variant="ghost" size="sm" onClick={handleRecopy}>
                Re-copy prompt
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => setPhase("submission")}
              >
                I&apos;m done
              </Button>
            </div>
          </>
        )}

        {/* ── Phase 3: Submission ── */}
        {phase === "submission" && (
          <>
            <p className="text-xs text-[var(--color-text-tertiary)]">
              {mission.submission_type === "screenshot"
                ? "Describe what you built or paste your output below."
                : "Paste your output here so we can check it against the success criteria."}
            </p>

            <textarea
              value={submission}
              onChange={(e) => setSubmission(e.target.value)}
              placeholder="Paste your output here..."
              rows={8}
              className="w-full rounded-lg px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-1"
              style={{
                background: "var(--color-bg-primary)",
                color: "var(--color-text-primary)",
                border: "1px solid var(--color-border-default)",
              }}
            />

            <div className="flex items-center gap-3 pt-1">
              <Button variant="link" size="sm" onClick={handleSkip}>
                Skip this mission
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleSubmit}
                loading={loading}
                disabled={!submission.trim()}
              >
                Submit for review
              </Button>
            </div>
          </>
        )}

        {/* ── Phase 4: Feedback ── */}
        {phase === "feedback" && feedback && (
          <>
            {/* Quality badge */}
            <div className="flex items-center gap-2">
              <span
                className="text-xs font-semibold px-2.5 py-1 rounded-full"
                style={{
                  background: `${QUALITY_COLORS[feedback.quality]}20`,
                  color: QUALITY_COLORS[feedback.quality],
                }}
              >
                {QUALITY_LABELS[feedback.quality] ?? feedback.quality}
              </span>
            </div>

            {/* Per-criterion results */}
            {feedback.criteria_results &&
              feedback.criteria_results.length > 0 && (
                <div className="space-y-1.5">
                  {feedback.criteria_results.map((cr, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-2 text-xs text-[var(--color-text-secondary)]"
                    >
                      {cr.passed ? (
                        <CheckCircle2
                          size={14}
                          className="shrink-0 mt-0.5"
                          style={{ color: "var(--color-green-700)" }}
                        />
                      ) : (
                        <XCircle
                          size={14}
                          className="shrink-0 mt-0.5"
                          style={{ color: "var(--color-amber-700)" }}
                        />
                      )}
                      <span>{cr.criterion}</span>
                    </div>
                  ))}
                </div>
              )}

            {/* Feedback card */}
            <div
              className="rounded-lg px-3 py-2.5 text-sm leading-relaxed"
              style={{
                background: "var(--color-bg-primary)",
                borderLeft: `3px solid ${QUALITY_COLORS[feedback.quality] ?? QUALITY_COLORS.good}`,
                color: "var(--color-text-secondary)",
              }}
            >
              {feedback.feedback}
            </div>

            <div className="flex items-center gap-3 pt-1">
              <Button variant="ghost" size="sm" onClick={handleTryAgain}>
                Try Again
              </Button>
              <Button variant="cta" size="sm" onClick={handleComplete}>
                Continue
              </Button>
            </div>
          </>
        )}
      </Card>

      {/* Toast */}
      {toastMessage && (
        <CopyToast
          message={toastMessage}
          onDismiss={() => setToastMessage(null)}
        />
      )}
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────

function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(code).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [code]);

  return (
    <div
      className="relative rounded-lg overflow-hidden"
      style={{
        background: "var(--color-bg-primary)",
        border: "1px solid var(--color-border-default)",
      }}
    >
      <pre className="p-3 text-xs font-mono overflow-x-auto text-[var(--color-text-secondary)] leading-relaxed">
        {code}
      </pre>
      <button
        onClick={handleCopy}
        className="absolute top-2 right-2 p-1.5 rounded transition-colors hover:bg-white/10"
        title="Copy"
      >
        {copied ? (
          <Check size={12} style={{ color: "var(--color-green-700)" }} />
        ) : (
          <Copy size={12} className="text-[var(--color-text-tertiary)]" />
        )}
      </button>
    </div>
  );
}

function CopyToast({
  message,
  onDismiss,
}: {
  message: string;
  onDismiss: () => void;
}) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 3000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-fade-in">
      <div
        className="px-4 py-2.5 rounded-lg text-sm font-medium shadow-lg"
        style={{
          background: "var(--color-bg-secondary)",
          color: "var(--color-text-primary)",
          border: "1px solid var(--color-border-default)",
        }}
      >
        {message}
      </div>
    </div>
  );
}
