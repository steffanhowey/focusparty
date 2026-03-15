# Sprint 2: Tool Mission UI + Task-Type Rendering

## What This Is

The learning path page currently renders three content types: `video`, `article`, and `practice` (old model). Sprint 1 introduced four task types: `watch`, `do`, `check`, `reflect`. Sprint 2 makes the UI actually render them.

The centerpiece is the **Tool Mission** — a 4-phase interactive experience where users get a mission briefing, open a real AI tool with a pre-copied prompt, come back to submit their work, and get specific AI feedback against success criteria. This is what makes SkillGap different from watching YouTube tutorials.

Read these files before starting:

- `CLAUDE.md` — project conventions (CRITICAL: follow Structured Outputs pattern, design system rules, color tokens)
- `.claude/rules/ui-components.md` — UI component rules (use `<Button>`, `<Card>`, CSS variables)
- `lib/types.ts` (lines 670-940) — `TaskType`, `MissionBriefing`, `QuickCheck`, `ReflectionPrompt`, `PathItem`, `ItemState`, `LearningProgress`
- `components/learn/ContentViewer.tsx` (65 lines) — the router component that decides what to render
- `components/learn/PracticeViewer.tsx` (720 lines) — current practice component (will be replaced)
- `app/(learn)/learn/paths/[id]/page.tsx` (611 lines) — learning environment page
- `components/learn/PathSidebar.tsx` (316 lines) — path navigation sidebar
- `app/api/learn/evaluate/route.ts` (164 lines) — AI evaluation endpoint
- `lib/useLearnProgress.ts` (185 lines) — progress tracking hook
- `lib/learn/toolRegistry.ts` — tool metadata, `buildToolUrl`

---

## Step 1: Rewrite ContentViewer.tsx

**File: `components/learn/ContentViewer.tsx`**

The current ContentViewer routes on `item.content_type` (video/article/practice). Rewrite it to route on `item.task_type` (watch/do/check/reflect), with a backward-compat fallback for old paths that still use `content_type`.

```typescript
"use client";

import React from "react";
import { LearnVideoPlayer } from "./LearnVideoPlayer";
import { ArticleViewer } from "./ArticleViewer";
import { MissionViewer } from "./MissionViewer";
import { QuickCheckViewer } from "./QuickCheckViewer";
import { ReflectionViewer } from "./ReflectionViewer";
import type { PathItem, ItemState } from "@/lib/types";

interface ContentViewerProps {
  item: PathItem;
  itemState: ItemState | null;
  onComplete: (result?: Partial<ItemState>) => void;
  onPlayStateChange?: (playing: boolean) => void;
  togglePlayRef?: React.MutableRefObject<(() => void) | null>;
}

/**
 * Routes to the correct viewer based on the item's task_type.
 * Handles both new (task_type) and legacy (content_type) paths.
 */
export function ContentViewer({
  item,
  itemState,
  onComplete,
  onPlayStateChange,
  togglePlayRef,
}: ContentViewerProps) {
  const taskType = item.task_type ?? (item.content_type === "practice" ? "do" : "watch");

  switch (taskType) {
    case "do":
      return (
        <MissionViewer
          item={item}
          itemState={itemState}
          onComplete={onComplete}
        />
      );

    case "check":
      return (
        <QuickCheckViewer
          item={item}
          itemState={itemState}
          onComplete={onComplete}
        />
      );

    case "reflect":
      return (
        <ReflectionViewer
          item={item}
          itemState={itemState}
          onComplete={onComplete}
        />
      );

    case "watch":
    default:
      if (item.content_type === "video" && item.source_url) {
        return (
          <div className="flex flex-col h-full p-4">
            <LearnVideoPlayer
              sourceUrl={item.source_url}
              title={item.title}
              onComplete={() => onComplete()}
              isCompleted={itemState?.completed ?? false}
              onPlayStateChange={onPlayStateChange}
              togglePlayRef={togglePlayRef}
            />
          </div>
        );
      }

      return (
        <ArticleViewer
          title={item.title}
          creatorName={item.creator_name ?? "Unknown"}
          description={null}
          sourceUrl={item.source_url ?? ""}
          wordCount={item.duration_seconds ? Math.round(item.duration_seconds / 60 * 200) : null}
          publishedAt={null}
          onComplete={() => onComplete()}
          isCompleted={itemState?.completed ?? false}
        />
      );
  }
}
```

Key change: `onComplete` now accepts an optional `Partial<ItemState>` so task viewers can pass back submission data, evaluation results, and skip status. The learning path page will merge this into the progress state.

---

## Step 2: Build MissionViewer.tsx

**New file: `components/learn/MissionViewer.tsx`**

This is the centerpiece. A 4-phase state machine: **briefing → reference → submission → feedback**. It replaces `ToolMissionContent` from the old PracticeViewer.

### Phase 1: Briefing
- Shows the mission objective (1 sentence, bold)
- Context connecting to what was just watched (italic, smaller)
- Pre-built prompt in a styled code block with a prominent copy button
- Numbered step-by-step instructions (from `mission.steps`)
- Success criteria as a checkable list
- Guidance level indicator (guided / scaffolded / independent / solo)
- Primary CTA: "Open in {tool.name}" button with tool icon + ExternalLink icon
- Secondary: "Skip this practice" as a ghost link

### Phase 2: Reference (while user is in external tool)
- Pinned objective at top (accent border-left)
- Success criteria checklist (visible, not collapsed)
- Elapsed timer (counting up from when tool was launched)
- "Re-copy prompt" ghost button
- "I'm done" primary button → transitions to Phase 3

### Phase 3: Submission
- Tab switcher: "Paste text" | "Upload screenshot" (based on `mission.submission_type`)
  - If `submission_type === 'text'`: show only text tab
  - If `submission_type === 'screenshot'`: show only screenshot tab
  - If `submission_type === 'either'`: show both tabs
- Text tab: Large monospace textarea (10 rows), placeholder: "Paste your output here..."
- Screenshot tab: Drag-drop zone with dashed border, accepts image files
  - On drop/select: show image preview with "Remove" option
  - Store as base64 data URL (for sending to evaluate endpoint)
- "Submit for review" primary button (disabled until content present)
- "Skip this practice" ghost link

### Phase 4: Feedback
- Quality badge: colored pill
  - `nailed_it` → green background, "Nailed it" label
  - `good` → cyan background, "Good" label
  - `needs_iteration` → amber background, "Needs iteration" label
- Per-criterion breakdown: list of criteria with CheckCircle2 (green) or XCircle (amber) icons
- Feedback paragraph (2-4 sentences from AI)
- Two CTAs: "Try Again" (ghost, resets to Phase 1) | "Continue" (cta, calls onComplete)
- If "Nailed it": add a subtle celebration effect (brief scale-up + glow on the badge)

### Implementation details

```typescript
"use client";

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import {
  Copy,
  Check,
  ExternalLink,
  CheckCircle2,
  XCircle,
  Upload,
  Clock,
  RotateCcw,
  Sparkles,
  Code,
  Image as ImageIcon,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { buildToolUrl } from "@/lib/learn/toolRegistry";
import type { PathItem, ItemState, MissionBriefing } from "@/lib/types";

type MissionPhase = "briefing" | "reference" | "submission" | "feedback";

interface MissionViewerProps {
  item: PathItem;
  itemState: ItemState | null;
  onComplete: (result?: Partial<ItemState>) => void;
}

// Quality display config — use CSS variables, never raw hex
const QUALITY_CONFIG = {
  nailed_it: {
    label: "Nailed it",
    color: "var(--color-green-700)",
    bg: "var(--color-green-700)",
  },
  good: {
    label: "Good",
    color: "var(--color-cyan-700)",
    bg: "var(--color-cyan-700)",
  },
  needs_iteration: {
    label: "Needs iteration",
    color: "var(--color-amber-700)",
    bg: "var(--color-amber-700)",
  },
};

const GUIDANCE_LABELS: Record<string, string> = {
  guided: "Guided — full prompt + detailed steps",
  scaffolded: "Scaffolded — partial prompt + high-level steps",
  independent: "Independent — goal only, you write the prompt",
  solo: "Solo Challenge — no help, prove your skills",
};
```

**Phase management:**

```typescript
export function MissionViewer({ item, itemState, onComplete }: MissionViewerProps) {
  const mission = item.mission;

  // If no mission data, fall back to a simple complete button
  if (!mission) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-6 p-8">
        <Card className="p-6 max-w-2xl w-full space-y-4 text-center">
          <p className="text-sm text-[var(--color-text-secondary)]">{item.title}</p>
          <Button variant="cta" onClick={() => onComplete()}>
            Mark Complete
          </Button>
        </Card>
      </div>
    );
  }

  // If already completed and has evaluation, show feedback
  if (itemState?.completed && itemState.evaluation) {
    return <CompletedMissionView item={item} itemState={itemState} />;
  }

  return <ActiveMission item={item} mission={mission} onComplete={onComplete} />;
}
```

**ActiveMission** handles the 4 phases:

```typescript
function ActiveMission({
  item,
  mission,
  onComplete,
}: {
  item: PathItem;
  mission: MissionBriefing;
  onComplete: (result?: Partial<ItemState>) => void;
}) {
  const [phase, setPhase] = useState<MissionPhase>("briefing");
  const [submission, setSubmission] = useState("");
  const [screenshotData, setScreenshotData] = useState<string | null>(null);
  const [submissionTab, setSubmissionTab] = useState<"text" | "screenshot">(
    mission.submission_type === "screenshot" ? "screenshot" : "text"
  );
  const [feedback, setFeedback] = useState<ItemState["evaluation"] | null>(null);
  const [loading, setLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [attempts, setAttempts] = useState(0);
  const toolLaunchedAt = useRef<number | null>(null);
  const [elapsed, setElapsed] = useState(0);

  // Reset when item changes
  useEffect(() => {
    setPhase("briefing");
    setSubmission("");
    setScreenshotData(null);
    setFeedback(null);
    setAttempts(0);
    toolLaunchedAt.current = null;
    setElapsed(0);
  }, [item.item_id]);

  // Elapsed timer during reference phase
  useEffect(() => {
    if (phase !== "reference") return;
    const interval = setInterval(() => {
      if (toolLaunchedAt.current) {
        setElapsed(Math.floor((Date.now() - toolLaunchedAt.current) / 1000));
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [phase]);

  const handleCopyAndOpen = useCallback(() => {
    const prompt = mission.tool_prompt;
    navigator.clipboard.writeText(prompt).then(
      () => setToastMessage(`Prompt copied! Paste it in ${mission.tool.name}.`),
      () => setToastMessage("Couldn't copy automatically — use the copy button above.")
    );
    const url = buildToolUrl(mission.tool, prompt);
    window.open(url, "_blank", "noopener,noreferrer");
    toolLaunchedAt.current = Date.now();
    setPhase("reference");
  }, [mission]);

  const handleRecopy = useCallback(() => {
    navigator.clipboard.writeText(mission.tool_prompt).then(
      () => setToastMessage("Prompt re-copied!"),
      () => setToastMessage("Couldn't copy — use the code block above.")
    );
  }, [mission.tool_prompt]);

  const handleSubmit = useCallback(async () => {
    const hasText = submission.trim().length > 0;
    const hasScreenshot = !!screenshotData;
    if (!hasText && !hasScreenshot) return;

    setLoading(true);
    setAttempts((prev) => prev + 1);

    try {
      const res = await fetch("/api/learn/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          practice_type: "tool_mission",
          question: mission.objective,
          success_criteria: mission.success_criteria,
          user_response: hasText ? submission : "[Screenshot submitted]",
          image_data: screenshotData ?? undefined,
          context: mission.context,
          tool_name: mission.tool.name,
        }),
      });
      const data = await res.json();

      // Map old quality labels to new ones if needed
      const quality = data.quality === "strong" ? "nailed_it"
        : data.quality === "needs_work" ? "needs_iteration"
        : data.quality ?? "good";

      setFeedback({
        quality,
        feedback: data.feedback,
        criteria_results: data.criteria_results,
      });
      setPhase("feedback");
    } catch {
      setFeedback({
        quality: "good",
        feedback: "Could not evaluate right now. Your submission has been saved. Try again later.",
      });
      setPhase("feedback");
    } finally {
      setLoading(false);
    }
  }, [submission, screenshotData, mission]);

  const handleContinue = useCallback(() => {
    const timeSpent = toolLaunchedAt.current
      ? Math.floor((Date.now() - toolLaunchedAt.current) / 1000)
      : 0;

    onComplete({
      completed: true,
      completed_at: new Date().toISOString(),
      time_spent_seconds: timeSpent,
      submission_text: submission || undefined,
      submission_image_url: screenshotData || undefined,
      evaluation: feedback ?? undefined,
      attempts,
    });
  }, [onComplete, submission, screenshotData, feedback, attempts]);

  const handleSkip = useCallback(() => {
    onComplete({
      completed: true,
      skipped: true,
    });
  }, [onComplete]);

  const handleTryAgain = useCallback(() => {
    setPhase("briefing");
    setSubmission("");
    setScreenshotData(null);
    setFeedback(null);
  }, []);

  // Render each phase...
  // (See detailed phase rendering below)
}
```

**Phase 1 — Briefing JSX:**

```tsx
{phase === "briefing" && (
  <div className="flex flex-col items-center justify-center h-full gap-6 p-8 animate-fade-in">
    <Card className="p-6 max-w-2xl w-full space-y-5">
      {/* Header */}
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span
            className="text-[10px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full"
            style={{
              background: "rgba(var(--color-accent-primary-rgb, 249,115,22), 0.15)",
              color: "var(--color-accent-primary)",
            }}
          >
            Tool Mission
          </span>
          <span
            className="text-[10px] uppercase tracking-wider"
            style={{ color: "var(--color-text-tertiary)" }}
          >
            {GUIDANCE_LABELS[mission.guidance_level] ?? mission.guidance_level}
          </span>
        </div>
        <h2 className="text-lg font-bold text-[var(--color-text-primary)] leading-snug">
          {mission.objective}
        </h2>
      </div>

      {/* Context */}
      {mission.context && (
        <p className="text-sm italic text-[var(--color-text-tertiary)]">
          {mission.context}
        </p>
      )}

      {/* Pre-built prompt (only for guided/scaffolded) */}
      {mission.tool_prompt && mission.guidance_level !== "solo" && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-[var(--color-text-secondary)]">
            Your prompt (ready to paste in {mission.tool.name})
          </p>
          <PromptCodeBlock code={mission.tool_prompt} />
        </div>
      )}

      {/* Steps (not shown for solo) */}
      {mission.steps.length > 0 && mission.guidance_level !== "solo" && (
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

      {/* Starter code */}
      {mission.starter_code && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-[var(--color-text-secondary)]">
            Starter code
          </p>
          <PromptCodeBlock code={mission.starter_code} />
        </div>
      )}

      {/* Success criteria */}
      <div
        className="rounded-lg px-4 py-3 space-y-2"
        style={{
          background: "var(--color-bg-primary)",
          border: "1px solid var(--color-border-default)",
        }}
      >
        <p className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wide">
          Success criteria
        </p>
        {mission.success_criteria.map((criterion, i) => (
          <div
            key={i}
            className="flex items-start gap-2 text-sm text-[var(--color-text-secondary)]"
          >
            <span className="shrink-0 mt-0.5 w-4 h-4 rounded-sm border border-[var(--color-border-default)]" />
            <span>{criterion}</span>
          </div>
        ))}
      </div>

      {/* CTAs */}
      <div className="flex items-center gap-3 pt-2">
        <Button
          variant="cta"
          rightIcon={<ExternalLink size={14} />}
          onClick={handleCopyAndOpen}
        >
          Open in {mission.tool.name}
        </Button>
        <Button variant="link" size="sm" onClick={handleSkip}>
          Skip this practice
        </Button>
      </div>
    </Card>
  </div>
)}
```

**Phase 2 — Reference JSX:**

```tsx
{phase === "reference" && (
  <div className="flex flex-col items-center justify-center h-full gap-6 p-8 animate-fade-in">
    <Card className="p-6 max-w-2xl w-full space-y-5">
      {/* Pinned objective */}
      <div
        className="rounded-lg px-4 py-3"
        style={{
          background: "var(--color-bg-primary)",
          borderLeft: "3px solid var(--color-accent-primary)",
        }}
      >
        <p className="text-sm font-semibold text-[var(--color-text-primary)]">
          {mission.objective}
        </p>
      </div>

      {/* Success criteria */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wide">
          Checklist
        </p>
        {mission.success_criteria.map((criterion, i) => (
          <div
            key={i}
            className="flex items-start gap-2 text-sm text-[var(--color-text-secondary)]"
          >
            <span className="shrink-0 mt-0.5 w-4 h-4 rounded-sm border border-[var(--color-border-default)]" />
            <span>{criterion}</span>
          </div>
        ))}
      </div>

      {/* Timer */}
      <div className="flex items-center gap-2 text-xs text-[var(--color-text-tertiary)]">
        <Clock size={12} />
        <span>{formatElapsed(elapsed)}</span>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 pt-1">
        <Button variant="ghost" size="sm" onClick={handleRecopy}>
          <RotateCcw size={12} className="mr-1.5" />
          Re-copy prompt
        </Button>
        <Button variant="primary" size="sm" onClick={() => setPhase("submission")}>
          I&apos;m done
        </Button>
      </div>
    </Card>
  </div>
)}
```

**Phase 3 — Submission JSX:**

```tsx
{phase === "submission" && (
  <div className="flex flex-col items-center justify-center h-full gap-6 p-8 animate-fade-in">
    <Card className="p-6 max-w-2xl w-full space-y-5">
      <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
        Submit your work
      </h3>

      {/* Tab switcher (only if submission_type === 'either') */}
      {mission.submission_type === "either" && (
        <div className="flex gap-1 p-1 rounded-lg" style={{ background: "var(--color-bg-primary)" }}>
          <button
            onClick={() => setSubmissionTab("text")}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition-colors"
            style={{
              background: submissionTab === "text" ? "var(--color-bg-secondary)" : "transparent",
              color: submissionTab === "text" ? "var(--color-text-primary)" : "var(--color-text-tertiary)",
            }}
          >
            <Code size={12} /> Paste text
          </button>
          <button
            onClick={() => setSubmissionTab("screenshot")}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition-colors"
            style={{
              background: submissionTab === "screenshot" ? "var(--color-bg-secondary)" : "transparent",
              color: submissionTab === "screenshot" ? "var(--color-text-primary)" : "var(--color-text-tertiary)",
            }}
          >
            <ImageIcon size={12} /> Screenshot
          </button>
        </div>
      )}

      {/* Text input */}
      {(mission.submission_type === "text" || submissionTab === "text") &&
        mission.submission_type !== "screenshot" && (
          <textarea
            value={submission}
            onChange={(e) => setSubmission(e.target.value)}
            placeholder="Paste your output here..."
            rows={10}
            className="w-full rounded-lg px-3 py-2.5 text-sm font-mono resize-none focus:outline-none focus:ring-1"
            style={{
              background: "var(--color-bg-primary)",
              color: "var(--color-text-primary)",
              border: "1px solid var(--color-border-default)",
            }}
          />
        )}

      {/* Screenshot upload */}
      {(mission.submission_type === "screenshot" || submissionTab === "screenshot") &&
        mission.submission_type !== "text" && (
          <ScreenshotDropZone
            screenshotData={screenshotData}
            onScreenshot={setScreenshotData}
          />
        )}

      {/* Paste instruction */}
      <p className="text-xs text-[var(--color-text-tertiary)]">
        {mission.tool.paste_instruction}
      </p>

      {/* Actions */}
      <div className="flex items-center gap-3 pt-1">
        <Button variant="link" size="sm" onClick={handleSkip}>
          Skip this practice
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={handleSubmit}
          loading={loading}
          disabled={!submission.trim() && !screenshotData}
        >
          Submit for review
        </Button>
      </div>
    </Card>
  </div>
)}
```

**Phase 4 — Feedback JSX:**

```tsx
{phase === "feedback" && feedback && (
  <div className="flex flex-col items-center justify-center h-full gap-6 p-8 animate-fade-in">
    <Card className="p-6 max-w-2xl w-full space-y-5">
      {/* Quality badge */}
      <div className="flex items-center gap-2">
        <span
          className="text-xs font-semibold px-3 py-1 rounded-full"
          style={{
            background: `${QUALITY_CONFIG[feedback.quality]?.bg ?? "var(--color-cyan-700)"}20`,
            color: QUALITY_CONFIG[feedback.quality]?.color ?? "var(--color-cyan-700)",
          }}
        >
          {QUALITY_CONFIG[feedback.quality]?.label ?? feedback.quality}
        </span>
        {feedback.quality === "nailed_it" && (
          <Sparkles size={16} style={{ color: "var(--color-green-700)" }} className="animate-pulse" />
        )}
      </div>

      {/* Per-criterion results */}
      {feedback.criteria_results && feedback.criteria_results.length > 0 && (
        <div className="space-y-2">
          {feedback.criteria_results.map((cr, i) => (
            <div
              key={i}
              className="flex items-start gap-2 text-sm text-[var(--color-text-secondary)]"
            >
              {cr.passed ? (
                <CheckCircle2
                  size={16}
                  className="shrink-0 mt-0.5"
                  style={{ color: "var(--color-green-700)" }}
                />
              ) : (
                <XCircle
                  size={16}
                  className="shrink-0 mt-0.5"
                  style={{ color: "var(--color-amber-700)" }}
                />
              )}
              <span>{cr.criterion}</span>
            </div>
          ))}
        </div>
      )}

      {/* Feedback text */}
      <div
        className="rounded-lg px-4 py-3 text-sm leading-relaxed"
        style={{
          background: "var(--color-bg-primary)",
          borderLeft: `3px solid ${QUALITY_CONFIG[feedback.quality]?.color ?? "var(--color-cyan-700)"}`,
          color: "var(--color-text-secondary)",
        }}
      >
        {feedback.feedback}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 pt-2">
        <Button variant="ghost" size="sm" onClick={handleTryAgain}>
          Try Again
        </Button>
        <Button variant="cta" size="sm" onClick={handleContinue}>
          Continue
        </Button>
      </div>
    </Card>
  </div>
)}
```

**Helper sub-components** (define in the same file):

```typescript
/** Styled code block with copy button */
function PromptCodeBlock({ code }: { code: string }) {
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
      <pre className="p-3 pr-10 text-xs font-mono overflow-x-auto text-[var(--color-text-secondary)] leading-relaxed whitespace-pre-wrap">
        {code}
      </pre>
      <button
        onClick={handleCopy}
        className="absolute top-2 right-2 p-1.5 rounded transition-colors hover:bg-white/10"
        title="Copy prompt"
      >
        {copied ? (
          <Check size={14} style={{ color: "var(--color-green-700)" }} />
        ) : (
          <Copy size={14} className="text-[var(--color-text-tertiary)]" />
        )}
      </button>
    </div>
  );
}

/** Drag-and-drop screenshot upload zone */
function ScreenshotDropZone({
  screenshotData,
  onScreenshot,
}: {
  screenshotData: string | null;
  onScreenshot: (data: string | null) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFile = useCallback(
    (file: File) => {
      if (!file.type.startsWith("image/")) return;
      const reader = new FileReader();
      reader.onload = () => onScreenshot(reader.result as string);
      reader.readAsDataURL(file);
    },
    [onScreenshot]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  if (screenshotData) {
    return (
      <div className="space-y-2">
        <img
          src={screenshotData}
          alt="Screenshot preview"
          className="rounded-lg max-h-64 object-contain w-full"
          style={{ border: "1px solid var(--color-border-default)" }}
        />
        <Button variant="ghost" size="xs" onClick={() => onScreenshot(null)}>
          Remove
        </Button>
      </div>
    );
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      onClick={() => fileInputRef.current?.click()}
      className="flex flex-col items-center justify-center gap-2 rounded-lg py-10 cursor-pointer transition-colors"
      style={{
        border: `2px dashed ${isDragging ? "var(--color-accent-primary)" : "var(--color-border-default)"}`,
        background: isDragging ? "rgba(var(--color-accent-primary-rgb, 249,115,22), 0.05)" : "var(--color-bg-primary)",
      }}
    >
      <Upload size={24} className="text-[var(--color-text-tertiary)]" />
      <p className="text-xs text-[var(--color-text-tertiary)]">
        Drag & drop a screenshot, or click to select
      </p>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />
    </div>
  );
}

/** Completed mission read-only view */
function CompletedMissionView({
  item,
  itemState,
}: {
  item: PathItem;
  itemState: ItemState;
}) {
  const eval_ = itemState.evaluation;
  return (
    <div className="flex flex-col items-center justify-center h-full gap-6 p-8">
      <Card className="p-6 max-w-2xl w-full space-y-4">
        <div className="flex items-center gap-2">
          <Check size={16} style={{ color: "var(--color-green-700)" }} />
          <span className="text-sm font-medium text-[var(--color-text-primary)]">
            {item.title}
          </span>
        </div>
        {eval_ && (
          <span
            className="text-xs font-semibold px-2.5 py-1 rounded-full inline-block"
            style={{
              background: `${QUALITY_CONFIG[eval_.quality]?.bg ?? "var(--color-cyan-700)"}20`,
              color: QUALITY_CONFIG[eval_.quality]?.color ?? "var(--color-cyan-700)",
            }}
          >
            {QUALITY_CONFIG[eval_.quality]?.label ?? eval_.quality}
          </span>
        )}
        {eval_?.feedback && (
          <p className="text-sm text-[var(--color-text-tertiary)]">{eval_.feedback}</p>
        )}
      </Card>
    </div>
  );
}

/** Format elapsed seconds as mm:ss */
function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/** Toast notification */
function CopyToast({ message, onDismiss }: { message: string; onDismiss: () => void }) {
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
```

Render the toast inside `ActiveMission`:
```tsx
{toastMessage && <CopyToast message={toastMessage} onDismiss={() => setToastMessage(null)} />}
```

---

## Step 3: Build QuickCheckViewer.tsx

**New file: `components/learn/QuickCheckViewer.tsx`**

Quick comprehension check with multiple-choice or free-text, 2-attempt limit, hints.

```typescript
"use client";

import { useState, useCallback } from "react";
import { Check, HelpCircle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import type { PathItem, ItemState } from "@/lib/types";

interface QuickCheckViewerProps {
  item: PathItem;
  itemState: ItemState | null;
  onComplete: (result?: Partial<ItemState>) => void;
}

export function QuickCheckViewer({ item, itemState, onComplete }: QuickCheckViewerProps) {
  const check = item.check;
  if (!check) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8">
        <Card className="p-6 max-w-lg w-full text-center space-y-4">
          <p className="text-sm text-[var(--color-text-secondary)]">{item.title}</p>
          <Button variant="cta" onClick={() => onComplete()}>Continue</Button>
        </Card>
      </div>
    );
  }

  // Already completed
  if (itemState?.completed) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8">
        <Card className="p-6 max-w-lg w-full space-y-3">
          <div className="flex items-center gap-2">
            <Check size={16} style={{ color: "var(--color-green-700)" }} />
            <span className="text-sm font-medium text-[var(--color-text-primary)]">
              {item.title}
            </span>
          </div>
          <p className="text-sm text-[var(--color-text-tertiary)]">
            Answer: {check.correct_answer}
          </p>
        </Card>
      </div>
    );
  }

  return <ActiveQuickCheck check={check} item={item} onComplete={onComplete} />;
}

function ActiveQuickCheck({
  check,
  item,
  onComplete,
}: {
  check: NonNullable<PathItem["check"]>;
  item: PathItem;
  onComplete: (result?: Partial<ItemState>) => void;
}) {
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [freeText, setFreeText] = useState("");
  const [attempts, setAttempts] = useState(0);
  const [showHint, setShowHint] = useState(false);
  const [result, setResult] = useState<"correct" | "wrong" | "revealed" | null>(null);
  const [loading, setLoading] = useState(false);

  const isMultipleChoice = check.options && check.options.length > 0;
  const maxAttempts = 2;

  const handleCheck = useCallback(async () => {
    const answer = isMultipleChoice ? selectedOption : freeText.trim();
    if (!answer) return;

    const newAttempts = attempts + 1;
    setAttempts(newAttempts);

    if (isMultipleChoice) {
      // Direct comparison for MC
      if (answer === check.correct_answer) {
        setResult("correct");
        setTimeout(() => {
          onComplete({ completed: true, attempts: newAttempts });
        }, 1200);
      } else if (newAttempts >= maxAttempts) {
        setResult("revealed");
      } else {
        setResult("wrong");
        setShowHint(true);
        // Reset for retry
        setTimeout(() => {
          setResult(null);
          setSelectedOption(null);
        }, 2000);
      }
    } else {
      // AI evaluation for free-text
      setLoading(true);
      try {
        const res = await fetch("/api/learn/evaluate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            practice_type: "quick_check",
            question: check.question,
            reference_answer: check.correct_answer,
            user_response: answer,
          }),
        });
        const data = await res.json();
        const isCorrect = data.quality === "strong" || data.quality === "nailed_it";

        if (isCorrect) {
          setResult("correct");
          setTimeout(() => {
            onComplete({ completed: true, attempts: newAttempts });
          }, 1200);
        } else if (newAttempts >= maxAttempts) {
          setResult("revealed");
        } else {
          setResult("wrong");
          setShowHint(true);
          setTimeout(() => {
            setResult(null);
            setFreeText("");
          }, 2000);
        }
      } catch {
        // On error, be generous — count as correct
        setResult("correct");
        setTimeout(() => {
          onComplete({ completed: true, attempts: newAttempts });
        }, 1200);
      } finally {
        setLoading(false);
      }
    }
  }, [selectedOption, freeText, attempts, check, isMultipleChoice, onComplete]);

  const handleRevealContinue = useCallback(() => {
    onComplete({ completed: true, attempts });
  }, [onComplete, attempts]);

  return (
    <div className="flex flex-col items-center justify-center h-full gap-6 p-8 animate-fade-in">
      <Card className="p-6 max-w-lg w-full space-y-5">
        {/* Header */}
        <div className="space-y-1">
          <span
            className="text-[10px] font-semibold uppercase tracking-widest"
            style={{ color: "var(--color-cyan-700)" }}
          >
            Quick Check
          </span>
          <p className="text-sm font-semibold text-[var(--color-text-primary)] leading-relaxed">
            {check.question}
          </p>
        </div>

        {/* Multiple choice options */}
        {isMultipleChoice && result !== "revealed" && (
          <div className="space-y-2">
            {check.options!.map((option) => {
              const isSelected = selectedOption === option;
              const isCorrectAnswer = option === check.correct_answer;
              const showCorrect = result === "correct" && isCorrectAnswer;

              return (
                <button
                  key={option}
                  onClick={() => !result && setSelectedOption(option)}
                  disabled={!!result}
                  className="w-full text-left px-4 py-3 rounded-lg text-sm transition-all"
                  style={{
                    background: showCorrect
                      ? "rgba(34,197,94,0.1)"
                      : isSelected
                        ? "var(--color-bg-hover)"
                        : "var(--color-bg-primary)",
                    border: `1px solid ${
                      showCorrect
                        ? "var(--color-green-700)"
                        : isSelected
                          ? "var(--color-accent-primary)"
                          : "var(--color-border-default)"
                    }`,
                    color: "var(--color-text-primary)",
                    cursor: result ? "default" : "pointer",
                  }}
                >
                  {option}
                </button>
              );
            })}
          </div>
        )}

        {/* Free text input */}
        {!isMultipleChoice && result !== "revealed" && (
          <textarea
            value={freeText}
            onChange={(e) => setFreeText(e.target.value)}
            placeholder="Type your answer..."
            rows={3}
            className="w-full rounded-lg px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-1"
            style={{
              background: "var(--color-bg-primary)",
              color: "var(--color-text-primary)",
              border: "1px solid var(--color-border-default)",
            }}
          />
        )}

        {/* Hint */}
        {showHint && result !== "revealed" && (
          <div className="flex items-start gap-2 text-xs" style={{ color: "var(--color-amber-700)" }}>
            <HelpCircle size={14} className="shrink-0 mt-0.5" />
            <span>{check.hint}</span>
          </div>
        )}

        {/* Correct animation */}
        {result === "correct" && (
          <div className="flex items-center gap-2 animate-fade-in">
            <Check size={18} style={{ color: "var(--color-green-700)" }} />
            <span className="text-sm font-medium" style={{ color: "var(--color-green-700)" }}>
              Correct!
            </span>
          </div>
        )}

        {/* Revealed answer */}
        {result === "revealed" && (
          <div className="space-y-3 animate-fade-in">
            <p className="text-xs text-[var(--color-text-tertiary)]">
              The answer is:
            </p>
            <div
              className="rounded-lg px-4 py-3 text-sm"
              style={{
                background: "rgba(34,197,94,0.08)",
                border: "1px solid var(--color-green-700)",
                color: "var(--color-text-primary)",
              }}
            >
              {check.correct_answer}
            </div>
            <Button variant="cta" size="sm" onClick={handleRevealContinue}>
              Continue
            </Button>
          </div>
        )}

        {/* Submit button (when not yet answered) */}
        {!result && (
          <Button
            variant="primary"
            size="sm"
            onClick={handleCheck}
            loading={loading}
            disabled={isMultipleChoice ? !selectedOption : !freeText.trim()}
          >
            Check Answer
          </Button>
        )}
      </Card>
    </div>
  );
}
```

---

## Step 4: Build ReflectionViewer.tsx

**New file: `components/learn/ReflectionViewer.tsx`**

Open-ended reflection with min-length validation and conversational AI feedback.

```typescript
"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import type { PathItem, ItemState } from "@/lib/types";

interface ReflectionViewerProps {
  item: PathItem;
  itemState: ItemState | null;
  onComplete: (result?: Partial<ItemState>) => void;
}

export function ReflectionViewer({ item, itemState, onComplete }: ReflectionViewerProps) {
  const reflection = item.reflection;
  if (!reflection) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8">
        <Card className="p-6 max-w-lg w-full text-center space-y-4">
          <p className="text-sm text-[var(--color-text-secondary)]">{item.title}</p>
          <Button variant="cta" onClick={() => onComplete()}>Continue</Button>
        </Card>
      </div>
    );
  }

  if (itemState?.completed) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8">
        <Card className="p-6 max-w-lg w-full space-y-3">
          <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--color-purple-700, #a855f7)" }}>
            Reflection Complete
          </p>
          {itemState.submission_text && (
            <p className="text-sm text-[var(--color-text-tertiary)] italic">
              &ldquo;{itemState.submission_text.slice(0, 200)}...&rdquo;
            </p>
          )}
        </Card>
      </div>
    );
  }

  return <ActiveReflection reflection={reflection} item={item} onComplete={onComplete} />;
}

function ActiveReflection({
  reflection,
  item,
  onComplete,
}: {
  reflection: NonNullable<PathItem["reflection"]>;
  item: PathItem;
  onComplete: (result?: Partial<ItemState>) => void;
}) {
  const [response, setResponse] = useState("");
  const [aiFeedback, setAiFeedback] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const minLength = reflection.min_length ?? 50;
  const isLongEnough = response.trim().length >= minLength;

  const handleSubmit = useCallback(async () => {
    if (!isLongEnough) return;
    setLoading(true);

    try {
      const res = await fetch("/api/learn/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          practice_type: "reflection",
          question: reflection.prompt,
          user_response: response,
        }),
      });
      const data = await res.json();
      setAiFeedback(data.feedback ?? "Thank you for reflecting on this.");
    } catch {
      setAiFeedback("Thank you for reflecting on this. Your thoughts have been saved.");
    } finally {
      setLoading(false);
    }
  }, [response, reflection, isLongEnough]);

  const handleContinue = useCallback(() => {
    onComplete({
      completed: true,
      submission_text: response,
    });
  }, [onComplete, response]);

  return (
    <div className="flex flex-col items-center justify-center h-full gap-6 p-8 animate-fade-in">
      <Card className="p-6 max-w-lg w-full space-y-5">
        {/* Header */}
        <div className="space-y-1">
          <span
            className="text-[10px] font-semibold uppercase tracking-widest"
            style={{ color: "var(--color-purple-700, #a855f7)" }}
          >
            Reflect
          </span>
          <p className="text-sm font-semibold text-[var(--color-text-primary)] leading-relaxed">
            {reflection.prompt}
          </p>
        </div>

        {/* Textarea */}
        {!aiFeedback && (
          <>
            <textarea
              value={response}
              onChange={(e) => setResponse(e.target.value)}
              placeholder="Share your thoughts..."
              rows={6}
              className="w-full rounded-lg px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-1"
              style={{
                background: "var(--color-bg-primary)",
                color: "var(--color-text-primary)",
                border: "1px solid var(--color-border-default)",
              }}
            />
            <div className="flex items-center justify-between">
              <span className="text-xs text-[var(--color-text-tertiary)]">
                {response.trim().length}/{minLength} characters minimum
              </span>
              <Button
                variant="primary"
                size="sm"
                onClick={handleSubmit}
                loading={loading}
                disabled={!isLongEnough}
              >
                Share Reflection
              </Button>
            </div>
          </>
        )}

        {/* AI response */}
        {aiFeedback && (
          <>
            <div
              className="rounded-lg px-4 py-3 text-sm leading-relaxed"
              style={{
                background: "var(--color-bg-primary)",
                borderLeft: "3px solid var(--color-purple-700, #a855f7)",
                color: "var(--color-text-secondary)",
              }}
            >
              {aiFeedback}
            </div>
            <Button variant="cta" size="sm" onClick={handleContinue}>
              Continue
            </Button>
          </>
        )}
      </Card>
    </div>
  );
}
```

---

## Step 5: Update the Evaluate Endpoint

**File: `app/api/learn/evaluate/route.ts`**

The endpoint needs three changes:

### 5a. Support the new practice types

Update the `EvaluateRequest` interface:

```typescript
interface EvaluateRequest {
  practice_type: string; // 'tool_mission' | 'quick_check' | 'reflection' | legacy types
  question: string;
  reference_answer?: string;
  user_response: string;
  success_criteria?: string[]; // Now an array, not a string
  context?: string;
  tool_name?: string;
  image_data?: string; // base64 data URL for screenshot submissions
}
```

### 5b. Add a reflection system prompt

Add after the existing `TOOL_CHALLENGE_SYSTEM_PROMPT`:

```typescript
const REFLECTION_SYSTEM_PROMPT = `You are a thoughtful learning coach responding to a student's reflection.

The student was asked to connect what they learned to their personal context. They wrote a reflection.

Rules:
- Respond conversationally, not as an evaluator. This is NOT graded.
- Acknowledge something specific they said ("Your point about X is insightful").
- Add one thought, question, or connection they might not have considered.
- Keep it to 2-3 sentences. Warm tone.
- Never use quality ratings for reflections — every thoughtful reflection is valid.

${SAFETY_PROMPT}`;
```

### 5c. Update the POST handler

Replace the handler logic to support the new types. Key changes:
- `tool_mission` uses the existing tool challenge schema BUT with `success_criteria` as an array (join with newlines)
- `quick_check` uses the standard schema
- `reflection` uses the reflection system prompt AND returns only `{ feedback }` — no quality rating
- `image_data` is added to the user prompt as a vision message if present

```typescript
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body = (await request.json()) as EvaluateRequest;

    if (!body.user_response?.trim() || !body.question?.trim()) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const practiceType = body.practice_type;

    // ── Reflection: conversational, no grade ──
    if (practiceType === "reflection") {
      const response = await getClient().chat.completions.create({
        model: "gpt-4o-mini",
        max_tokens: 256,
        temperature: 0.7,
        messages: [
          { role: "system", content: REFLECTION_SYSTEM_PROMPT },
          {
            role: "user",
            content: `Reflection prompt: ${body.question}\n\nStudent's reflection:\n${body.user_response}`,
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "reflection_feedback",
            strict: true,
            schema: {
              type: "object",
              properties: {
                feedback: { type: "string" },
              },
              required: ["feedback"],
              additionalProperties: false,
            },
          },
        },
      });

      const text = response.choices[0]?.message?.content;
      if (!text) return NextResponse.json({ feedback: "Thank you for sharing your thoughts." });
      return NextResponse.json(JSON.parse(text));
    }

    // ── Tool mission or legacy tool_challenge ──
    const isToolMission =
      practiceType === "tool_mission" || practiceType === "tool_challenge";

    // Build success criteria string from array or string
    const criteriaText = Array.isArray(body.success_criteria)
      ? body.success_criteria.map((c, i) => `${i + 1}. ${c}`).join("\n")
      : body.success_criteria ?? "";

    // Build messages — support vision for screenshot submissions
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      {
        role: "system",
        content: isToolMission ? TOOL_CHALLENGE_SYSTEM_PROMPT : SYSTEM_PROMPT,
      },
    ];

    if (body.image_data && body.image_data.startsWith("data:image/")) {
      // Vision: send image + text as multipart content
      messages.push({
        role: "user",
        content: [
          {
            type: "text",
            text: [
              `Practice type: ${practiceType}`,
              `Challenge: ${body.question}`,
              criteriaText ? `Success criteria:\n${criteriaText}` : null,
              body.context ? `Context: ${body.context}` : null,
              body.tool_name ? `Tool used: ${body.tool_name}` : null,
              `\nStudent's submission includes the screenshot below and this note: ${body.user_response}`,
            ]
              .filter(Boolean)
              .join("\n"),
          },
          {
            type: "image_url",
            image_url: { url: body.image_data, detail: "low" },
          },
        ],
      });
    } else {
      messages.push({
        role: "user",
        content: [
          `Practice type: ${practiceType}`,
          `Question/Challenge: ${body.question}`,
          body.reference_answer
            ? `Reference answer: ${body.reference_answer}`
            : null,
          criteriaText ? `Success criteria:\n${criteriaText}` : null,
          body.context ? `Context: ${body.context}` : null,
          body.tool_name ? `Tool used: ${body.tool_name}` : null,
          `\nStudent's submission:\n${body.user_response}`,
        ]
          .filter(Boolean)
          .join("\n"),
      });
    }

    const response = await getClient().chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: isToolMission ? 512 : 256,
      temperature: 0.5,
      messages,
      response_format: {
        type: "json_schema",
        json_schema: isToolMission ? TOOL_CHALLENGE_SCHEMA : STANDARD_SCHEMA,
      },
    });

    const text = response.choices[0]?.message?.content;
    if (!text) return NextResponse.json(DEFAULT_RESPONSE);

    const parsed = JSON.parse(text);
    return NextResponse.json(parsed);
  } catch (error) {
    console.error("[learn/evaluate] Evaluation failed:", error);
    return NextResponse.json(DEFAULT_RESPONSE);
  }
}
```

**NOTE:** Vision requires `gpt-4o-mini` (which does support vision). If the screenshot is large, the `detail: "low"` param keeps token cost down.

---

## Step 6: Update the Learning Path Page

**File: `app/(learn)/learn/paths/[id]/page.tsx`**

### 6a. Pass itemState to ContentViewer

The page currently passes `isCompleted` as a boolean. Update to pass the full `ItemState` so viewers can access submission data and evaluation results.

Find where `ContentViewer` is rendered (~line 562) and update:

```tsx
<ContentViewer
  item={currentItem}
  itemState={currentItemKey ? (progress?.item_states?.[currentItemKey] ?? null) : null}
  onComplete={handleComplete}
  onPlayStateChange={setIsPlaying}
  togglePlayRef={togglePlayRef}
/>
```

### 6b. Update handleComplete to accept ItemState data

The current `handleComplete` calls `completeItem(currentItemKey)`. Update it to accept and forward the optional `Partial<ItemState>` from task viewers:

```typescript
const handleComplete = useCallback(async (result?: Partial<ItemState>) => {
  if (!currentItem || !currentItemKey) return;
  await completeItem(currentItemKey, result);

  if (nextItem) {
    setShowTransition(true);
  }
}, [currentItem, currentItemKey, nextItem, completeItem]);
```

### 6c. Update the transition card

The transition card (~line 493) currently checks `nextItem.content_type`. Update to use `task_type`:

```tsx
{/* Icon based on task type */}
<div className="flex items-center justify-center gap-2">
  {nextItem.task_type === "do" ? (
    <Wrench size={16} style={{ color: "var(--color-accent-primary)" }} />
  ) : nextItem.task_type === "check" ? (
    <HelpCircle size={16} style={{ color: "var(--color-cyan-700)" }} />
  ) : nextItem.task_type === "reflect" ? (
    <MessageSquare size={16} style={{ color: "var(--color-purple-700, #a855f7)" }} />
  ) : nextItem.content_type === "video" ? (
    <Play size={16} style={{ color: "var(--color-coral-700)" }} />
  ) : (
    <FileText size={16} style={{ color: "var(--color-cyan-700)" }} />
  )}
  <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">
    {nextItem.title}
  </h3>
</div>
```

Add `Wrench`, `HelpCircle`, and `MessageSquare` to the lucide-react imports at the top.

### 6d. Update transition card label

Below the icon/title, add a task-type-specific label for Do tasks:

```tsx
{nextItem.task_type === "do" && nextItem.mission && (
  <p className="text-xs text-[var(--color-text-tertiary)]">
    Practice with {nextItem.mission.tool.name} · ~{Math.round(nextItem.duration_seconds / 60)} min
  </p>
)}
```

---

## Step 7: Update useLearnProgress

**File: `lib/useLearnProgress.ts`**

### 7a. Update completeItem to accept ItemState data

Change the `completeItem` signature and implementation to merge in submission data:

```typescript
const completeItem = useCallback(
  async (contentId: string, result?: Partial<ItemState>) => {
    // Optimistic update with submission data
    setProgress((prev) => {
      const itemStates = { ...(prev?.item_states ?? {}) };
      itemStates[contentId] = {
        ...itemStates[contentId],
        completed: true,
        completed_at: new Date().toISOString(),
        ...result, // Merge in submission_text, evaluation, attempts, skipped, etc.
      };
      const itemsCompleted = Object.values(itemStates).filter(
        (s) => s.completed
      ).length;
      const itemsTotal = path?.items.length ?? prev?.items_total ?? 0;
      return {
        id: prev?.id ?? "local",
        user_id: prev?.user_id ?? "anonymous",
        path_id: pathId,
        started_at: prev?.started_at ?? new Date().toISOString(),
        last_activity_at: new Date().toISOString(),
        completed_at:
          itemsCompleted >= itemsTotal
            ? new Date().toISOString()
            : prev?.completed_at ?? null,
        current_item_index: prev?.current_item_index ?? currentItemIndex,
        items_completed: itemsCompleted,
        items_total: itemsTotal,
        time_invested_seconds: prev?.time_invested_seconds ?? 0,
        item_states: itemStates,
        status:
          itemsCompleted >= itemsTotal ? "completed" : "in_progress",
      };
    });

    // Persist to server — include submission data
    try {
      const res = await fetch(`/api/learn/paths/${pathId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          item_completed: contentId,
          item_state: result ?? undefined,
        }),
      });
      const data = await res.json();
      if (data.progress) setProgress(data.progress);
    } catch {
      // Optimistic update already applied
    }
  },
  [pathId, path, currentItemIndex]
);
```

### 7b. Update the return type

Update `UseLearnProgressReturn`:

```typescript
interface UseLearnProgressReturn {
  path: LearningPath | null;
  progress: LearningProgress | null;
  currentItemIndex: number;
  isLoading: boolean;
  error: string | null;
  completeItem: (contentId: string, result?: Partial<ItemState>) => Promise<void>;
  advanceToItem: (index: number) => Promise<void>;
  isCompleted: boolean;
  percentComplete: number;
}
```

Import `ItemState` from `./types`.

---

## Step 8: Update PathSidebar Icons

**File: `components/learn/PathSidebar.tsx`**

Update the icon rendering for items (~line 246) to use task_type-based icons. Add `Wrench`, `HelpCircle`, `MessageSquare` to the lucide-react imports.

Replace the icon block that checks `item.content_type`:

```tsx
{completed ? (
  <Check size={14} style={{ color: "var(--color-accent-primary)" }} />
) : item.task_type === "do" ? (
  <Wrench
    size={13}
    style={{ color: isCurrent ? "white" : "var(--color-text-tertiary)" }}
  />
) : item.task_type === "check" ? (
  <HelpCircle
    size={13}
    style={{ color: isCurrent ? "white" : "var(--color-text-tertiary)" }}
  />
) : item.task_type === "reflect" ? (
  <MessageSquare
    size={13}
    style={{ color: isCurrent ? "white" : "var(--color-text-tertiary)" }}
  />
) : item.content_type === "video" ? (
  isCurrent && isPlaying ? (
    <Pause size={13} style={{ color: "white" }} />
  ) : (
    <Play
      size={13}
      className="ml-px"
      style={{ color: isCurrent ? "white" : "var(--color-text-tertiary)" }}
    />
  )
) : (
  <FileText
    size={13}
    style={{ color: isCurrent ? "white" : "var(--color-text-tertiary)" }}
  />
)}
```

---

## Step 9: Update the Path API Route

**File: `app/api/learn/paths/[id]/route.ts`**

The PATCH handler persists progress. Update it to save the `item_state` data from submissions.

Find where `item_completed` is handled and update to also merge in submission data:

```typescript
// When item_state is provided alongside item_completed, merge it
if (body.item_completed) {
  const newItemStates = { ...currentProgress.item_states };
  newItemStates[body.item_completed] = {
    ...newItemStates[body.item_completed],
    completed: true,
    completed_at: new Date().toISOString(),
    ...(body.item_state ?? {}),
  };

  // ... rest of update logic
}
```

This ensures submission_text, evaluation results, attempts, and skip status are persisted to the database.

---

## Step 10: Delete old PracticeViewer.tsx

After all new components are built and working, delete `components/learn/PracticeViewer.tsx`. The old `PracticeViewer` handled `comprehension`, `tool_challenge`, and `paste_back` — all three are replaced by the new task-type components:

- `comprehension` → `QuickCheckViewer`
- `tool_challenge` → `MissionViewer`
- `paste_back` → `MissionViewer` (with text submission)

Remove the import from `ContentViewer.tsx` (should already be gone from Step 1 rewrite).

Search for any other imports of `PracticeViewer` and remove them.

---

## Step 11: Verify

1. **Type check:** `npx tsc --noEmit` — fix all errors
2. **Watch task:** Navigate to a path with video content → should render LearnVideoPlayer as before
3. **Do task (tool mission):**
   - Verify briefing shows objective, prompt code block, steps, success criteria, tool CTA
   - Click "Open in Claude" → clipboard should have the prompt, tool opens in new tab
   - Return to SkillGap → reference bar shows objective + criteria + timer
   - Click "I'm done" → submission panel with textarea
   - Paste text → submit → AI evaluates against criteria → feedback with quality badge + criterion breakdown
   - Click "Try Again" → returns to briefing
   - Click "Continue" → advances to next item
4. **Check task:**
   - MC question renders with clickable options
   - Wrong answer → hint appears → retry
   - Second wrong answer → reveals correct answer → continue
   - Correct answer → green checkmark → auto-advance
5. **Reflect task:**
   - Shows prompt with textarea
   - Character counter shows minimum
   - Submit → AI conversational response (no grade)
   - Continue → advances
6. **Skip behavior:** Skipping a Do task records `skipped: true` and advances without credit
7. **Path sidebar:** Icons match task types (wrench for Do, help-circle for Check, message-square for Reflect)
8. **Backward compat:** Old paths with `practice` field still render (ContentViewer falls through to default handling)

---

## What NOT To Do

- Do NOT modify the curriculum generator (`lib/learn/curriculumGenerator.ts`). It generates the data — this prompt only builds the UI.
- Do NOT modify the content pipeline (discovery, scoring, shelf). Not related.
- Do NOT add image upload to Supabase Storage yet. Screenshots stay as base64 in the item_state JSONB for now. Storage optimization is a future concern.
- Do NOT modify the tool registry. It already has all the metadata needed.
- Do NOT build the "learning notes" save feature for reflections yet. That's Sprint 4.
- Do NOT add celebration animations beyond the simple Sparkles pulse on "Nailed it". Polish is Sprint 5.
- Do NOT use Supabase MCP tools. The PATCH endpoint handles all progress persistence through code.
