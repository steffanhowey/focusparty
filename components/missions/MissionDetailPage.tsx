"use client";

import { useState, useCallback, useEffect, useRef, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  FileText,
  PanelsTopLeft,
  Pencil,
  Play,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ContentViewer } from "@/components/learn/ContentViewer";
import { PathSidebar } from "@/components/learn/PathSidebar";
import {
  RoomStagePanel,
  RoomStageScaffold,
  RoomStageSecondaryButton,
} from "@/components/learn/RoomStageScaffold";
import { MissionCompletionSummary } from "@/components/missions/MissionCompletionSummary";
import { MissionRoomPickerModal } from "@/components/missions/MissionRoomPickerModal";
import { useLearnProgress } from "@/lib/useLearnProgress";
import { usePostCompletionRecommendations } from "@/lib/usePostCompletionRecommendations";
import { useProfile } from "@/lib/useProfile";
import { useAuth } from "@/components/providers/AuthProvider";
import {
  AdjustAnytimeBanner,
  FirstPathTooltip,
  MissionCelebration,
  RoomBridge,
} from "@/components/onboarding/GuidedFirstSession";
import {
  getMissionExpectedOutput,
} from "@/lib/missionPresentation";
import {
  getMissionLaunchDomain,
  getMissionLaunchDomainShortLabel,
} from "@/lib/launchTaxonomy";
import { createClient } from "@/lib/supabase/client";
import { trackFirstMissionCompleted } from "@/lib/onboarding/tracking";
import { PanelHeader } from "@/components/session/PanelHeader";
import type { ItemState, LearningPath, PathItem } from "@/lib/types";
import { getWorldConfig, type WorldKey } from "@/lib/worlds";
const DESKTOP_LAYOUT_QUERY = "(min-width: 1280px)";

function getStepLabel(item: PathItem | null): string {
  if (!item) return "Mission";
  if (item.task_type === "do") return "Build";
  if (item.task_type === "check") return "Check";
  if (item.task_type === "reflect") return "Reflect";
  return item.content_type === "video" ? "Watch" : "Read";
}

function getStepIcon(item: PathItem | null) {
  if (!item) return <FileText size={14} />;
  if (item.task_type === "do") return <Pencil size={14} />;
  if (item.task_type === "check") return <CheckCircle2 size={14} />;
  if (item.task_type === "reflect") return <FileText size={14} />;
  return item.content_type === "video" ? <Play size={14} /> : <FileText size={14} />;
}

function MissionPageStage({
  children,
}: {
  children: ReactNode;
}) {
  return <div className="mx-auto flex h-full min-h-0 w-full max-w-[1100px]">{children}</div>;
}

function getMissionPageWorldKey(path: LearningPath | null): WorldKey {
  if (!path) return "default";

  const launchDomain = getMissionLaunchDomain(path);

  if (launchDomain.key === "workflow-design-operations") {
    return "vibe-coding";
  }

  if (
    launchDomain.key === "positioning-messaging" ||
    launchDomain.key === "content-systems"
  ) {
    return "writer-room";
  }

  if (launchDomain.key === "campaigns-experiments") {
    return "yc-build";
  }

  return "default";
}

function MissionPageUtilityButton({
  children,
  leftIcon,
  onClick,
  active = false,
  ariaExpanded,
  ariaControls,
}: {
  children: ReactNode;
  leftIcon?: ReactNode;
  onClick: () => void;
  active?: boolean;
  ariaExpanded?: boolean;
  ariaControls?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={ariaExpanded}
      aria-controls={ariaControls}
      className={`inline-flex h-10 cursor-pointer items-center gap-2 rounded-full px-4 text-sm font-medium transition-colors duration-150 hover:bg-white/15 hover:text-white ${
        active ? "text-white" : "text-white/80"
      }`}
      style={{
        border: "1px solid color-mix(in srgb, var(--sg-white) 12%, transparent)",
        background: active
          ? "color-mix(in srgb, var(--sg-white) 12%, transparent)"
          : "color-mix(in srgb, var(--sg-white) 8%, transparent)",
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
      }}
    >
      {leftIcon}
      {children}
    </button>
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
  const [isPlaying, setIsPlaying] = useState(false);
  const [showMissionCelebration, setShowMissionCelebration] = useState(false);
  const [showRoomPicker, setShowRoomPicker] = useState(false);
  const [isWideLayout, setIsWideLayout] = useState(
    () => typeof window !== "undefined" && window.matchMedia(DESKTOP_LAYOUT_QUERY).matches,
  );
  const togglePlayRef = useRef<(() => void) | null>(null);

  const currentItem = path?.items[currentItemIndex] ?? null;
  const nextItem = path?.items[currentItemIndex + 1] ?? null;
  const currentItemKey = currentItem
    ? currentItem.item_id ?? currentItem.content_id ?? `idx-${currentItemIndex}`
    : null;
  const isItemCompleted = currentItemKey
    ? progress?.item_states?.[currentItemKey]?.completed ?? false
    : false;
  const artifactExpectation = path
    ? getMissionExpectedOutput(path, progress)
    : "A finished step you can carry into your next rep.";
  const missionWorld = getWorldConfig(getMissionPageWorldKey(path ?? null));
  const launchDomainLabel = path ? getMissionLaunchDomain(path).label : null;
  const {
    paths: recommendedPaths,
    isLoading: recommendedPathsLoading,
  } = usePostCompletionRecommendations({
    path,
    currentPathId: pathId,
    enabled: isCompleted,
  });

  useEffect(() => {
    const mql = window.matchMedia(DESKTOP_LAYOUT_QUERY);

    const handleChange = (event: MediaQueryListEvent) => {
      setIsWideLayout(event.matches);
    };

    mql.addEventListener("change", handleChange);
    return () => mql.removeEventListener("change", handleChange);
  }, []);

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
    if (!isWideLayout) {
      setSidebarOpen(false);
    }
    void advanceToItem(index);
  }, [advanceToItem, isWideLayout]);

  const renderStage = () => {
    if (isLoading && !path) {
      return (
        <MissionPageStage>
          <RoomStageScaffold
            variant="missionPage"
            eyebrow="Mission"
            title="Loading mission"
            description="Preparing the current step and mission map."
            footerMeta="Mission · Loading"
            contentClassName="max-w-[680px] space-y-4"
          >
            <RoomStagePanel className="flex items-center justify-center py-12">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/30 border-t-transparent" />
            </RoomStagePanel>
          </RoomStageScaffold>
        </MissionPageStage>
      );
    }

    if (error || !path) {
      return (
        <MissionPageStage>
          <RoomStageScaffold
            variant="missionPage"
            eyebrow="Mission"
            title="Couldn’t load this mission"
            description={error ?? "Try opening it again from Missions."}
            footerMeta="Mission · Unavailable"
            primaryAction={
              <Button variant="cta" size="sm" onClick={() => router.push("/missions")}>
                Back to Missions
              </Button>
            }
            contentClassName="max-w-[680px] space-y-4"
          >
            <RoomStagePanel className="space-y-2 text-center">
              <p className="text-sm leading-6 text-white/55">
                The mission content couldn&apos;t be prepared right now.
              </p>
            </RoomStagePanel>
          </RoomStageScaffold>
        </MissionPageStage>
      );
    }

    if (isCompleted) {
      return (
        <MissionPageStage>
          <RoomStageScaffold
            variant="missionPage"
            eyebrow="Mission complete"
            title="Mission complete"
            description="Your completed work, evidence, and capability snapshot are ready."
            footerMeta="Mission · Completed"
            primaryAction={
              <Button variant="cta" size="sm" onClick={() => router.push("/progress")}>
                View Progress
              </Button>
            }
            secondaryAction={
              <RoomStageSecondaryButton onClick={() => router.push("/missions")}>
                More Missions
              </RoomStageSecondaryButton>
            }
            contentClassName="max-w-[980px] space-y-5"
          >
            <MissionCompletionSummary
              path={path}
              progress={progress}
              achievement={achievement}
              skillReceipt={skillReceipt}
              artifactExpectation={artifactExpectation}
              recommendedPaths={recommendedPaths}
              recommendationsLoading={recommendedPathsLoading}
              variant="standalone"
            />

            <div className="flex justify-start">
              <Button variant="link" size="sm" onClick={() => router.push("/rooms")}>
                Browse Rooms
              </Button>
            </div>
          </RoomStageScaffold>
        </MissionPageStage>
      );
    }

    if (showTransition && nextItem) {
      return (
        <MissionPageStage>
          <RoomStageScaffold
            variant="missionPage"
            eyebrow="Up next"
            title={nextItem.title}
            description={nextItem.connective_text ?? "This is the next step waiting in the mission."}
            footerMeta={`${getStepLabel(nextItem)} · Ready when you are`}
            primaryAction={
              <Button
                variant="cta"
                size="sm"
                rightIcon={<ArrowRight size={14} />}
                onClick={handleContinue}
              >
                Continue
              </Button>
            }
            secondaryAction={
              <RoomStageSecondaryButton onClick={() => setShowTransition(false)}>
                Back to mission
              </RoomStageSecondaryButton>
            }
            contentClassName="max-w-[760px] space-y-4"
          >
            <RoomStagePanel className="space-y-3 text-center">
              <div className="flex items-center justify-center">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1 text-xs text-white/50">
                  {getStepIcon(nextItem)}
                  {getStepLabel(nextItem)}
                </div>
              </div>
              <p className="text-sm leading-6 text-white/55">
                Keep moving straight into the next step from here.
              </p>
            </RoomStagePanel>
          </RoomStageScaffold>
        </MissionPageStage>
      );
    }

    if (currentItem) {
      return (
        <MissionPageStage>
          <ContentViewer
            item={currentItem}
            isCompleted={isItemCompleted}
            onComplete={handleComplete}
            onCompleteWithState={handleCompleteWithState}
            variant="missionPage"
            onPlayStateChange={setIsPlaying}
            togglePlayRef={togglePlayRef}
          />
        </MissionPageStage>
      );
    }

    return (
      <MissionPageStage>
        <RoomStageScaffold
          variant="missionPage"
          eyebrow="Mission"
          title={path.title}
          description="This mission doesn’t have any steps yet."
          footerMeta="Mission · Empty"
          primaryAction={
            <Button variant="cta" size="sm" onClick={() => router.push("/missions")}>
              Back to Missions
            </Button>
          }
          contentClassName="max-w-[680px] space-y-4"
        >
          <RoomStagePanel className="space-y-2 text-center">
            <p className="text-sm leading-6 text-white/55">
              Try another mission while this one is being prepared.
            </p>
          </RoomStagePanel>
        </RoomStageScaffold>
      </MissionPageStage>
    );
  };

  const pageTitle = path?.title ?? "Mission";

  return (
    <div className="relative flex h-screen flex-col overflow-hidden bg-[var(--sg-forest-900)]">
      <div className="absolute inset-0">
        <div
          className="absolute inset-0"
          style={{ background: missionWorld.placeholderGradient }}
        />
        {missionWorld.placeholderPattern ? (
          <div
            className="absolute inset-0 opacity-75"
            style={{
              backgroundImage: missionWorld.placeholderPattern,
              backgroundSize: "20px 20px",
            }}
          />
        ) : null}
        <div
          className="absolute inset-0"
          style={{ background: missionWorld.environmentOverlay }}
        />
      </div>

      <div className="relative z-10 flex h-full flex-col">
      <header className="relative z-10 grid shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 py-4 md:px-6 md:pt-6">
        <div className="justify-self-start">
          <MissionPageUtilityButton
            leftIcon={<ArrowLeft size={15} strokeWidth={2} />}
            onClick={() => router.push("/missions")}
          >
            Missions
          </MissionPageUtilityButton>
        </div>

        <div className="min-w-0 px-2">
          <div className="space-y-1 text-center">
            <h1 className="truncate text-sm font-medium text-white/90">
              {pageTitle}
            </h1>
            {launchDomainLabel ? (
              <p className="truncate text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45">
                {launchDomainLabel}
              </p>
            ) : null}
          </div>
        </div>

        <div className="justify-self-end">
          {path ? (
            <MissionPageUtilityButton onClick={() => setShowRoomPicker(true)}>
              Enter room
            </MissionPageUtilityButton>
          ) : null}
        </div>
      </header>

      <div className="relative flex-1 min-h-0 overflow-hidden px-4 pb-4 md:px-6 md:pb-6">
        {!isWideLayout && sidebarOpen ? (
          <button
            type="button"
            aria-label="Close mission map"
            onClick={() => setSidebarOpen(false)}
            className="absolute inset-0 z-10 bg-black/30"
          />
        ) : null}

        <div className="flex h-full gap-4">
          <div className="relative min-w-0 flex-1">
            {path ? (
              <div className="absolute right-4 top-4 z-20">
              <MissionPageUtilityButton
                onClick={() => setSidebarOpen((open) => !open)}
                leftIcon={<PanelsTopLeft size={14} />}
                active={sidebarOpen}
                aria-expanded={sidebarOpen}
                aria-controls="standalone-mission-map"
              >
                Map
              </MissionPageUtilityButton>
              </div>
            ) : null}

            <div className="h-full overflow-y-auto">
              {renderStage()}
            </div>
          </div>

          {isWideLayout && sidebarOpen ? (
            <aside
              id="standalone-mission-map"
              className="flex h-full w-[380px] shrink-0 flex-col rounded-[var(--sg-radius-xl)] border border-white/[0.08]"
              style={{
                background: "color-mix(in srgb, var(--sg-forest-900) 78%, transparent)",
                backdropFilter: "blur(24px)",
                WebkitBackdropFilter: "blur(24px)",
                boxShadow: "var(--sg-shadow-dark-md)",
              }}
              role="complementary"
              aria-label="Mission map"
            >
              <PanelHeader
                title="Mission Map"
                onClose={() => setSidebarOpen(false)}
              />

              <div className="min-h-0 flex-1">
                {path ? (
                  <PathSidebar
                    path={path}
                    progress={progress}
                    currentItemIndex={currentItemIndex}
                    onSelectItem={handleSelectItem}
                    isPlaying={isPlaying}
                    onTogglePlay={() => togglePlayRef.current?.()}
                    title={null}
                    showSkills={false}
                  />
                ) : null}
              </div>
            </aside>
          ) : null}
        </div>

        {!isWideLayout ? (
          <div
            className="absolute right-0 top-0 z-20 h-full transition-[width] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]"
            style={{
              width: sidebarOpen ? "min(380px, calc(100vw - 24px))" : 0,
              overflow: "hidden",
            }}
          >
            <aside
              id="standalone-mission-map"
              className="mr-4 flex h-full flex-col rounded-[var(--sg-radius-xl)] border border-white/[0.08]"
              style={{
                width: "min(380px, calc(100vw - 24px))",
                background: "color-mix(in srgb, var(--sg-forest-900) 78%, transparent)",
                backdropFilter: "blur(24px)",
                WebkitBackdropFilter: "blur(24px)",
                boxShadow: "var(--sg-shadow-dark-md)",
              }}
              role="complementary"
              aria-label="Mission map"
            >
              <PanelHeader
                title="Mission Map"
                onClose={() => setSidebarOpen(false)}
              />

              <div className="min-h-0 flex-1">
                {path ? (
                  <PathSidebar
                    path={path}
                    progress={progress}
                    currentItemIndex={currentItemIndex}
                    onSelectItem={handleSelectItem}
                    isPlaying={isPlaying}
                    onTogglePlay={() => togglePlayRef.current?.()}
                    title={null}
                    showSkills={false}
                  />
                ) : null}
              </div>
            </aside>
          </div>
        ) : null}
      </div>
      </div>

      <AdjustAnytimeBanner />
      <FirstPathTooltip />
      {path && showRoomPicker ? (
        <MissionRoomPickerModal
          isOpen={showRoomPicker}
          onClose={() => setShowRoomPicker(false)}
          path={path}
          progress={progress}
        />
      ) : null}
      {showMissionCelebration ? (
        <MissionCelebration onDismiss={() => setShowMissionCelebration(false)} />
      ) : null}
      {isCompleted && path ? (
        <RoomBridge topicName={getMissionLaunchDomainShortLabel(path)} />
      ) : null}
    </div>
  );
}
