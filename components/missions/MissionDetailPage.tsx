"use client";

import { useState, useCallback, useEffect, useMemo, useRef, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock3,
  FileText,
  PanelsTopLeft,
  Pencil,
  Play,
  Target,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { AchievementShareMenu } from "@/components/achievements/AchievementShareMenu";
import { ContentViewer } from "@/components/learn/ContentViewer";
import { PathSidebar } from "@/components/learn/PathSidebar";
import { SkillReceipt } from "@/components/learn/SkillReceipt";
import { MissionCard } from "@/components/missions/MissionCard";
import { useLearnProgress } from "@/lib/useLearnProgress";
import { useProfile } from "@/lib/useProfile";
import { useAuth } from "@/components/providers/AuthProvider";
import {
  AdjustAnytimeBanner,
  FirstPathTooltip,
  MissionCelebration,
  RoomBridge,
} from "@/components/onboarding/GuidedFirstSession";
import {
  getMissionCheckpoints,
  getMissionContext,
  getMissionExpectedOutput,
  getMissionFraming,
  getMissionNextAction,
  getMissionPrimaryArea,
  getMissionProgressSummary,
  getMissionRepSummary,
  getMissionRoomHint,
  getMissionStateLabel,
  getMissionStructureSummary,
  getMissionSuccessPreview,
  getMissionUiState,
  type MissionUiState,
} from "@/lib/missionPresentation";
import { createClient } from "@/lib/supabase/client";
import { trackFirstMissionCompleted } from "@/lib/onboarding/tracking";
import type { ItemState, LearningPath } from "@/lib/types";

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
    <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 animate-fade-in">
      <div
        className="rounded-lg px-4 py-2.5 text-sm font-medium shadow-lg"
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

export function MissionDetailPage({ pathId }: { pathId: string }) {
  const router = useRouter();
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
    ? currentItem.item_id ?? currentItem.content_id ?? `idx-${currentItemIndex}`
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
    ? "Your mission evidence is ready to review and share."
    : "We’re preparing your mission evidence now.";

  const missionPresentation = useMemo(() => {
    if (!path) return null;

    return {
      area: getMissionPrimaryArea(path),
      framing: getMissionFraming(path, progress),
      context: getMissionContext(path, progress),
      expectedOutput: getMissionExpectedOutput(path, progress),
      nextAction: getMissionNextAction(path, progress),
      progressSummary: getMissionProgressSummary(progress),
      effortSummary: getMissionRepSummary(path),
      structureSummary: getMissionStructureSummary(path),
      stateLabel: getMissionStateLabel(progress),
      stateTone: getMissionUiState(progress),
      checkpoints: getMissionCheckpoints(path, progress).slice(0, 4),
      successPreview: getMissionSuccessPreview(path, progress).slice(0, 4),
      roomHint: getMissionRoomHint(progress),
    };
  }, [path, progress]);

  const artifactExpectation =
    missionPresentation?.expectedOutput ??
    "A finished step you can carry into your next rep.";

  useEffect(() => {
    if (!path || !progress) return;

    const modules = path.modules?.length
      ? path.modules
      : [{
          index: 0,
          title: path.title,
          description: "",
          task_count: path.items.length,
          duration_seconds: path.estimated_duration_seconds,
        }];
    let nextToastMessage: string | null = null;

    for (const mod of modules) {
      const key = `module-${mod.index}`;
      const moduleItems = path.items.filter((item) => (item.module_index ?? 0) === mod.index);
      if (moduleItems.length === 0) continue;

      const allCompleted = moduleItems.every((item, index) => {
        const itemKey = item.item_id ?? item.content_id ?? `idx-${index}`;
        return progress.item_states?.[itemKey]?.completed;
      });

      if (allCompleted && !prevCompletedSections.current.has(key)) {
        prevCompletedSections.current.add(key);
        const nextModule = modules.find(
          (module) =>
            module.index !== mod.index &&
            !prevCompletedSections.current.has(`module-${module.index}`) &&
            path.items.some((item) => (item.module_index ?? 0) === module.index),
        );
        nextToastMessage = nextModule
          ? `${mod.title} complete — moving to ${nextModule.title}`
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

  useEffect(() => {
    if (!isCompleted || !path) return;

    fetch("/api/learn/recommendations?limit=4")
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (data?.recommendations?.length) {
          const recPaths = (data.recommendations as Array<{ paths: LearningPath[] }>)
            .flatMap((recommendation) => recommendation.paths)
            .filter((candidate) => candidate.id !== pathId)
            .slice(0, 2);
          if (recPaths.length > 0) {
            setRecommendedPaths(recPaths);
            return;
          }
        }

        return fetch(
          `/api/learn/search?q=${encodeURIComponent(path.topics[0] ?? path.query)}&limit=4`,
        )
          .then((response) => response.json())
          .then((fallback) => {
            const recs = (fallback.discovery ?? []).filter(
              (candidate: LearningPath) => candidate.id !== pathId,
            );
            setRecommendedPaths(recs.slice(0, 2));
          });
      })
      .catch(() => {});
  }, [isCompleted, path, pathId]);

  const maybeRecordFirstMission = useCallback(() => {
    if (!user || !profile) return;
    if (profile.first_mission_completed_at) return;
    if (!currentItem || currentItem.task_type !== "do") return;

    setShowMissionCelebration(true);

    const onboardedAt = profile.first_mission_completed_at
      ? 0
      : Math.floor((Date.now() - new Date(progress?.started_at ?? Date.now()).getTime()) / 60000);
    trackFirstMissionCompleted(pathId, onboardedAt);

    const supabase = createClient();
    void supabase
      .from("fp_profiles")
      .update({ first_mission_completed_at: new Date().toISOString() })
      .eq("id", user.id);
  }, [currentItem, pathId, profile, progress?.started_at, user]);

  const handleComplete = useCallback(async () => {
    if (!currentItem || !currentItemKey) return;
    await completeItem(currentItemKey);
    maybeRecordFirstMission();

    if (nextItem) {
      setShowTransition(true);
    }
  }, [completeItem, currentItem, currentItemKey, maybeRecordFirstMission, nextItem]);

  const handleCompleteWithState = useCallback(async (stateData: Partial<ItemState>) => {
    if (!currentItem || !currentItemKey) return;
    await completeItem(currentItemKey, stateData);
    maybeRecordFirstMission();

    if (nextItem) {
      setShowTransition(true);
    }
  }, [completeItem, currentItem, currentItemKey, maybeRecordFirstMission, nextItem]);

  const handleContinue = useCallback(() => {
    setShowTransition(false);
    if (nextItem) {
      void advanceToItem(currentItemIndex + 1);
    }
  }, [advanceToItem, currentItemIndex, nextItem]);

  const handleSelectItem = useCallback((index: number) => {
    setShowTransition(false);
    setSidebarOpen(false);
    void advanceToItem(index);
  }, [advanceToItem]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[var(--sg-white)]">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--sg-shell-500)] border-t-transparent" />
      </div>
    );
  }

  if (error || !path) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-[var(--sg-white)]">
        <p className="text-sm text-[var(--sg-shell-500)]">
          {error || "Mission not found."}
        </p>
        <Button variant="ghost" onClick={() => router.push("/missions")}>
          Back to Missions
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-[var(--sg-white)]">
      <header className="relative z-10 flex shrink-0 items-center gap-3 border-b border-[var(--sg-shell-border)] px-4 py-4">
        <Button
          variant="outline"
          size="sm"
          leftIcon={<ArrowLeft size={15} strokeWidth={2} />}
          onClick={() => router.push("/missions")}
        >
          Missions
        </Button>
        <div className="flex-1" />
        <h1 className="absolute left-1/2 max-w-[50%] -translate-x-1/2 truncate text-center text-sm font-medium text-[var(--sg-shell-900)]">
          {path.title}
        </h1>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setSidebarOpen((open) => !open)}
        >
          Mission Map
        </Button>
      </header>

      {!isCompleted && (
        <section className="shrink-0 border-b border-[var(--sg-shell-border)] bg-[var(--sg-shell-50)] px-4 py-4">
          <div className="space-y-4">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <MissionStatePill
                    label={missionPresentation?.stateLabel ?? "Ready"}
                    state={missionPresentation?.stateTone ?? "ready"}
                  />
                  {missionPresentation?.area.detail && (
                    <MissionMetaPill>{missionPresentation.area.detail}</MissionMetaPill>
                  )}
                  <MissionMetaPill>
                    {missionPresentation?.area.label ?? "AI Mission"}
                  </MissionMetaPill>
                  {missionPresentation?.effortSummary && (
                    <MissionMetaPill>{missionPresentation.effortSummary}</MissionMetaPill>
                  )}
                </div>

                <div className="space-y-2">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-forest-500">
                    Mission Brief
                  </p>
                  <h2 className="text-2xl font-semibold leading-tight text-shell-900">
                    {path.title}
                  </h2>
                  <p className="max-w-3xl text-sm leading-6 text-shell-600">
                    {missionPresentation?.framing}
                  </p>
                </div>
              </div>

              <Card className="p-4 xl:max-w-sm">
                <div className="space-y-3">
                  <div className="space-y-1">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-shell-500">
                      What To Do Next
                    </p>
                    <p className="text-sm leading-6 text-shell-900">
                      {missionPresentation?.nextAction}
                    </p>
                  </div>

                  <div className="space-y-1 text-sm text-shell-600">
                    <p>{missionPresentation?.progressSummary}</p>
                    <p>{missionPresentation?.structureSummary}</p>
                  </div>

                  <div className="rounded-[var(--sg-radius-lg)] bg-shell-50 p-3">
                    <p className="text-xs leading-5 text-shell-600">
                      {missionPresentation?.roomHint}
                    </p>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    leftIcon={<PanelsTopLeft size={14} />}
                    onClick={() => router.push("/rooms")}
                  >
                    Enter room
                  </Button>
                </div>
              </Card>
            </div>

            <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
              <MissionBriefCard
                icon={<Target size={14} className="text-forest-500" />}
                label="Scenario"
                value={missionPresentation?.context ?? path.description}
              />
              <MissionBriefCard
                icon={<FileText size={14} className="text-shell-500" />}
                label="Expected Output"
                value={artifactExpectation}
              />
              <MissionBriefList
                icon={<Clock3 size={14} className="text-shell-500" />}
                label="Checkpoints"
                items={missionPresentation?.checkpoints ?? []}
              />
              <MissionBriefList
                icon={<CheckCircle2 size={14} className="text-forest-500" />}
                label="Success Looks Like"
                items={missionPresentation?.successPreview ?? []}
              />
            </div>
          </div>
        </section>
      )}

      <div className="relative flex-1 min-h-0 overflow-hidden">
        <div
          className="h-full overflow-y-auto transition-[margin-right] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]"
          style={{ marginRight: sidebarOpen ? 380 : 0 }}
        >
          {isCompleted ? (
            <div className="relative isolate flex flex-col items-center gap-8 overflow-hidden px-4 py-12 sm:px-8">
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

              <div className="max-w-2xl space-y-3 text-center animate-fade-in">
                <p
                  className="text-sm font-semibold uppercase tracking-widest"
                  style={{ color: "var(--sg-forest-500)" }}
                >
                  Mission Complete
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

              <Card className="w-full max-w-xl p-5">
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-forest-500">
                        Evidence Captured
                      </p>
                      <h3 className="mt-1 text-lg font-semibold text-shell-900">
                        {path.title}
                      </h3>
                    </div>
                    <span className="text-xs text-shell-500">
                      {new Date(progress?.completed_at ?? new Date().toISOString()).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-[var(--sg-radius-lg)] bg-shell-50 p-3">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-shell-500">
                        Mission Output
                      </p>
                      <p className="mt-1 text-sm text-shell-800">
                        {artifactExpectation}
                      </p>
                    </div>
                    <div className="rounded-[var(--sg-radius-lg)] bg-shell-50 p-3">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-shell-500">
                        Work Completed
                      </p>
                      <p className="mt-1 text-sm text-shell-800">
                        {(progress?.items_completed ?? path.items.length)}/{path.items.length} steps finished
                      </p>
                    </div>
                  </div>
                </div>
              </Card>

              {skillReceipt && (
                <SkillReceipt
                  receipt={skillReceipt}
                  title={leveledUpSkills.length > 0 ? "Skills Advanced" : "Skills Demonstrated"}
                  className="max-w-xl"
                />
              )}

              <div className="flex flex-col items-center gap-3 animate-fade-in sm:flex-row">
                <AchievementShareMenu
                  shareSlug={achievement?.share_slug}
                  pathTitle={path.title}
                  pathTopics={path.topics}
                />
                <Button variant="cta" onClick={() => router.push("/missions")}>
                  More Missions
                </Button>
                <Button variant="outline" onClick={() => router.push("/rooms")}>
                  Browse Rooms
                </Button>
              </div>

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
                      Recommended next missions based on the skills you just demonstrated.
                    </p>
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {recommendedPaths.map((recommendedPath) => (
                      <MissionCard
                        key={recommendedPath.id}
                        path={recommendedPath}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : showTransition && nextItem ? (
            <div className="flex h-full flex-col items-center justify-center gap-6 p-8 animate-fade-in">
              <Card className="max-w-md p-6 text-center">
                <div className="space-y-4">
                  <p className="text-xs uppercase tracking-wide text-[var(--sg-shell-500)]">
                    Up Next
                  </p>
                  <div className="flex items-center justify-center gap-2">
                    {nextItem.task_type === "do" ? (
                      <Pencil size={16} style={{ color: "var(--sg-gold-600)" }} />
                    ) : nextItem.content_type === "video" ? (
                      <Play size={16} style={{ color: "var(--sg-coral-500)" }} />
                    ) : (
                      <FileText size={16} style={{ color: "var(--sg-teal-600)" }} />
                    )}
                    <h3 className="text-lg font-semibold text-[var(--sg-shell-900)]">
                      {nextItem.title}
                    </h3>
                  </div>

                  {nextItem.connective_text && (
                    <p className="text-sm italic text-[var(--sg-shell-500)]">
                      {nextItem.connective_text}
                    </p>
                  )}

                  {nextItem.task_type !== "do" && (
                    <div className="flex items-center justify-center gap-2 text-xs text-[var(--sg-shell-500)]">
                      <span>{nextItem.creator_name}</span>
                      <span>&middot;</span>
                      <span>{Math.round(nextItem.duration_seconds / 60)} min</span>
                    </div>
                  )}

                  <div className="flex items-center justify-center gap-3 pt-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowTransition(false)}
                    >
                      Back to mission
                    </Button>
                    <Button
                      variant="cta"
                      size="sm"
                      rightIcon={<ArrowRight size={14} />}
                      onClick={handleContinue}
                    >
                      Continue
                    </Button>
                  </div>
                </div>
              </Card>
            </div>
          ) : currentItem ? (
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
              title="Mission Map"
            />
          </aside>
        </div>
      </div>

      {sectionToast && (
        <SectionToast
          message={sectionToast}
          onDismiss={() => setSectionToast(null)}
        />
      )}

      <FirstPathTooltip />
      <AdjustAnytimeBanner />
      {showMissionCelebration && (
        <MissionCelebration onDismiss={() => setShowMissionCelebration(false)} />
      )}
      {isCompleted && <RoomBridge topicName={path.topics[0] ?? "AI"} />}
    </div>
  );
}

const MISSION_STATE_STYLES: Record<
  MissionUiState,
  { background: string; border: string; color: string }
> = {
  ready: {
    background: "var(--sg-shell-100)",
    border: "var(--sg-shell-border)",
    color: "var(--sg-shell-700)",
  },
  saved: {
    background: "var(--sg-shell-100)",
    border: "var(--sg-shell-border)",
    color: "var(--sg-shell-700)",
  },
  active: {
    background: "var(--sg-forest-50)",
    border: "var(--sg-forest-200)",
    color: "var(--sg-forest-600)",
  },
  completed: {
    background: "var(--sg-gold-100)",
    border: "var(--sg-gold-200)",
    color: "var(--sg-gold-900)",
  },
};

function MissionStatePill({
  label,
  state,
}: {
  label: string;
  state: MissionUiState;
}) {
  const style = MISSION_STATE_STYLES[state];

  return (
    <span
      className="inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold"
      style={{
        background: style.background,
        borderColor: style.border,
        color: style.color,
      }}
    >
      {label}
    </span>
  );
}

function MissionMetaPill({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-shell-border bg-white px-2.5 py-1 text-[11px] font-medium text-shell-600">
      {children}
    </span>
  );
}

function MissionBriefCard({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <Card className="h-full p-4">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-shell-500">
        {icon}
        {label}
      </div>
      <p className="mt-3 text-sm leading-6 text-shell-800">
        {value}
      </p>
    </Card>
  );
}

function MissionBriefList({
  icon,
  label,
  items,
}: {
  icon: ReactNode;
  label: string;
  items: string[];
}) {
  return (
    <Card className="h-full p-4">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-shell-500">
        {icon}
        {label}
      </div>
      <div className="mt-3 space-y-2">
        {items.map((item) => (
          <div key={item} className="flex items-start gap-2 text-sm leading-6 text-shell-800">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-forest-500" />
            <span>{item}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}
