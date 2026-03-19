"use client";

import { useParams, useRouter } from "next/navigation";
import { useState, useCallback, useEffect, useRef } from "react";
import {
  ArrowLeft,
  Play,
  FileText,
  Pencil,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { AchievementCard } from "@/components/achievements/AchievementCard";
import { AchievementShareMenu } from "@/components/achievements/AchievementShareMenu";
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
    achievement,
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
  const primaryReceiptSkill =
    skillReceipt?.skills.find((entry) => entry.relevance === "primary") ??
    skillReceipt?.skills[0] ??
    null;
  const leveledUpSkills =
    skillReceipt?.skills.filter((entry) => entry.leveled_up) ?? [];
  const completionHeadline = leveledUpSkills.length
    ? `You leveled up in ${leveledUpSkills[0].skill.name}${leveledUpSkills.length > 1 ? ` + ${leveledUpSkills.length - 1} more` : ""}`
    : primaryReceiptSkill
      ? `${primaryReceiptSkill.skill.name} demonstrated in practice`
      : "You finished something real";
  const completionSubheadline = achievement
    ? "Your public credential is ready to share."
    : "We’re preparing your public credential now.";

  // Track module completions for milestone toasts
  useEffect(() => {
    if (!path || !progress) return;

    const modules = path.modules?.length
      ? path.modules
      : [{ index: 0, title: path.title, description: "", task_count: path.items.length, duration_seconds: path.estimated_duration_seconds }];
    let nextToastMessage: string | null = null;

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
        nextToastMessage = nextMod
          ? `${mod.title} complete — moving to ${nextMod.title}`
          : `${mod.title} complete`;
        break;
      }
    }

    if (!nextToastMessage) return;

    const timer = window.setTimeout(() => {
      setSectionToast(nextToastMessage);
    }, 0);

    return () => window.clearTimeout(timer);
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
  }, [currentItem, pathId, profile, progress?.started_at, user]);

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
            <div className="relative isolate flex flex-col items-center gap-10 overflow-hidden px-4 py-12 sm:px-8">
              <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
                <div
                  className="absolute left-1/2 top-0 h-72 w-72 -translate-x-[78%] rounded-full blur-3xl"
                  style={{
                    background:
                      "radial-gradient(circle, var(--sg-sage-100) 0%, transparent 68%)",
                  }}
                />
                <div
                  className="absolute right-0 top-24 h-80 w-80 translate-x-1/4 rounded-full blur-3xl"
                  style={{
                    background:
                      "radial-gradient(circle, var(--sg-teal-100) 0%, transparent 70%)",
                  }}
                />
                <div
                  className="absolute bottom-0 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full blur-3xl"
                  style={{
                    background:
                      "radial-gradient(circle, var(--sg-gold-100) 0%, transparent 70%)",
                  }}
                />
              </div>

              <div className="max-w-2xl text-center space-y-3 animate-fade-in">
                <p
                  className="text-sm font-semibold uppercase tracking-widest"
                  style={{ color: "var(--sg-forest-500)" }}
                >
                  Path Complete
                </p>
                <h2
                  className="text-3xl leading-[1.08] text-[var(--sg-shell-900)] sm:text-[2.6rem]"
                  style={{
                    fontFamily: "var(--font-display), 'Fraunces', Georgia, serif",
                  }}
                >
                  {completionHeadline}
                </h2>
                <p className="mx-auto max-w-xl text-sm leading-6 text-[var(--sg-shell-600)] sm:text-base">
                  {completionSubheadline}
                </p>
              </div>

              {/* Achievement Card */}
              <div
                className="w-full flex justify-center animate-fade-in"
                style={{ animationDelay: "200ms" }}
              >
                <AchievementCard
                  pathTitle={path.title}
                  pathTopics={path.topics}
                  itemsCompleted={progress?.items_completed ?? path.items.length}
                  timeInvestedSeconds={progress?.time_invested_seconds ?? 0}
                  completedAt={progress?.completed_at ?? new Date().toISOString()}
                  skillReceipt={skillReceipt}
                />
              </div>

              {/* Skill Receipt */}
              {skillReceipt && (
                <SkillReceipt
                  receipt={skillReceipt}
                  title={leveledUpSkills.length > 0 ? "Skills Advanced" : "Skills Demonstrated"}
                  className="max-w-xl"
                />
              )}

              {/* Share + Continue buttons */}
              <div
                className="flex flex-col sm:flex-row items-center gap-3 animate-fade-in"
                style={{ animationDelay: "600ms" }}
              >
                <AchievementShareMenu
                  shareSlug={achievement?.share_slug}
                  pathTitle={path.title}
                  pathTopics={path.topics}
                />
                <Button variant="cta" onClick={() => router.push("/learn")}>
                  Continue Learning
                </Button>
              </div>

              {/* Recommended Next */}
              {recommendedPaths.length > 0 && (
                <div
                  className="w-full max-w-3xl space-y-4 animate-fade-in"
                  style={{ animationDelay: "800ms" }}
                >
                  <div className="h-px bg-[var(--sg-shell-border)]" />
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-[var(--sg-shell-700)]">
                      Build on this momentum
                    </p>
                    <p className="text-sm text-[var(--sg-shell-500)]">
                      Recommended next paths based on the skills you just
                      demonstrated.
                    </p>
                  </div>
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
