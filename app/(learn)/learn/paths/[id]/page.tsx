"use client";

import { useParams, useRouter } from "next/navigation";
import { useState, useCallback, useEffect, useRef } from "react";
import {
  ArrowLeft,
  Play,
  FileText,
  Pencil,
  Share2,
  Link2,
  Copy,
  Download,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ContentViewer } from "@/components/learn/ContentViewer";
import { PathSidebar } from "@/components/learn/PathSidebar";
import { PathCard } from "@/components/learn/PathCard";
import { SkillReceipt } from "@/components/learn/SkillReceipt";
import { useLearnProgress } from "@/lib/useLearnProgress";
import { useProfile } from "@/lib/useProfile";
import { useAuth } from "@/components/providers/AuthProvider";
import {
  FirstPathTooltip,
  AdjustAnytimeBanner,
  MissionCelebration,
  RoomBridge,
} from "@/components/onboarding/GuidedFirstSession";
import { createClient } from "@/lib/supabase/client";
import { trackFirstMissionCompleted } from "@/lib/onboarding/tracking";
import type { LearningPath, ItemState } from "@/lib/types";

// ─── Helpers ─────────────────────────────────────────────────

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return rm ? `${h}h ${rm}m` : `${h}h`;
}

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

// ─── Section Milestone Toast ─────────────────────────────────

function SectionToast({
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
          background: "var(--sg-shell-50)",
          color: "var(--sg-shell-900)",
          border: "1px solid var(--sg-shell-border)",
        }}
      >
        {message}
      </div>
    </div>
  );
}

// ─── Achievement Card (Shareable) ────────────────────────────

function AchievementCard({
  path,
  itemsCompleted,
  timeInvested,
  completedAt,
}: {
  path: LearningPath;
  itemsCompleted: number;
  timeInvested: number;
  completedAt: string;
}) {
  return (
    <div
      className="w-full max-w-md rounded-xl overflow-hidden"
      style={{
        background:
          "linear-gradient(145deg, var(--sg-shell-50), var(--sg-white))",
        border: "1px solid var(--sg-shell-border)",
        boxShadow: "var(--shadow-float, 0 8px 32px rgba(0,0,0,0.3))",
      }}
    >
      {/* Accent bar */}
      <div
        className="h-1"
        style={{
          background:
            "linear-gradient(to right, var(--sg-forest-500), var(--sg-teal-600))",
        }}
      />

      <div className="p-6 space-y-5">
        {/* Title */}
        <div className="space-y-1">
          <p
            className="text-xs font-semibold uppercase tracking-widest"
            style={{ color: "var(--sg-forest-500)" }}
          >
            Path Complete
          </p>
          <h3 className="text-lg font-bold text-[var(--sg-shell-900)] leading-snug">
            {path.title}
          </h3>
        </div>

        {/* Divider */}
        <div
          className="h-px"
          style={{ background: "var(--sg-shell-border)" }}
        />

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-[var(--sg-shell-500)] text-xs">
              Resources
            </p>
            <p className="text-[var(--sg-shell-900)] font-medium">
              {itemsCompleted} completed
            </p>
          </div>
          <div>
            <p className="text-[var(--sg-shell-500)] text-xs">
              Time invested
            </p>
            <p className="text-[var(--sg-shell-900)] font-medium">
              {formatDuration(timeInvested)}
            </p>
          </div>
        </div>

        {/* Topics */}
        {path.topics.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[var(--sg-shell-500)] text-xs">Topics</p>
            <div className="flex flex-wrap gap-1.5">
              {path.topics.slice(0, 5).map((t) => (
                <span
                  key={t}
                  className="px-2 py-0.5 rounded text-xs bg-[var(--sg-sage-100)] text-[var(--sg-shell-600)]"
                >
                  {t}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-1">
          <span className="text-xs text-[var(--sg-shell-500)]">
            Completed {formatDate(completedAt)}
          </span>
          <span
            className="text-xs font-medium"
            style={{ color: "var(--sg-shell-500)" }}
          >
            SkillGap.ai
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────

/**
 * Learning environment page.
 * Focused experience with content viewer and path sidebar.
 */
export default function LearnPathPage() {
  const params = useParams();
  const router = useRouter();
  const pathId = params.id as string;

  const {
    path,
    progress,
    currentItemIndex,
    isLoading,
    error,
    completeItem,
    advanceToItem,
    isCompleted,
    skillReceipt,
  } = useLearnProgress(pathId);

  const { user } = useAuth();
  const { profile } = useProfile();

  const [showTransition, setShowTransition] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sectionToast, setSectionToast] = useState<string | null>(null);
  const [shareMenuOpen, setShareMenuOpen] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const togglePlayRef = useRef<(() => void) | null>(null);
  const [recommendedPaths, setRecommendedPaths] = useState<LearningPath[]>([]);
  const prevCompletedSections = useRef<Set<string>>(new Set());
  const [showMissionCelebration, setShowMissionCelebration] = useState(false);

  const currentItem = path?.items[currentItemIndex] ?? null;
  const nextItem = path?.items[currentItemIndex + 1] ?? null;
  const currentItemKey = currentItem
    ? (currentItem.item_id ?? currentItem.content_id ?? `idx-${currentItemIndex}`)
    : null;
  const isItemCompleted = currentItemKey
    ? progress?.item_states?.[currentItemKey]?.completed ?? false
    : false;

  // Track module completions for milestone toasts
  useEffect(() => {
    if (!path || !progress) return;

    const modules = path.modules?.length
      ? path.modules
      : [{ index: 0, title: path.title, description: "", task_count: path.items.length, duration_seconds: path.estimated_duration_seconds }];

    for (const mod of modules) {
      const key = `module-${mod.index}`;
      const moduleItems = path.items.filter((i) => (i.module_index ?? 0) === mod.index);
      if (moduleItems.length === 0) continue;

      const allCompleted = moduleItems.every((i) => {
        const k = i.item_id ?? i.content_id ?? `idx-${i.position ?? 0}`;
        return progress.item_states?.[k]?.completed;
      });

      if (allCompleted && !prevCompletedSections.current.has(key)) {
        prevCompletedSections.current.add(key);
        const nextMod = modules.find(
          (m) => m.index !== mod.index &&
            !prevCompletedSections.current.has(`module-${m.index}`) &&
            path.items.some((i) => (i.module_index ?? 0) === m.index)
        );
        const msg = nextMod
          ? `${mod.title} complete — moving to ${nextMod.title}`
          : `${mod.title} complete`;
        setSectionToast(msg);
      }
    }
  }, [path, progress]);

  // Fetch recommended paths when path is completed (skill-aware with topic fallback)
  useEffect(() => {
    if (!isCompleted || !path) return;

    // Try skill-aware recommendations first
    fetch("/api/learn/recommendations?limit=4")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.recommendations?.length) {
          const recPaths = (data.recommendations as Array<{ paths: LearningPath[] }>)
            .flatMap((r) => r.paths)
            .filter((p) => p.id !== pathId)
            .slice(0, 2);
          if (recPaths.length > 0) {
            setRecommendedPaths(recPaths);
            return;
          }
        }
        // Fallback to topic-based recommendations
        return fetch(
          `/api/learn/search?q=${encodeURIComponent(path.topics[0] ?? path.query)}&limit=4`
        )
          .then((r) => r.json())
          .then((fallback) => {
            const recs = (fallback.discovery ?? []).filter(
              (p: LearningPath) => p.id !== pathId
            );
            setRecommendedPaths(recs.slice(0, 2));
          });
      })
      .catch(() => {});
  }, [isCompleted, path, pathId]);

  /** Record first mission completion on the profile (once). */
  const maybeRecordFirstMission = useCallback(() => {
    if (!user || !profile) return;
    if (profile.first_mission_completed_at) return;
    if (!currentItem || currentItem.content_type !== "practice") return;

    setShowMissionCelebration(true);

    // Track the event
    const onboardedAt = profile.first_mission_completed_at
      ? 0
      : Math.floor((Date.now() - new Date(progress?.started_at ?? Date.now()).getTime()) / 60000);
    trackFirstMissionCompleted(pathId, onboardedAt);

    const supabase = createClient();
    supabase
      .from("fp_profiles")
      .update({ first_mission_completed_at: new Date().toISOString() })
      .eq("id", user.id)
      .then(() => {});
  }, [user, profile, currentItem]);

  const handleComplete = useCallback(async () => {
    if (!currentItem || !currentItemKey) return;
    await completeItem(currentItemKey);
    maybeRecordFirstMission();

    if (nextItem) {
      setShowTransition(true);
    }
  }, [currentItem, currentItemKey, nextItem, completeItem, maybeRecordFirstMission]);

  const handleCompleteWithState = useCallback(async (stateData: Partial<ItemState>) => {
    if (!currentItem || !currentItemKey) return;
    await completeItem(currentItemKey, stateData);
    maybeRecordFirstMission();

    if (nextItem) {
      setShowTransition(true);
    }
  }, [currentItem, currentItemKey, nextItem, completeItem, maybeRecordFirstMission]);

  const handleContinue = useCallback(() => {
    setShowTransition(false);
    if (nextItem) {
      advanceToItem(currentItemIndex + 1);
    }
  }, [nextItem, advanceToItem, currentItemIndex]);

  const handleSelectItem = useCallback(
    (index: number) => {
      setShowTransition(false);
      setSidebarOpen(false);
      advanceToItem(index);
    },
    [advanceToItem]
  );

  const handleCopyLink = useCallback(() => {
    const url = `${window.location.origin}/learn/paths/${pathId}`;
    navigator.clipboard.writeText(url).catch(() => {});
    setShareMenuOpen(false);
  }, [pathId]);

  const handleShareLinkedIn = useCallback(() => {
    const url = `${window.location.origin}/learn/paths/${pathId}`;
    const text = `I just completed "${path?.title}" on SkillGap.ai! ${path?.items.length} resources, topics: ${path?.topics.slice(0, 3).join(", ")}`;
    window.open(
      `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}&summary=${encodeURIComponent(text)}`,
      "_blank"
    );
    setShareMenuOpen(false);
  }, [path, pathId]);

  const handleShareTwitter = useCallback(() => {
    const url = `${window.location.origin}/learn/paths/${pathId}`;
    const text = `Just completed "${path?.title}" on @SkillGapAI`;
    window.open(
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
      "_blank"
    );
    setShareMenuOpen(false);
  }, [path, pathId]);

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-[var(--sg-white)]">
        <div className="w-6 h-6 border-2 border-[var(--sg-shell-500)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !path) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-[var(--sg-white)] gap-4">
        <p className="text-sm text-[var(--sg-shell-500)]">
          {error || "Learning path not found."}
        </p>
        <Button variant="ghost" onClick={() => router.push("/learn")}>
          Back to Learn
        </Button>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-[var(--sg-white)]">
      {/* Top Bar */}
      <header className="relative z-10 flex items-center gap-3 py-4 px-4 shrink-0 border-b border-[var(--sg-shell-border)]">
        <button
          onClick={() => router.push("/learn")}
          className="flex cursor-pointer items-center gap-2 rounded-full border border-[var(--sg-shell-border)] bg-[var(--sg-shell-50)] px-4 py-2 text-sm font-medium text-[var(--sg-shell-700)] transition-colors hover:bg-[var(--sg-shell-100)]"
        >
          <ArrowLeft size={15} strokeWidth={2} />
          Learn
        </button>
        <div className="flex-1" />
        <h1 className="absolute left-1/2 -translate-x-1/2 text-sm font-medium text-[var(--sg-shell-900)] truncate max-w-[50%] text-center">
          {path.title}
        </h1>
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="flex cursor-pointer items-center gap-2 rounded-full border border-[var(--sg-shell-border)] bg-[var(--sg-shell-50)] px-4 py-2 text-sm font-medium text-[var(--sg-shell-700)] transition-colors hover:bg-[var(--sg-shell-100)]"
        >
          Path
        </button>
      </header>

      {/* Main Content */}
      <div className="relative flex-1 min-h-0 overflow-hidden">
        {/* Content Viewer */}
        <div
          className="h-full overflow-y-auto transition-[margin-right] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]"
          style={{ marginRight: sidebarOpen ? 380 : 0 }}
        >
          {isCompleted ? (
            /* ─── Completion Celebration ─────────────────────── */
            <div className="flex flex-col items-center py-12 px-4 sm:px-8 gap-10">
              {/* Header */}
              <div className="text-center space-y-2 animate-fade-in">
                <p
                  className="text-sm font-semibold uppercase tracking-widest"
                  style={{ color: "var(--sg-forest-500)" }}
                >
                  Path Complete
                </p>
                <h2 className="text-2xl sm:text-3xl font-bold text-[var(--sg-shell-900)]">
                  Congratulations!
                </h2>
              </div>

              {/* Achievement Card */}
              <div className="animate-fade-in" style={{ animationDelay: "200ms" }}>
                <AchievementCard
                  path={path}
                  itemsCompleted={progress?.items_completed ?? path.items.length}
                  timeInvested={progress?.time_invested_seconds ?? 0}
                  completedAt={
                    progress?.completed_at ?? new Date().toISOString()
                  }
                />
              </div>

              {/* Skill Receipt */}
              {skillReceipt && <SkillReceipt receipt={skillReceipt} />}

              {/* Share + Continue buttons */}
              <div
                className="flex flex-col sm:flex-row items-center gap-3 animate-fade-in"
                style={{ animationDelay: "600ms" }}
              >
                <div className="relative">
                  <Button
                    variant="secondary"
                    leftIcon={<Share2 size={14} />}
                    onClick={() => setShareMenuOpen(!shareMenuOpen)}
                  >
                    Share Achievement
                  </Button>
                  {shareMenuOpen && (
                    <div
                      className="absolute top-full mt-2 left-1/2 -translate-x-1/2 rounded-lg shadow-lg py-1 z-10 min-w-[180px]"
                      style={{
                        background: "var(--sg-white)",
                        border: "1px solid var(--sg-shell-border)",
                      }}
                    >
                      <button
                        onClick={handleCopyLink}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-[var(--sg-shell-600)] hover:bg-[var(--sg-sage-50)] transition-colors"
                      >
                        <Copy size={12} />
                        Copy link
                      </button>
                      <button
                        onClick={handleShareLinkedIn}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-[var(--sg-shell-600)] hover:bg-[var(--sg-sage-50)] transition-colors"
                      >
                        <Link2 size={12} />
                        Share to LinkedIn
                      </button>
                      <button
                        onClick={handleShareTwitter}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-[var(--sg-shell-600)] hover:bg-[var(--sg-sage-50)] transition-colors"
                      >
                        <Link2 size={12} />
                        Share to X
                      </button>
                    </div>
                  )}
                </div>
                <Button
                  variant="cta"
                  onClick={() => router.push("/learn")}
                >
                  Continue Learning
                </Button>
              </div>

              {/* Recommended Next */}
              {recommendedPaths.length > 0 && (
                <div
                  className="w-full max-w-2xl space-y-4 animate-fade-in"
                  style={{ animationDelay: "800ms" }}
                >
                  <div className="h-px bg-[var(--sg-shell-border)]" />
                  <p className="text-sm font-semibold text-[var(--sg-shell-600)]">
                    Recommended next
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {recommendedPaths.map((rp) => (
                      <PathCard
                        key={rp.id}
                        path={rp}
                        onClick={(id) => router.push(`/learn/paths/${id}`)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : showTransition && nextItem ? (
            /* ─── Transition Card ────────────────────────────── */
            <div className="flex flex-col items-center justify-center h-full gap-6 p-8 animate-fade-in">
              <Card className="p-6 max-w-md space-y-4 text-center">
                <p className="text-xs text-[var(--sg-shell-500)] uppercase tracking-wide">
                  Up Next
                </p>

                {/* Format icon + title */}
                <div className="flex items-center justify-center gap-2">
                  {nextItem.content_type === "practice" ? (
                    <Pencil
                      size={16}
                      style={{ color: "var(--sg-gold-600)" }}
                    />
                  ) : nextItem.content_type === "video" ? (
                    <Play
                      size={16}
                      style={{ color: "var(--sg-coral-500)" }}
                    />
                  ) : (
                    <FileText
                      size={16}
                      style={{ color: "var(--sg-teal-600)" }}
                    />
                  )}
                  <h3 className="text-lg font-semibold text-[var(--sg-shell-900)]">
                    {nextItem.title}
                  </h3>
                </div>

                {/* Connective text */}
                {nextItem.connective_text && (
                  <p className="text-sm text-[var(--sg-shell-500)] italic">
                    {nextItem.connective_text}
                  </p>
                )}

                {/* Meta */}
                {nextItem.content_type !== "practice" && (
                  <div className="flex items-center justify-center gap-2 text-xs text-[var(--sg-shell-500)]">
                    <span>{nextItem.creator_name}</span>
                    <span>&middot;</span>
                    <span>
                      {Math.round(nextItem.duration_seconds / 60)} min
                    </span>
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center justify-center gap-3 pt-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowTransition(false)}
                  >
                    Back to path
                  </Button>
                  <Button
                    variant="cta"
                    rightIcon={<ArrowRight size={14} />}
                    onClick={handleContinue}
                  >
                    Continue
                  </Button>
                </div>
              </Card>
            </div>
          ) : currentItem ? (
            /* Content Viewer */
            <ContentViewer
              item={currentItem}
              isCompleted={isItemCompleted}
              onComplete={handleComplete}
              onCompleteWithState={handleCompleteWithState}
              onPlayStateChange={setIsPlaying}
              togglePlayRef={togglePlayRef}
            />
          ) : null}
        </div>

        {/* Path flyout — rooms-style glass panel */}
        <div
          className="absolute right-0 top-0 z-20 h-full transition-[width] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]"
          style={{ width: sidebarOpen ? 380 : 0, overflow: "hidden" }}
        >
          <aside
            className="flex flex-col rounded-xl border border-[var(--sg-shell-border)]"
            style={{
              width: 364,
              height: "calc(100% - 32px)",
              margin: "16px 16px 16px 0",
              background: "rgba(10,10,10,0.65)",
              backdropFilter: "blur(24px)",
              WebkitBackdropFilter: "blur(24px)",
              boxShadow: "var(--shadow-float)",
            }}
          >
            <PathSidebar
              path={path}
              progress={progress}
              currentItemIndex={currentItemIndex}
              onSelectItem={handleSelectItem}
              isPlaying={isPlaying}
              onTogglePlay={() => togglePlayRef.current?.()}
            />
          </aside>
        </div>
      </div>

      {/* Section milestone toast */}
      {sectionToast && (
        <SectionToast
          message={sectionToast}
          onDismiss={() => setSectionToast(null)}
        />
      )}

      {/* Guided first session overlays */}
      <FirstPathTooltip />
      <AdjustAnytimeBanner />
      {showMissionCelebration && (
        <MissionCelebration onDismiss={() => setShowMissionCelebration(false)} />
      )}
      {isCompleted && <RoomBridge topicName={path?.topics[0] ?? "AI"} />}
    </div>
  );
}
