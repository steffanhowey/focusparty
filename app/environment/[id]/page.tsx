"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { useSessionPersistence } from "@/lib/useSessionPersistence";
import { usePartyPresence } from "@/lib/usePartyPresence";
import { usePartyActivityFeed } from "@/lib/usePartyActivityFeed";
import { useTimer } from "@/lib/useTimer";
import { useCamera } from "@/lib/useCamera";
import { useSettings } from "@/lib/useSettings";
import { useTasks } from "@/lib/useTasks";
import { useExternalItems } from "@/lib/integrations/useExternalItems";
import { useGoals } from "@/lib/useGoals";
import { useCommitments } from "@/lib/useCommitments";
import { useHostTriggers } from "@/lib/useHostTriggers";
import { useMusic } from "@/lib/useMusic";
import { useChat } from "@/lib/useChat";
import { useNotes } from "@/lib/useNotes";
import { useTheme } from "@/components/providers/ThemeProvider";
import { useNotification } from "@/components/providers/NotificationProvider";
import {
  FOREST_300,
  TEAL_500,
  GOLD_500,
  GOLD_600,
	TEAL_600,
} from "@/lib/palette";
import { joinParty, updatePartyStatus, leaveParty } from "@/lib/parties";
import { getPartyLaunchDisplayName } from "@/lib/launchRooms";
import { useEnvironmentParty } from "@/lib/useEnvironmentParty";
import { computeRoomState, ROOM_STATE_CONFIG } from "@/lib/roomState";
import { EnvironmentBackground } from "@/components/environment/EnvironmentBackground";
import { EnvironmentLoadingShell } from "@/components/environment/EnvironmentLoadingShell";
import { EnvironmentHeader } from "@/components/environment/EnvironmentHeader";
import {
  EnvironmentParticipants,
  type ParticipantInfo,
} from "@/components/environment/EnvironmentParticipants";
import { ParticipantCard } from "@/components/environment/ParticipantCard";
import { EnvironmentRail } from "@/components/environment/EnvironmentRail";
import { RoomMissionOverlay } from "@/components/environment/RoomMissionOverlay";
import { ActionBar } from "@/components/session/ActionBar";
import { SprintGoalBanner } from "@/components/session/SprintGoalBanner";
import { SideDrawer } from "@/components/session/SideDrawer";
import { SettingsPanel } from "@/components/session/SettingsPanel";
import { PanelHeader } from "@/components/session/PanelHeader";
import { SessionReviewModal } from "@/components/session/SessionReviewModal";
import { LeaveConfirmModal } from "@/components/session/LeaveConfirmModal";
import { SwitchTaskModal } from "@/components/session/SwitchTaskModal";
import { logEvent, updateSession, updateSessionGoalStatus } from "@/lib/sessions";
import { computeRemainingSeconds } from "@/lib/sprintTime";
import { SYNTHETIC_POOL } from "@/lib/synthetics/pool";
import { getSyntheticsForRoom } from "@/lib/synthetics/assignment";
import { JoinRoomModal, type JoinConfig } from "@/components/party/JoinRoomModal";
import type { SessionPhase, SessionReflection, SprintResolution, BreakContentItem, BreakDuration, BreakCategory, ItemState } from "@/lib/types";
import { checkGoalCompletion } from "@/lib/goalCascade";
import { BreaksFlyout } from "@/components/environment/BreaksFlyout";
import { BreakVideoOverlay } from "@/components/environment/BreakVideoOverlay";
import { CurriculumBreakFlyout } from "@/components/environment/CurriculumBreakFlyout";
import { FloatingNotes } from "@/components/environment/FloatingNotes";
import { FloatingFocus } from "@/components/session/FloatingFocus";
import { PathSidebar } from "@/components/learn/PathSidebar";
import { useBreakContent, type BreakClip } from "@/lib/useBreakContent";
import { useCurriculum } from "@/lib/useCurriculum";
import { useLearnProgress } from "@/lib/useLearnProgress";
import { usePostCompletionRecommendations } from "@/lib/usePostCompletionRecommendations";
import { extractYouTubeId } from "@/lib/youtube";

type SidePanel = "none" | "momentum" | "chat" | "settings" | "breaks" | "mission";
type CelebrationInfo = { color: string; text: string };
const PANEL_WIDTH = 380;
const DEFAULT_DURATION_SEC = 25 * 60;
const MISSION_OVERLAY_CENTER_GAP = 24;

interface MissionSelectionState {
  missionId: string | null;
  missionTitle: string | null;
  missionDomain: string | null;
}

function normalizeMissionSelection(
  selection: MissionSelectionState | null
): MissionSelectionState | null {
  if (!selection) return null;
  if (!selection.missionId && !selection.missionTitle && !selection.missionDomain) {
    return null;
  }

  return selection;
}

function getMissionSelectionMetadata(
  selection: MissionSelectionState | null
): Record<string, unknown> | null {
  const missionSelection = normalizeMissionSelection(selection);
  if (!missionSelection) {
    return null;
  }

  return {
    source: "mission",
    mission_id: missionSelection.missionId,
    mission_title: missionSelection.missionTitle,
    mission_domain: missionSelection.missionDomain,
  };
}

function getMissionSelectionFromJoinConfig(
  config: JoinConfig | null
): MissionSelectionState | null {
  if (!config) return null;

  return normalizeMissionSelection({
    missionId: config.missionId,
    missionTitle: config.missionTitle,
    missionDomain: config.missionDomain,
  });
}

function getMissionSelectionFromMetadata(
  metadata: Record<string, unknown> | null | undefined
): MissionSelectionState | null {
  if (!metadata) return null;

  const missionId =
    typeof metadata.mission_id === "string" ? metadata.mission_id : null;
  const missionTitle =
    typeof metadata.mission_title === "string" ? metadata.mission_title : null;
  const missionDomain =
    typeof metadata.mission_domain === "string" ? metadata.mission_domain : null;

  return normalizeMissionSelection({
    missionId,
    missionTitle,
    missionDomain,
  });
}

function getJoinMissionMetadata(
  config: JoinConfig | null
): Record<string, unknown> | null {
  return getMissionSelectionMetadata(getMissionSelectionFromJoinConfig(config));
}

function normalizeJoinConfig(rawConfig: unknown): JoinConfig {
  const config = (rawConfig ?? {}) as Partial<JoinConfig> & {
    goalText?: string | null;
  };

  return {
    missionId: config.missionId ?? null,
    missionTitle: config.missionTitle ?? config.goalText ?? null,
    missionDomain: config.missionDomain ?? null,
    durationSec: config.durationSec ?? DEFAULT_DURATION_SEC,
    autoStart: config.autoStart ?? false,
    commitmentType: config.commitmentType ?? "personal",
    musicAutoPlay: config.musicAutoPlay ?? false,
  };
}

// ─── Synthetic flavor pools (archetype × sprint phase) ────
// Flavors shift naturally as the synthetic progresses through their sprint.
// "starting" = first 20%, "deep" = middle 60%, "wrapping" = last 20%.
// Each phase has ~6 entries per archetype. The visible flavor changes
// every ~4 min within a 25-min sprint (5 transitions per sprint).
type SprintPhase = "starting" | "deep" | "wrapping";

const SYNTHETIC_FLAVORS: Record<string, Record<SprintPhase, string[]>> = {
  coder: {
    starting: [
      "pulling latest and reading the diff", "scanning my open issues", "picking up where I left off",
      "reading through the PR comments", "setting up the dev server", "reviewing the ticket",
    ],
    deep: [
      "debugging auth flow", "deep in a refactor rn", "working thru a tricky edge case",
      "wiring up the new endpoint", "fixing a flaky test", "sorting out the API layer",
      "type errors", "in the zone", "heads down", "catching up on code reviews",
    ],
    wrapping: [
      "almost done w/ this PR", "cleaning up before I push", "running the test suite one more time",
      "writing the commit message", "just need to finish testing", "final review pass",
    ],
  },
  writer: {
    starting: [
      "reading back yesterday's edits", "reviewing my outline", "finding where I left off",
      "scanning my notes from last session", "opening the draft", "re-reading the last section",
    ],
    deep: [
      "rewriting the intro section", "editing ch. 3 draft", "cutting fluff from the second draft",
      "tightening the conclusion", "flow state", "heads down",
      "trying to finish this blog post", "research", "writing",
    ],
    wrapping: [
      "almost done with this section", "one more paragraph to tighten", "saving and backing up",
      "making a note of where to pick up next", "quick spell check pass", "wrapping up the draft",
    ],
  },
  founder: {
    starting: [
      "checking metrics from overnight", "scanning customer support tickets", "reviewing the task board",
      "reading through investor email thread", "pulling up the dashboard", "prioritizing today's list",
    ],
    deep: [
      "updating the landing page", "investor update email", "user interview followups",
      "scoping down the MVP", "going through NPS feedback", "metrics review",
      "sketching the new dashboard", "heads down", "deep work block",
    ],
    wrapping: [
      "almost done w/ the feature spec", "sending the investor update", "wrapping up the analysis",
      "scheduling follow-ups for tomorrow", "finsihing up the proposal", "noting next steps",
    ],
  },
  gentle: {
    starting: [
      "settling in", "reviewing my planner", "deciding what to focus on first",
      "getting organized", "opening my notes", "taking a breath before diving in",
    ],
    deep: [
      "organizing project notes", "working through feedback", "journaling",
      "filling in the weekly planner", "annotating yesterday's readings",
      "sorting through reference photos", "reading", "flow state",
    ],
    wrapping: [
      "winding down gently", "saving progress", "jotting a note for next time",
      "tidying up before I stop", "almost done for now", "reflecting on what I got done",
    ],
  },
};

/**
 * Get the sprint-phase-aware flavor for a synthetic.
 * @param archetype - coder/writer/founder/gentle
 * @param sprintProgress - 0.0 to 1.0 (elapsed / duration)
 * @param synId - synthetic ID for deterministic selection within a phase
 */
function getSyntheticFlavor(
  archetype: string | undefined,
  sprintProgress: number,
  synId: string,
): string {
  const archetypeFlavors = SYNTHETIC_FLAVORS[archetype ?? "gentle"] ?? SYNTHETIC_FLAVORS.gentle;
  // Determine phase from sprint progress
  let phase: SprintPhase;
  if (sprintProgress < 0.20) phase = "starting";
  else if (sprintProgress < 0.80) phase = "deep";
  else phase = "wrapping";

  const pool = archetypeFlavors[phase];
  // Use synId hash + a slow-rotating time bucket (4 min) for variety within a phase
  const timeBucket = Math.floor(Date.now() / (4 * 60 * 1000));
  const hash = synId.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return pool[(hash + timeBucket) % pool.length];
}

// ─── Synthetic break titles (world-themed) ────────────────
// Each world gets break titles that match its content persona.
const SYNTHETIC_BREAK_TITLES_BY_WORLD: Record<string, string[]> = {
  default: [
    "How Experts Learn New Skills", "The Science of Flow States",
    "Creative Process Deep Dive", "Learning How to Learn",
    "The Surprising Science of Focus", "How Memory Actually Works",
    "Why Curiosity Matters More Than Talent", "Building Better Mental Models",
  ],
  "vibe-coding": [
    "Fireship: 100 Seconds of Bun", "System Design Fundamentals",
    "Building with Server Components", "The Primeagen on Dev Tooling",
    "Theo: Why TypeScript Won", "Live Coding a CLI Tool",
    "Web Dev Simplified: React Hooks", "Andrej Karpathy: Neural Nets",
  ],
  "writer-room": [
    "Brandon Sanderson on Revision", "Story Structure Masterclass",
    "Nerdwriter: Close Reading", "The Discipline of Showing Up",
    "Finding Your Voice as a Writer", "Editing Like a Pro",
    "The Art of the Opening Line", "Why Great Stories Break Rules",
  ],
  "yc-build": [
    "YC: How to Talk to Users", "Garry Tan on Founder Mistakes",
    "Metrics That Actually Matter", "Paul Graham: Do Things That Don't Scale",
    "Michael Seibel on MVP Scope", "Customer Development Fundamentals",
    "How to Find Product-Market Fit", "Fundraising: What VCs Look For",
  ],
  "gentle-start": [
    "Building Focus Without Pressure", "The Power of Small Steps",
    "Cal Newport on Deep Work", "Overcoming Creative Resistance",
    "Matt D'Avella: Intentional Living", "Self-Compassion in Creative Work",
    "Why Rest is Productive", "Finding Your Natural Rhythm",
  ],
};
const SYNTHETIC_BREAK_TITLES_DEFAULT = SYNTHETIC_BREAK_TITLES_BY_WORLD.default;

function getSyntheticBreakTitle(worldKey: string, index: number): string {
  const pool = SYNTHETIC_BREAK_TITLES_BY_WORLD[worldKey] ?? SYNTHETIC_BREAK_TITLES_DEFAULT;
  return pool[index % pool.length];
}

// ─── Synthetic goal templates (archetype-aware) ───────────
// Shown in participant cards as the synthetic's declared goal.
const SYNTHETIC_GOALS_BY_ARCHETYPE: Record<string, string[]> = {
  coder: [
    "Finish the auth refactor", "Ship the new API endpoint", "Clear the PR review queue",
    "Fix the flaky test suite", "Migrate to the new SDK", "Build the settings page",
    "Wire up webhook handling", "Debug the state management issue",
  ],
  writer: [
    "Finish chapter 3 draft", "Edit the feature article", "Write the newsletter intro",
    "Complete the content brief", "Revise the opening section", "Outline the next chapter",
    "Polish the blog post", "Tighten the conclusion",
  ],
  founder: [
    "Update the pitch deck", "Finish the feature spec", "Review customer interview notes",
    "Ship the landing page update", "Analyze the onboarding funnel", "Write investor update",
    "Scope the MVP down", "Map out the growth experiment",
  ],
  gentle: [
    "Organize project notes", "Work through the study guide", "Fill in the weekly planner",
    "Sort through reference materials", "Annotate the reading list", "Tidy up project folders",
    "Catch up on highlights", "Map out the week ahead",
  ],
};

function getSyntheticGoal(archetype: string | undefined, synId: string): string {
  const pool = SYNTHETIC_GOALS_BY_ARCHETYPE[archetype ?? "gentle"] ?? SYNTHETIC_GOALS_BY_ARCHETYPE.gentle;
  // Deterministic per synthetic so their goal is stable across re-renders
  const hash = synId.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return pool[hash % pool.length];
}

export default function EnvironmentPage() {
  const params = useParams();
  const partyId = params.id as string;
  const router = useRouter();
  const { userId, displayName, username, avatarUrl } = useCurrentUser();
  const { characterAccent } = useTheme();
  const { showToast } = useNotification();

  // ─── Party data, config & background ──────────────────
  const {
    party,
    partyLoading,
    syntheticParticipants,
    world,
    hostConfig,
    backgroundImageUrl,
    modalBackgrounds,
  } = useEnvironmentParty(partyId);
  const roomDisplayName = getPartyLaunchDisplayName(party);

  // ─── Session state machine ────────────────────────────
  const persistence = useSessionPersistence(userId);
  const [phase, setPhase] = useState<SessionPhase>("setup");
  const [showJoinModal, setShowJoinModal] = useState(true);
  const [goal, setGoal] = useState("");
  const [selectedMissionContext, setSelectedMissionContext] =
    useState<MissionSelectionState | null>(null);
  const [activeGoalId, setActiveGoalId] = useState<string | null>(null);
  const [durationSec, setDurationSec] = useState(DEFAULT_DURATION_SEC);
  const reviewElapsedRef = useRef(0);
  const roomEntrySourcePartyIdRef = useRef<string | null>(null);
  const [pendingSwitchTaskId, setPendingSwitchTaskId] = useState<string | null>(null);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [sprintGoalCardOpen, setSprintGoalCardOpen] = useState(false);
  const [commitmentType, setCommitmentType] = useState<import("@/lib/types").CommitmentType>("personal");
  const [sessionGoalId, setSessionGoalId] = useState<string | null>(null);
  const [joiningCountdown, setJoiningCountdown] = useState(0);
  const [resumingCountdown, setResumingCountdown] = useState(0);
  const resolutionHandledRef = useRef(false);
  const restartingSprintRef = useRef(false);
  const [committedTaskIds, setCommittedTaskIds] = useState<Set<string>>(new Set());
  const [micActive, setMicActive] = useState(false);
  const [checkInOpen, setCheckInOpen] = useState(false);
  const [focusPopoverOpen, setFocusPopoverOpen] = useState(false);
  const [missionTransitionOpen, setMissionTransitionOpen] = useState(false);
  const [floatingFocusOpen, setFloatingFocusOpen] = useState(false);
  const [participantStripWidth, setParticipantStripWidth] = useState(208);
  const focusButtonRef = useRef<HTMLButtonElement>(null);
  const [celebrations, setCelebrations] = useState<Map<string, CelebrationInfo>>(new Map());
  const lastFeedLengthRef = useRef(0);
  const feedInitializedRef = useRef(false);

  // ─── Break session state ────────────────────────────────
  const [breakContent, setBreakContent] = useState<BreakContentItem | null>(null);
  const [breakDuration, setBreakDuration] = useState<BreakDuration>(5);
  const [breakActive, setBreakActive] = useState(false);
  const [breakCategory, setBreakCategory] = useState<BreakCategory>("learning");
  const [breakPopoverOpen, setBreakPopoverOpen] = useState(false);

  // ─── Notes state ───────────────────────────────────────────
  const [notesPopoverOpen, setNotesPopoverOpen] = useState(false);
  const [floatingNotesOpen, setFloatingNotesOpen] = useState(false);
  const notesButtonRef = useRef<HTMLButtonElement>(null);
  const sessionId = persistence.sessionRow?.id ?? null;
  const breakContext = useMemo(() => ({
    category: breakActive ? breakCategory : null,
    contentItemId: breakActive ? (breakContent?.id ?? null) : null,
  }), [breakActive, breakCategory, breakContent?.id]);
  const notes = useNotes(partyId, sessionId, breakContext);
  const handleToggleNotesPopover = useCallback(() => {
    if (phase === "break") {
      setFloatingNotesOpen((prev) => !prev);
    } else {
      setNotesPopoverOpen((prev) => !prev);
    }
  }, [phase]);
  const handleCloseNotesPopover = useCallback(() => setNotesPopoverOpen(false), []);
  const handleToggleNotes = useCallback(() => {
    // Used by BreakVideoOverlay — open floating notes directly during breaks
    setFloatingNotesOpen((prev) => !prev);
  }, []);

  // Break content shelf — used to give synthetics real content IDs
  const { items: breakShelfItems } = useBreakContent(world.worldKey, "learning");

  // Curriculum for auto-generated rooms
  const { curriculum, currentPosition, markCompleted: markCurriculumCompleted } = useCurriculum(partyId, userId);

  // Break clips for channel changer — set when user picks from flyout
  const [breakClips, setBreakClips] = useState<BreakClip[]>([]);
  const currentBreakClipIndex = useMemo(
    () => breakContent ? breakClips.findIndex((c) => c.sourceItem.id === breakContent.id) : 0,
    [breakClips, breakContent]
  );

  const handleChangeClip = useCallback((clip: BreakClip) => {
    setBreakContent(clip.sourceItem);
    setBreakDuration(clip.duration);
  }, []);

  // ─── Side panel state (same pattern as session page) ──
  const [activePanel, setActivePanel] = useState<SidePanel>("none");
  const prevPanelRef = useRef<SidePanel>(activePanel);
  const panelOpen = activePanel !== "none";
  const [missionWorkspaceOpen, setMissionWorkspaceOpen] = useState(false);
  const wasOpen = prevPanelRef.current !== "none";
  const shouldAnimatePanel = panelOpen !== wasOpen;
  useEffect(() => {
    prevPanelRef.current = activePanel;
  }, [activePanel]);

  const {
    path: roomMissionPath,
    progress: roomMissionProgress,
    achievement: roomMissionAchievement,
    currentItemIndex: roomMissionCurrentItemIndex,
    isLoading: roomMissionLoading,
    error: roomMissionError,
    completeItem: completeMissionItem,
    advanceToItem: advanceMissionItem,
    isCompleted: roomMissionCompleted,
    skillReceipt: roomMissionSkillReceipt,
  } = useLearnProgress(
    selectedMissionContext?.missionId ?? null,
    missionWorkspaceOpen && phase === "sprint",
  );
  const {
    paths: roomMissionRecommendedPaths,
    isLoading: roomMissionRecommendationsLoading,
  } = usePostCompletionRecommendations({
    path: roomMissionPath,
    currentPathId: selectedMissionContext?.missionId ?? null,
    enabled: missionWorkspaceOpen && phase === "sprint" && roomMissionCompleted,
  });

  // ─── Host triggers ref (break circular dep) ──────────
  const hostTriggersRef = useRef<{
    triggerSessionStarted: () => void;
    triggerSprintStarted: () => void;
    triggerReviewEntered: () => void;
    triggerSessionCompleted: () => void;
  }>({
    triggerSessionStarted: () => {},
    triggerSprintStarted: () => {},
    triggerReviewEntered: () => {},
    triggerSessionCompleted: () => {},
  });

  const handleTimerComplete = useCallback(() => {
    reviewElapsedRef.current = durationSec;
    setShowLeaveConfirm(false);
    setPhase("review");
    persistence.completeSprint().catch((err) => console.error("Failed to complete sprint:", err));
    persistence.updatePhase("review").catch((err) =>
      console.error("Failed to update phase to review:", err)
    );
    hostTriggersRef.current.triggerReviewEntered();
  }, [durationSec, persistence]);

  const timer = useTimer(durationSec, handleTimerComplete);
  const camera = useCamera(false);

  // ─── Presence ──────────────────────────────────────────
  const presence = usePartyPresence({
    partyId,
    userId,
    displayName,
    username,
    avatarUrl,
    character: characterAccent,
    activeSessionId: persistence.sessionRow?.id ?? null,
    phase,
    goalPreview: goal || null,
    commitmentType: commitmentType || null,
    sprintStartedAt: phase === "sprint" ? (persistence.currentSprint?.started_at ?? null) : null,
    sprintDurationSec: phase === "sprint" ? (persistence.currentSprint?.duration_sec ?? null) : null,
    breakContentId: phase === "break" ? (breakContent?.id ?? null) : null,
    breakContentTitle: phase === "break" ? (breakContent?.title ?? null) : null,
    breakContentThumbnail: phase === "break" ? (breakContent?.thumbnail_url ?? null) : null,
    breakLearningState: phase === "break" && breakActive ? "watching" : null,
  });

  // ─── Activity feed + room state ───────────────────────
  const feedDisplayNameMap = useMemo(() => {
    const map = new Map<string, string>();
    presence.participants.forEach((p) => map.set(p.userId, p.displayName));
    return map;
  }, [presence.participants]);

  const { events: feedEvents, isLoading: feedLoading } = usePartyActivityFeed(partyId, feedDisplayNameMap);
  const roomState = useMemo(
    () => computeRoomState(feedEvents, presence.participants.length),
    [feedEvents, presence.participants.length]
  );
  const roomStateDisplay = ROOM_STATE_CONFIG[roomState];

  // ─── Avatar celebration bursts (check-in + high-five) ──
  useEffect(() => {
    // Wait until the feed has finished its initial DB fetch.
    // Once loading completes, snapshot the current length so we only
    // celebrate events that arrive via realtime AFTER the initial load.
    if (feedLoading) return;

    if (!feedInitializedRef.current) {
      feedInitializedRef.current = true;
      lastFeedLengthRef.current = feedEvents.length;
      return;
    }

    if (feedEvents.length <= lastFeedLengthRef.current) {
      lastFeedLengthRef.current = feedEvents.length;
      return;
    }
    const newEvents = feedEvents.slice(lastFeedLengthRef.current);
    lastFeedLengthRef.current = feedEvents.length;

    for (const event of newEvents) {
      let targetId: string | null = null;
      let color = TEAL_500;
      let text = "";

      if (event.event_type === "check_in") {
        // Skip own check-ins — already handled optimistically in handleCheckIn
        if (event.actor_type !== "synthetic" && event.user_id === userId) continue;
        targetId =
          event.actor_type === "synthetic"
            ? (event.payload?.synthetic_id as string) ?? null
            : event.user_id;
        const action = event.payload?.action as string;
        const taskTitle = event.payload?.task_title as string | undefined;
        const message = event.payload?.message as string | undefined;

        if (action === "progress") {
          color = FOREST_300;
          text = "Making progress";
        } else if (action === "ship") {
          color = GOLD_600;
          text = taskTitle ? `Shipped ${taskTitle}` : "Shipped something";
        } else if (action === "reset") {
          color = GOLD_500;
          text = "Taking a reset";
        } else if (action === "update") {
          color = TEAL_500;
          text = message || "Shared an update";
        }
      }

      if (event.event_type === "high_five") {
        const hfTarget = (event.payload?.target_user_id as string) ?? null;
        // Skip synthetic return high-fives targeting us — already handled optimistically
        if (event.actor_type === "synthetic" && hfTarget === userId) continue;
        targetId = hfTarget;
        color = GOLD_600;
        text = "High five!";
      }

      if (event.event_type === "sprint_completed") {
        targetId =
          event.actor_type === "synthetic"
            ? (event.payload?.synthetic_id as string) ?? null
            : event.user_id;
        color = FOREST_300;
        text = "Sprint complete!";
      }

      if (event.event_type === "break_completed") {
        targetId = event.user_id;
        color = TEAL_600;
        text = "Back to it!";
      }

      if (event.event_type === "task_completed") {
        // Skip own task completions — already handled optimistically in handleCompleteTask
        if (event.user_id === userId) continue;
        targetId = event.actor_type === "synthetic"
          ? (event.payload?.synthetic_id as string) ?? null
          : event.user_id;
        color = FOREST_300;
        text = "Step done!";
      }

      if (event.event_type === "goal_completed") {
        // Skip own goal completions — already handled optimistically in handleCompleteGoal
        if (event.user_id === userId) continue;
        targetId = event.user_id;
        color = FOREST_300;
        text = "Mission complete!";
      }

      if (targetId) {
        // Synthetic celebrations get a 1-3s random delay to feel less robotic
        const delay = event.actor_type === "synthetic" ? 1000 + Math.random() * 2000 : 0;
        const tid = targetId; // capture for closure
        setTimeout(() => {
          setCelebrations((prev) => new Map(prev).set(tid, { color, text }));
          setTimeout(() => {
            setCelebrations((prev) => {
              const next = new Map(prev);
              next.delete(tid);
              return next;
            });
          }, 2000);
        }, delay);
      }
    }
  }, [feedEvents.length, feedLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Synthetic tick (keep bots active during sessions) ──
  useEffect(() => {
    if (phase !== "sprint") return;

    // Fire an initial tick on sprint start, then every 45s
    const tick = () =>
      fetch("/api/synthetics/tick", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ partyId }),
      }).catch(() => {});

    tick();
    const id = setInterval(tick, 45_000);
    return () => clearInterval(id);
  }, [phase, partyId]);

  // ─── AI host ───────────────────────────────────────────
  const hostTriggers = useHostTriggers({
    partyId,
    sessionId: persistence.sessionRow?.id ?? null,
    sprintId: persistence.currentSprint?.id ?? null,
    userId,
    goalSummary: goal || null,
    participantCount: presence.count,
    sprintNumber: persistence.currentSprint?.sprint_number ?? null,
    sprintDurationSec: durationSec,
    timer,
    phase,
  });
  hostTriggersRef.current = hostTriggers;

  // ─── Chat + Music + Settings ────────────────────────────
  const chat = useChat();
  const music = useMusic();
  const { settings, updateSetting } = useSettings();

  // Auto-play the room's vibe when entering sprint phase (only if user opted in)
  const musicAutoPlayRef = useRef(false);
  const prevPhaseRef = useRef(phase);
  useEffect(() => {
    const wasNotSprint = prevPhaseRef.current !== "sprint";
    prevPhaseRef.current = phase;
    if (phase !== "sprint" || !wasNotSprint) return;
    if (!musicAutoPlayRef.current) return;

    // Only select if not already playing the room's vibe
    if (music.activeVibe !== world.vibeKey) {
      music.selectVibe(world.vibeKey);
    } else if (!music.isPlaying) {
      music.play();
    }
  }, [phase, world.vibeKey, music]);

  // ─── Tasks ─────────────────────────────────────────────
  const {
    activeTasks,
    completedTasks,
    activeTask,
    addTask,
    completeTask,
    uncompleteTask,
    deleteTask,
    editTask,
    selectTask,
    reorderTasks,
  } = useTasks();

  // ─── Session-scoped commitments (filter for flyout) ─────
  const commitTask = useCallback((taskId: string) => {
    setCommittedTaskIds((prev) => {
      if (prev.has(taskId)) return prev;
      const next = new Set(prev);
      next.add(taskId);
      return next;
    });
  }, []);

  const committedActiveTasks = useMemo(
    () => activeTasks.filter((t) => committedTaskIds.has(t.id)),
    [activeTasks, committedTaskIds]
  );

  const committedCompletedTasks = useMemo(
    () => completedTasks.filter((t) => committedTaskIds.has(t.id)),
    [completedTasks, committedTaskIds]
  );

  const addAndCommitTask = useCallback(
    async (text: string) => {
      const newId = await addTask(text);
      if (newId) commitTask(newId);
    },
    [addTask, commitTask]
  );

  // ─── External items (GitHub, Linear, etc.) ──────────────
  const externalItems = useExternalItems(activeTasks);

  // Derive linkedResource info from the active task for host context + writeback
  const activeLinkedResource = useMemo(() => {
    const lr = activeTask?.linked_resource;
    if (!lr) return null;
    return {
      provider: lr.provider,
      title: lr.title,
      url: lr.url,
      resourceType: lr.resource_type,
      externalId: lr.external_id,
    };
  }, [activeTask?.linked_resource]);

  // Feed linkedResource into host triggers (hook is called above useTasks, so late-bind via setter)
  useEffect(() => {
    hostTriggers.setLinkedResource(activeLinkedResource);
  }, [activeLinkedResource, hostTriggers]);

  // ─── Goals (for task drawer context) ─────────────────────
  const { activeGoals, createGoal, completeGoal, deleteGoal: deleteGoalApi, updateGoal } = useGoals();
  const commitments = useCommitments();
  const activeGoalForTask = useMemo(() => {
    if (!activeTask?.goal_id) return null;
    return activeGoals.find((g) => g.id === activeTask.goal_id) ?? null;
  }, [activeTask?.goal_id, activeGoals]);

  const goalTasks = useMemo(() => {
    if (!activeGoalForTask) return undefined;
    return [...activeTasks, ...completedTasks].filter(
      (t) => t.goal_id === activeGoalForTask.id
    );
  }, [activeGoalForTask, activeTasks, completedTasks]);

  const resetToJoinSetup = useCallback(() => {
    setSelectedMissionContext(null);
    setActiveGoalId(null);
    setSessionGoalId(null);
    setCommitmentType("personal");
    selectTask(null);
    setGoal("");
    setMissionTransitionOpen(false);
    setMissionWorkspaceOpen(false);
    setShowLeaveConfirm(false);
    setSprintGoalCardOpen(false);
    setJoiningCountdown(0);
    setResumingCountdown(0);
    resolutionHandledRef.current = false;
    setPhase("setup");
    setShowJoinModal(true);
  }, [selectTask]);

  const triggerHostSessionStart = useCallback(() => {
    setTimeout(() => {
      hostTriggersRef.current.triggerSessionStarted();
    }, 0);
  }, []);

  const triggerHostSprintStart = useCallback(() => {
    setTimeout(() => {
      hostTriggersRef.current.triggerSprintStarted();
    }, 0);
  }, []);



  const [isAISuggesting, setIsAISuggesting] = useState(false);

  const handleSetSprintGoal = useCallback(
    (taskId: string) => {
      const task = [...activeTasks, ...completedTasks].find((t) => t.id === taskId);
      if (task) {
        setSelectedMissionContext(null);
        setGoal(task.title);
        selectTask(taskId);
        commitTask(taskId);
        persistence.updateSessionFocus({
          goalText: task.title,
          metadata: null,
        }).catch(() => {});
      }
    },
    [activeTasks, completedTasks, selectTask, commitTask, persistence]
  );

  const handleAISuggest = useCallback(async () => {
    if (!activeGoalForTask || !goalTasks) return;
    setIsAISuggesting(true);
    try {
      const res = await fetch("/api/goals/suggest-next", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          goalTitle: activeGoalForTask.title,
          tasks: goalTasks.map((t) => ({ title: t.title, status: t.status })),
        }),
      });
      if (!res.ok) throw new Error("AI suggest failed");
      const data = await res.json();
      if (data.suggestedTaskTitle) {
        // Find matching existing task or create new
        const existing = goalTasks.find(
          (t) => t.title === data.suggestedTaskTitle && t.status !== "done"
        );
        if (existing) {
          handleSetSprintGoal(existing.id);
        } else {
          // Create as new task under this goal
          addTask({ title: data.suggestedTaskTitle, goal_id: activeGoalForTask.id });
        }
      }
    } catch (err) {
      console.error("AI suggest failed:", err);
    } finally {
      setIsAISuggesting(false);
    }
  }, [activeGoalForTask, goalTasks, handleSetSprintGoal, addTask]);

  // ─── Join config from modal (sessionStorage) ──────────────
  const joinConfigRef = useRef<JoinConfig | null>(null);
  useEffect(() => {
    joinConfigRef.current = null;
    try {
      const raw = sessionStorage.getItem("fp_join_config");
      if (raw) {
        sessionStorage.removeItem("fp_join_config");
        joinConfigRef.current = normalizeJoinConfig(JSON.parse(raw));
      }
    } catch {}
  }, [partyId]);

  // ─── Hide join modal if session already exists ──────────
  useEffect(() => {
    if (persistence.wasRestored) setShowJoinModal(false);
    if (joinConfigRef.current) setShowJoinModal(false);
  }, [partyId, persistence.wasRestored]);

  const startSprintFromJoinConfig = useCallback(
    async (config: JoinConfig): Promise<boolean> => {
      if (!userId) return false;

      const missionMetadata = getJoinMissionMetadata(config);
      const sec = config.durationSec;
      let session: Awaited<ReturnType<typeof persistence.startSession>> | null = null;

      resolutionHandledRef.current = false;
      setSessionGoalId(null);

      try {
        session = await persistence.startSession({
          user_id: userId,
          party_id: partyId,
          character: characterAccent,
          goal_text: config.missionTitle,
          metadata: missionMetadata,
          planned_duration_sec: sec,
        });

        await persistence.startSprint({
          session_id: session.id,
          sprint_number: 1,
          duration_sec: sec,
        });
      } catch (err) {
        console.error("[EnvironmentPage] failed to start room sprint:", err);
        if (session) {
          const endedAt = new Date().toISOString();
          await updateSession(session.id, {
            status: "abandoned",
            ended_at: endedAt,
          }).catch(() => {});
        }
        persistence.clearSessionState();
        joinConfigRef.current = null;
        resetToJoinSetup();
        showToast({
          type: "error",
          title: "Couldn’t start your sprint",
          message: "Please try joining the room again.",
        });
        return false;
      }

      timer.reset(sec);
      timer.start();
      setPhase("sprint");
      setSprintGoalCardOpen(false);
      setJoiningCountdown(0);

      let sgId: string | null = null;
      if (config.missionTitle) {
        const sg = await persistence.declareGoal({
          user_id: userId,
          body: config.missionTitle,
          metadata: missionMetadata,
        });
        if (sg) {
          sgId = sg.id;
          setSessionGoalId(sg.id);
        }
      }

      const ct = config.commitmentType || "personal";
      setCommitmentType(ct);

      void commitments.createCommitment({
        user_id: userId,
        session_goal_id: sgId,
        session_id: session.id,
        goal_id: null,
        type: ct,
      });

      if (ct !== "personal") {
        logEvent({
          party_id: partyId,
          session_id: session.id,
          user_id: userId,
          event_type: "commitment_declared",
          body: config.missionTitle,
          payload: {
            commitment_type: ct,
            ...(missionMetadata ?? {}),
          },
        }).catch(() => {});
      }

      joinConfigRef.current = null;
      triggerHostSessionStart();
      triggerHostSprintStart();
      return true;
    },
    [
      userId,
      persistence,
      partyId,
      characterAccent,
      timer,
      commitments,
      resetToJoinSetup,
      showToast,
      triggerHostSessionStart,
      triggerHostSprintStart,
    ],
  );

  // ─── Handle join from modal ───────────────────────────────
  const handleJoinFromModal = useCallback((config: JoinConfig) => {
    joinConfigRef.current = config;
    setShowJoinModal(false);
    const missionSelection = getMissionSelectionFromJoinConfig(config);

    // Apply the config directly (same as Priority 2 hydration)
    resolutionHandledRef.current = false;
    setSelectedMissionContext(missionSelection);
    setActiveGoalId(null);
    setSessionGoalId(null);
    selectTask(null);
    setGoal(missionSelection?.missionTitle ?? "");
    setDurationSec(config.durationSec);
    musicAutoPlayRef.current = config.musicAutoPlay ?? false;

    if (config.autoStart && userId) {
      // Enter the joining countdown phase (5→1 in the timer pill)
      setJoiningCountdown(5);
      setPhase("joining");
      setSprintGoalCardOpen(false);
    }
  }, [userId, selectTask]);

  // ─── Joining countdown → sprint transition ─────────────────
  useEffect(() => {
    if (phase !== "joining") return;

    const id = setInterval(() => {
      setJoiningCountdown((c) => {
        if (c <= 1) {
          clearInterval(id);
          return 0;
        }
        return c - 1;
      });
    }, 1000);

    return () => clearInterval(id);
  }, [phase]);

  // When countdown reaches 0, transition to sprint
  useEffect(() => {
    if (phase !== "joining" || joiningCountdown !== 0) return;

    const config = joinConfigRef.current;
    if (!config || !userId) return;

    void startSprintFromJoinConfig(config);
  }, [phase, joiningCountdown, startSprintFromJoinConfig, userId]);

  // ─── Resuming countdown → sprint transition (after break) ──
  // Capture break info in a ref so it's available after clearing breakContent
  const breakInfoRef = useRef({ category: breakCategory, title: breakContent?.title ?? null, videoUrl: breakContent?.video_url ?? null });
  breakInfoRef.current = { category: breakCategory, title: breakContent?.title ?? null, videoUrl: breakContent?.video_url ?? null };

  useEffect(() => {
    if (phase !== "resuming") return;

    const id = setInterval(() => {
      setResumingCountdown((c) => {
        if (c <= 1) {
          clearInterval(id);
          return 0;
        }
        return c - 1;
      });
    }, 1000);

    return () => clearInterval(id);
  }, [phase]);

  // When resuming countdown reaches 0, transition back to sprint
  useEffect(() => {
    if (phase !== "resuming" || resumingCountdown !== 0) return;

    setBreakContent(null);
    timer.start();
    setPhase("sprint");
    persistence.updatePhase("sprint").catch((err) =>
      console.error("Failed to update phase to sprint:", err)
    );

    if (userId && persistence.sessionRow) {
      const info = breakInfoRef.current;
      logEvent({
        party_id: partyId,
        session_id: persistence.sessionRow.id,
        user_id: userId,
        event_type: "break_completed",
        body: displayName,
        payload: {
          category: info.category,
          content_title: info.title,
        },
      }).catch(() => {});

      // Mark curriculum video as completed
      if (info.videoUrl) {
        const ytId = extractYouTubeId(info.videoUrl);
        if (ytId) markCurriculumCompleted(ytId);
      }
    }
  }, [phase, resumingCountdown]); // eslint-disable-line react-hooks/exhaustive-deps

  // Clear task selection on mount (skip if restoring active sprint or join config present)
  const taskClearPartyRef = useRef<string | null>(null);
  useEffect(() => {
    if (persistence.isHydrating) return;
    if (taskClearPartyRef.current === partyId) return;
    taskClearPartyRef.current = partyId;
    const hasJoinConfig = joinConfigRef.current !== null;
    const hasActiveSession = persistence.wasRestored && persistence.sessionRow?.phase === "sprint";
    if (!hasActiveSession && !hasJoinConfig) {
      selectTask(null);
    }
  }, [partyId, persistence.isHydrating, persistence.wasRestored, persistence.sessionRow]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Hydration: restore active session / resume sprint ──
  const hydrationAppliedPartyRef = useRef<string | null>(null);
  useEffect(() => {
    if (persistence.isHydrating) return;
    if (hydrationAppliedPartyRef.current === partyId) return;
    hydrationAppliedPartyRef.current = partyId;

    // Priority 1: Restore active session from DB
    if (persistence.wasRestored && persistence.sessionRow) {
      void (async () => {
        const s = persistence.sessionRow!;
        const sourcePartyId = s.party_id;

        if (userId && sourcePartyId !== partyId) {
          try {
            roomEntrySourcePartyIdRef.current = sourcePartyId;
            await joinParty(partyId, userId, displayName);
            await persistence.reassignSessionParty(partyId);
          } catch (err) {
            console.error("[EnvironmentPage] failed to carry active session into room:", err);
            router.push("/rooms");
            return;
          }
        }

        const restoredMissionSelection = getMissionSelectionFromMetadata(s.metadata);
        setSelectedMissionContext(restoredMissionSelection);
        setGoal(restoredMissionSelection?.missionTitle ?? s.goal_text ?? "");
        setDurationSec(s.planned_duration_sec);

        // Restore task selection if session has a task
        if (s.task_id) {
          selectTask(s.task_id);
          commitTask(s.task_id);
        }

        // Only an active sprint with remaining time is resumable.
        // Break/review/breathing/setup are ephemeral client states that
        // can't be reconstructed after a page reload.
        const hasActiveSprint =
          persistence.currentSprint && !persistence.currentSprint.completed;
        const isSprintOrBreak = s.phase === "sprint" || s.phase === "break";

        if (isSprintOrBreak && hasActiveSprint) {
          const remaining = computeRemainingSeconds(persistence.currentSprint!);
          if (remaining > 0) {
            // Resume into sprint (even if on break — break state is client-only)
            setPhase("sprint");
            timer.reset(remaining);
            timer.start();
            if (s.phase !== "sprint") {
              persistence.updatePhase("sprint").catch(() => {});
            }
          } else {
            // Sprint expired while away — silently end stale session, start fresh
            persistence.endSession("completed").catch(() => {});
            persistence.clearSessionState();
            // Only leave the party if the user isn't actively switching to this room
            if (sourcePartyId && userId && !joinConfigRef.current) {
              leaveParty(sourcePartyId, userId).catch(() => {});
            }
            resetToJoinSetup();
          }
        } else {
          // No active sprint, or non-resumable phase — end stale session, start fresh
          if (s.status === "active") {
            persistence.endSession("abandoned").catch(() => {});
            if (sourcePartyId && userId && !joinConfigRef.current) {
              leaveParty(sourcePartyId, userId).catch(() => {});
            }
          }
          persistence.clearSessionState();
          resetToJoinSetup();
        }
      })();
      return;
    }

    // Priority 2: Apply join config from modal
    const jc = joinConfigRef.current;
    if (jc) {
      joinConfigRef.current = null;
      const missionSelection = getMissionSelectionFromJoinConfig(jc);
      setSelectedMissionContext(missionSelection);
      setActiveGoalId(null);
      setSessionGoalId(null);
      selectTask(null);
      setGoal(missionSelection?.missionTitle ?? "");
      setDurationSec(jc.durationSec);
      musicAutoPlayRef.current = jc.musicAutoPlay ?? false;

      if (jc.autoStart && userId) {
        joinConfigRef.current = jc;
        void startSprintFromJoinConfig(jc);
      }
    }
  }, [partyId, persistence.isHydrating, persistence.wasRestored, persistence.sessionRow]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Room visit tracking ─────────────────────────────────
  const roomEnteredPartyRef = useRef<string | null>(null);
  useEffect(() => {
    if (persistence.isHydrating) return;
    if (!userId || !persistence.sessionRow) return;
    if (roomEnteredPartyRef.current === partyId) return;
    roomEnteredPartyRef.current = partyId;

    logEvent({
      party_id: partyId,
      session_id: persistence.sessionRow.id,
      user_id: userId,
      event_type: "room_entered",
      payload: {
        source_party_id:
          roomEntrySourcePartyIdRef.current ?? persistence.sessionRow.party_id,
      },
    }).catch((err) =>
      console.error("[EnvironmentPage] room_entered log failed:", err)
    );
  }, [persistence.isHydrating, persistence.sessionRow, userId, partyId]);

  // ─── Set default duration from world config ────────────
  // Skip if a join config already provided a user-chosen duration
  const defaultDurationAppliedPartyRef = useRef<string | null>(null);
  useEffect(() => {
    if (!party) return;
    if (defaultDurationAppliedPartyRef.current === partyId) return;
    defaultDurationAppliedPartyRef.current = partyId;
    if (!joinConfigRef.current) {
      setDurationSec(world.defaultSprintLength * 60);
    }
  }, [partyId, party, world.defaultSprintLength]);

  // ─── Sprint lifecycle ──────────────────────────────────

  const handleEndSession = useCallback(() => {
    reviewElapsedRef.current = durationSec - timer.getSnapshot().seconds;
    timer.pause();
    music.pause();
    // Only complete the sprint if it hasn't already been completed by the timer
    if (persistence.currentSprint && !persistence.currentSprint.completed) {
      persistence.completeSprint().catch((err) => console.error("Failed to complete sprint:", err));
    }
    hostTriggersRef.current.triggerSessionCompleted();
    persistence.endSession("completed").catch((err) => console.error("Failed to end session:", err));
    // For persistent rooms, only end the session — don't leave the room or
    // mark it completed so the user can return later without re-joining.
    if (partyId && !party?.persistent && userId) {
      leaveParty(partyId, userId).catch((err) => console.error("Failed to leave party:", err));
      updatePartyStatus(partyId, "completed").catch((err) => console.error("Failed to update party status:", err));
    }
    // Resolve any orphaned commitment
    if (commitments.activeCommitment && !resolutionHandledRef.current) {
      commitments.resolveCommitment("failed").catch(() => {});
    }
    router.push("/rooms");
  }, [durationSec, timer, music, persistence, partyId, userId, party?.persistent, commitments, router]);

  // Intercept Leave button: confirm during sprint, skip otherwise
  const handleLeaveClick = useCallback(() => {
    if (phase === "sprint") {
      setShowLeaveConfirm(true);
    } else {
      handleEndSession();
    }
  }, [phase, handleEndSession]);

  const handleKeepGoing = useCallback(() => {
    setShowLeaveConfirm(false);
  }, []);

  const handleConfirmLeave = useCallback(() => {
    setShowLeaveConfirm(false);
    handleEndSession();
  }, [handleEndSession]);

  const handleAnotherRound = useCallback(async () => {
    if (restartingSprintRef.current) return;
    if (!persistence.sessionRow) return;

    restartingSprintRef.current = true;
    resolutionHandledRef.current = false;
    setSessionGoalId(null);
    const nextNum = (persistence.currentSprint?.sprint_number ?? 0) + 1;

    try {
      await persistence.startSprint({
        session_id: persistence.sessionRow.id,
        sprint_number: nextNum,
        duration_sec: durationSec,
      });

      timer.reset(durationSec);
      timer.start();
      setPhase("sprint");
      triggerHostSprintStart();
      persistence
        .updatePhase("sprint")
        .catch((err) => console.error("Failed to update phase to sprint:", err));
    } catch (err) {
      console.error("Failed to start another sprint:", err);
      showToast({
        type: "error",
        title: "Couldn’t start another round",
        message: "Please try again.",
      });
    } finally {
      restartingSprintRef.current = false;
    }
  }, [durationSec, timer, persistence, showToast, triggerHostSprintStart]);

  const handleDone = useCallback(() => {
    hostTriggersRef.current.triggerSessionCompleted();
    // fire-and-forget: non-critical persistence
    persistence.endSession("completed").catch((err) => console.error("Failed to end session:", err));
    // For persistent rooms, only end the session — don't leave the room
    if (partyId && !party?.persistent && userId) {
      leaveParty(partyId, userId).catch((err) => console.error("Failed to leave party:", err));
      updatePartyStatus(partyId, "completed").catch((err) => console.error("Failed to update party status:", err));
    }
    // Safety net: resolve any orphaned commitment that wasn't handled by handleResolution
    if (commitments.activeCommitment && !resolutionHandledRef.current) {
      commitments.resolveCommitment("failed").catch(() => {});
    }
    router.push("/rooms");
  }, [router, persistence, partyId, userId, party?.persistent, commitments]);

  const handleReflectionComplete = useCallback(
    (reflection: SessionReflection) => {
      persistence
        .submitReflection({
          mood: reflection.mood,
          productivity: reflection.productivity,
          actual_duration_sec: reflection.sessionDurationSec,
        })
        .catch((err) => console.error("Failed to submit reflection:", err));
    },
    [persistence]
  );

  // ─── Sprint resolution handler (sequenced) ─────────────
  const handleResolution = useCallback(
    async (res: SprintResolution) => {
      resolutionHandledRef.current = true;
      try {
        // 1. Complete task first (if applicable) — must happen before cascade
        if (res === "completed" && activeTask) {
          completeTask(activeTask.id);

          // Log task_completed event (fire-and-forget)
          if (userId && persistence.sessionRow) {
            logEvent({
              party_id: partyId,
              session_id: persistence.sessionRow.id,
              user_id: userId,
              event_type: "task_completed",
              body: activeTask.title ?? null,
            }).catch(() => {});
          }
        }

        // 2. Update session goal status
        if (sessionGoalId) {
          const goalStatus =
            res === "completed" ? "completed"
              : res === "partial" ? "partial"
                : res === "abandon" ? "abandoned"
                  : "declared"; // "continue" keeps it active
          if (goalStatus !== "declared") {
            await updateSessionGoalStatus(sessionGoalId, goalStatus);
          }
        }

        // 3. Resolve commitment
        if (commitments.activeCommitment) {
          const commitStatus =
            res === "completed" ? "succeeded" as const
              : res === "abandon" ? "failed" as const
                : null; // partial/continue stay active
          if (commitStatus) {
            await commitments.resolveCommitment(commitStatus);

            // Log commitment event for social/locked (fire-and-forget)
            if (commitmentType !== "personal" && userId && persistence.sessionRow) {
              logEvent({
                party_id: partyId,
                session_id: persistence.sessionRow.id,
                user_id: userId,
                event_type: commitStatus === "succeeded" ? "commitment_succeeded" : "commitment_failed",
                body: goal || undefined,
              }).catch(() => {});
            }
          }
        }

        // 4. Check goal cascade (all tasks done → auto-complete goal)
        if (res === "completed" && activeGoalForTask && goalTasks && userId) {
          // Mark current task as done in the snapshot for cascade check
          const tasksAfterComplete = goalTasks.map((t) =>
            t.id === activeTask?.id ? { ...t, status: "done" as const } : t
          );
          await checkGoalCompletion(
            activeGoalForTask.id,
            activeGoalForTask.title,
            tasksAfterComplete,
            { userId, partyId, sessionId: persistence.sessionRow?.id ?? null }
          );
        }
      } catch (err) {
        console.error("[handleResolution] error:", err);
      }
    },
    [sessionGoalId, activeTask, activeGoalForTask, goalTasks, completeTask, commitments, commitmentType, goal, userId, partyId, persistence.sessionRow?.id]
  );

  // ─── Task completion with goal cascade ─────────────────
  const handleCompleteTask = useCallback(
    async (taskId: string) => {
      completeTask(taskId);

      if (!userId) return;
      const task = [...activeTasks, ...completedTasks].find((t) => t.id === taskId);

      // ── Emit activity event + optimistic celebration ──
      logEvent({
        party_id: partyId,
        session_id: persistence.sessionRow?.id ?? null,
        user_id: userId,
        event_type: "task_completed",
        body: task?.title ?? null,
      }).catch((err) =>
        console.error("[EnvironmentPage] task_completed event failed:", err?.message ?? err?.code ?? JSON.stringify(err))
      );

      setCelebrations((prev) => new Map(prev).set(userId, { color: FOREST_300, text: "Step done!" }));
      setTimeout(() => {
        setCelebrations((prev) => {
          const next = new Map(prev);
          next.delete(userId);
          return next;
        });
      }, 2000);

      // Check goal cascade: if completed task belongs to a goal, see if all siblings are now done
      if (task?.goal_id) {
        const goal = activeGoals.find((g) => g.id === task.goal_id);
        if (goal) {
          const allTasks = [...activeTasks, ...completedTasks].filter(
            (t) => t.goal_id === task.goal_id
          );
          // Mark this task as done in the snapshot
          const updated = allTasks.map((t) =>
            t.id === taskId ? { ...t, status: "done" as const } : t
          );
          checkGoalCompletion(goal.id, goal.title, updated, {
            userId,
            partyId,
            sessionId: persistence.sessionRow?.id ?? null,
          }).catch((err) => console.error("Goal cascade check failed:", err));
        }
      }
    },
    [completeTask, activeTasks, completedTasks, activeGoals, userId, partyId, persistence.sessionRow?.id]
  );

  // ─── Goal completion with celebration ──────────────────
  const handleCompleteGoal = useCallback(
    async (goalId: string) => {
      completeGoal(goalId);

      if (!userId) return;
      const goalRecord = activeGoals.find((g) => g.id === goalId);

      logEvent({
        party_id: partyId,
        session_id: persistence.sessionRow?.id ?? null,
        user_id: userId,
        event_type: "goal_completed",
        body: goalRecord?.title ?? null,
      }).catch((err) =>
        console.error("[EnvironmentPage] goal_completed event failed:", err?.message ?? err?.code ?? JSON.stringify(err))
      );

      setCelebrations((prev) => new Map(prev).set(userId, { color: FOREST_300, text: "Mission complete!" }));
      setTimeout(() => {
        setCelebrations((prev) => {
          const next = new Map(prev);
          next.delete(userId);
          return next;
        });
      }, 2000);
    },
    [completeGoal, activeGoals, userId, partyId, persistence.sessionRow?.id]
  );

  // ─── Timer controls (duration change + reset) ─────────

  const currentDurationMin = Math.round(durationSec / 60);

  const handleChangeDuration = useCallback(
    (minutes: number) => {
      const sec = minutes * 60;
      setDurationSec(sec);
      timer.reset(sec);
      timer.start();
      setSprintGoalCardOpen(false);
    },
    [timer]
  );

  const handleResetTimer = useCallback(() => {
    timer.reset(durationSec);
    timer.start();
    setSprintGoalCardOpen(false);
  }, [timer, durationSec]);

  // ─── Panel toggles ───────────────────────────────────

  const closePanel = useCallback(() => {
    setMissionTransitionOpen(false);
    setActivePanel("none");
  }, []);
  const handleCloseMissionFlyout = useCallback(() => {
    setActivePanel((prev) => (prev === "mission" ? "none" : prev));
  }, []);
  const handleCloseMissionWorkspace = useCallback(() => {
    setMissionTransitionOpen(false);
    setMissionWorkspaceOpen(false);
    setActivePanel((prev) => (prev === "mission" ? "none" : prev));
  }, []);
  const handleToggleMomentum = useCallback(
    () => {
      setMissionTransitionOpen(false);
      setActivePanel((prev) => (prev === "momentum" ? "none" : "momentum"));
    },
    []
  );
  const handleToggleFocusPopover = useCallback(
    () => setFocusPopoverOpen((prev) => !prev),
    []
  );
  const handleCloseFocusPopover = useCallback(
    () => setFocusPopoverOpen(false),
    []
  );
  const handleToggleChat = useCallback(
    () => {
      setMissionTransitionOpen(false);
      setActivePanel((prev) => (prev === "chat" ? "none" : "chat"));
    },
    []
  );
  const handleToggleSettings = useCallback(
    () => {
      setMissionTransitionOpen(false);
      setActivePanel((prev) => (prev === "settings" ? "none" : "settings"));
    },
    []
  );
  const handleToggleMic = useCallback(() => setMicActive((v) => !v), []);
  const handleToggleGoalCard = useCallback(
    () => setSprintGoalCardOpen((v) => !v),
    []
  );
  const handleCloseGoalCard = useCallback(() => setSprintGoalCardOpen(false), []);
  const handleToggleBreakPopover = useCallback(() => {
    setMissionTransitionOpen(false);
    setBreakPopoverOpen((prev) => !prev);
    // Close the flyout if it's open when toggling the popover
    setActivePanel((prev) => (prev === "breaks" ? "none" : prev));
  }, []);

  const handleCloseBreakPopover = useCallback(() => {
    setBreakPopoverOpen(false);
  }, []);

  const handleSelectBreakCategory = useCallback((category: BreakCategory) => {
    setMissionTransitionOpen(false);
    setBreakCategory(category);
    setBreakPopoverOpen(false);
    setActivePanel("breaks");
  }, []);

  // ─── Break flow ────────────────────────────────────────

  const handleSelectBreakContent = useCallback((item: BreakContentItem, duration: BreakDuration, clips: BreakClip[]) => {
    console.log("[break] selected item:", item.title, "| scaffolding:", item.scaffolding ? "YES" : "NO", "| scaffolding_status:", item.scaffolding_status);
    setBreakContent(item);
    setBreakDuration(duration);
    setBreakClips(clips);
    setActivePanel("none");
    timer.pause();
    setPhase("break");
    persistence.updatePhase("break").catch((err) =>
      console.error("Failed to update phase to break:", err)
    );

    setBreakActive(true);

    if (userId && persistence.sessionRow) {
      logEvent({
        party_id: partyId,
        session_id: persistence.sessionRow.id,
        user_id: userId,
        event_type: "break_started",
        body: displayName,
        payload: {
          category: breakCategory,
          content_title: item.title ?? null,
        },
      }).catch(() => {});
    }
  }, [timer, persistence, userId, partyId, displayName, breakCategory]);

  const [breakResetKey, setBreakResetKey] = useState(0);

  const handleChangeBreakDuration = useCallback((minutes: number) => {
    setBreakDuration(minutes as BreakDuration);
  }, []);

  const handleResetBreakTimer = useCallback(() => {
    setBreakResetKey((k) => k + 1);
  }, []);

  const handleBreakVideoFinish = useCallback(() => {
    setBreakActive(false);
    setResumingCountdown(3);
    setPhase("resuming");
  }, []);



  // ─── Join someone else's break ──────────────────────────

  const handleJoinBreak = useCallback(
    async (contentId: string) => {
      try {
        const res = await fetch(`/api/breaks/content?id=${encodeURIComponent(contentId)}`);
        if (!res.ok) return;
        const item = await res.json();
        if (item) {
          setSelectedParticipant(null);
          // Set category from the joined content item
          if (item.category) setBreakCategory(item.category);
          // Use the item's best_duration (or fallback to 5) instead of hardcoding
          const duration: BreakDuration = ([3, 5, 10] as const).includes(item.best_duration)
            ? item.best_duration
            : 5;
          handleSelectBreakContent(item, duration, []);
        }
      } catch {
        // silently fail
      }
    },
    [handleSelectBreakContent]
  );

  // ─── Check-in ───────────────────────────────────────────

  const handleToggleCheckIn = useCallback(() => {
    setCheckInOpen((v) => !v);
  }, []);

  const handleCloseCheckIn = useCallback(() => {
    setCheckInOpen(false);
  }, []);

  const handleCheckIn = useCallback(
    (action: string, message?: string) => {
      if (!userId) return;
      setCheckInOpen(false);

      // ── Optimistic celebration: fire avatar effect immediately ──
      let color = TEAL_500;
      let text = "";
      const taskTitle = activeTask?.title;

      if (action === "progress") {
        color = FOREST_300;
        text = "Making progress";
      } else if (action === "ship") {
        color = GOLD_600;
        text = taskTitle ? `Shipped ${taskTitle}` : "Shipped something";
      } else if (action === "reset") {
        color = GOLD_500;
        text = "Taking a reset";
      } else if (action === "update") {
        color = TEAL_500;
        text = message || "Shared an update";
      }

      setCelebrations((prev) => new Map(prev).set(userId, { color, text }));
      setTimeout(() => {
        setCelebrations((prev) => {
          const next = new Map(prev);
          next.delete(userId);
          return next;
        });
      }, 2000);

      // ── Persist to DB (also broadcasts to other participants via Realtime) ──
      logEvent({
        party_id: partyId,
        session_id: persistence.sessionRow?.id ?? null,
        user_id: userId,
        event_type: "check_in",
        body: displayName,
        payload: {
          action,
          ...(message && { message }),
          ...(action === "ship" && taskTitle && { task_title: taskTitle }),
        },
      }).catch((err) =>
        console.error("[EnvironmentPage] check-in failed:", err?.message ?? err?.code ?? JSON.stringify(err))
      );
    },
    [userId, partyId, persistence.sessionRow?.id, displayName, activeTask?.title]
  );

  // ─── Clear goal when active task is removed mid-sprint ──
  const prevActiveTaskIdRef = useRef<string | null>(activeTask?.id ?? null);
  useEffect(() => {
    const prevId = prevActiveTaskIdRef.current;
    const currId = activeTask?.id ?? null;
    prevActiveTaskIdRef.current = currId;
    // Only clear goal when we had a task and it went away during sprint
    if (prevId && !currId && phase === "sprint" && !selectedMissionContext) {
      setGoal("");
    }
  }, [activeTask?.id, phase, selectedMissionContext]);

  // ─── Task switching ────────────────────────────────────

  const handleStartTask = useCallback(
    (taskId: string) => {
      const nextTask =
        (activeTask?.id === taskId
          ? activeTask
          : [...activeTasks, ...completedTasks].find((task) => task.id === taskId)) ?? null;

      if (!activeTask || activeTask.id === taskId) {
        setSelectedMissionContext(null);
        selectTask(taskId);
        commitTask(taskId);
        persistence.updateSessionFocus({
          goalText: nextTask?.title ?? null,
          metadata: null,
        }).catch(() => {});
      } else {
        setPendingSwitchTaskId(taskId);
      }
    },
    [activeTask, activeTasks, completedTasks, selectTask, commitTask, persistence]
  );

  const handleSwitchConfirm = useCallback(
    (action: "complete" | "switch") => {
      if (action === "complete" && activeTask) {
        handleCompleteTask(activeTask.id);
      }
      if (pendingSwitchTaskId) {
        setSelectedMissionContext(null);
        selectTask(pendingSwitchTaskId);
        commitTask(pendingSwitchTaskId);
        const newTask = [...activeTasks, ...completedTasks].find(
          (t) => t.id === pendingSwitchTaskId
        );
        if (newTask) {
          setGoal(newTask.title);
        }
        persistence.updateSessionFocus({
          goalText: newTask?.title ?? null,
          metadata: null,
        }).catch(() => {});
      }
      setPendingSwitchTaskId(null);
    },
    [
      activeTask,
      handleCompleteTask,
      selectTask,
      pendingSwitchTaskId,
      commitTask,
      activeTasks,
      completedTasks,
      persistence,
    ]
  );

  const handleActivateFocus = useCallback(
    (taskId: string) => {
      if (activeTask?.id === taskId) return;
      if (activeTask) {
        setPendingSwitchTaskId(taskId);
      } else {
        setSelectedMissionContext(null);
        selectTask(taskId);
        commitTask(taskId);
        const task = [...activeTasks, ...completedTasks].find((t) => t.id === taskId);
        if (task) {
          setGoal(task.title);
        }
        persistence.updateSessionFocus({
          goalText: task?.title ?? null,
          metadata: null,
        }).catch(() => {});
      }
    },
    [activeTask, selectTask, commitTask, activeTasks, completedTasks, persistence]
  );

  const handleSwitchComplete = useCallback(() => handleSwitchConfirm("complete"), [handleSwitchConfirm]);
  const handleSwitchSwitch = useCallback(() => handleSwitchConfirm("switch"), [handleSwitchConfirm]);
  const handleSwitchCancel = useCallback(() => setPendingSwitchTaskId(null), []);

  // ─── Focus popover handlers ──────────────────────
  const handleFocusMissionSelection = useCallback(
    (selection: MissionSelectionState | null) => {
      const nextMissionSelection = normalizeMissionSelection(selection);
      setMissionTransitionOpen(false);
      setSelectedMissionContext(nextMissionSelection);
      setActiveGoalId(null);
      selectTask(null);
      setGoal(nextMissionSelection?.missionTitle ?? "");
      persistence.updateSessionFocus({
        goalText: nextMissionSelection?.missionTitle ?? null,
        metadata: getMissionSelectionMetadata(nextMissionSelection),
      }).catch(() => {});
    },
    [selectTask, persistence],
  );

  useEffect(() => {
    if (phase === "sprint" && selectedMissionContext?.missionId) return;

    setMissionTransitionOpen(false);
    setMissionWorkspaceOpen(false);
    setActivePanel((prev) => (prev === "mission" ? "none" : prev));
  }, [phase, selectedMissionContext?.missionId]);

  const handleOpenMissionWorkspace = useCallback(() => {
    if (!selectedMissionContext?.missionId) return;
    if (phase !== "sprint") return;

    setBreakPopoverOpen(false);
    setMissionWorkspaceOpen(true);
    setActivePanel("mission");
  }, [phase, selectedMissionContext?.missionId]);

  const handleCompleteMissionWorkspaceItem = useCallback(
    async (contentId: string, stateData?: Partial<ItemState>) => {
      await completeMissionItem(contentId, stateData);

      if (roomMissionPath?.items[roomMissionCurrentItemIndex + 1]) {
        setMissionTransitionOpen(true);
      }
    },
    [completeMissionItem, roomMissionCurrentItemIndex, roomMissionPath],
  );

  const handleAdvanceMissionWorkspaceItem = useCallback(
    async (index: number) => {
      setMissionTransitionOpen(false);
      await advanceMissionItem(index);
    },
    [advanceMissionItem],
  );

  const handleSelectMissionWorkspaceItem = useCallback(
    (index: number) => {
      void handleAdvanceMissionWorkspaceItem(index);
    },
    [handleAdvanceMissionWorkspaceItem],
  );

  const handlePopoverSelectTask = useCallback(
    (taskId: string, taskTitle: string, _goalId: string | null) => {
      setMissionTransitionOpen(false);
      setSelectedMissionContext(null);
      setActiveGoalId(null);
      handleActivateFocus(taskId);
    },
    [handleActivateFocus],
  );

  const handlePopoverSelectGoal = useCallback(
    (goalId: string, goalTitle: string) => {
      setMissionTransitionOpen(false);
      setSelectedMissionContext(null);
      setActiveGoalId(goalId);
      selectTask(null);
      setGoal(goalTitle);
      persistence.updateSessionFocus({
        goalText: goalTitle,
        metadata: null,
      }).catch(() => {});
    },
    [selectTask, persistence],
  );

  // ─── Participants for display (real + synthetic) ────────
  const participantInfos = useMemo(() => {
    const host: ParticipantInfo = {
      id: "__host__",
      displayName: hostConfig.hostName,
      avatarUrl: hostConfig.avatarUrl,
      isFocusing: true,
      isHost: true,
      participantType: "host",
      hostPersonality: hostConfig.partyKey,
    };
    const real: ParticipantInfo[] = presence.participants.map((p) => ({
      id: p.userId,
      displayName: p.displayName,
      username: p.username ?? null,
      avatarUrl: p.avatarUrl ?? null,
      isFocusing: p.phase === "sprint",
      isHost: false,
      isCurrentUser: p.userId === userId,
      participantType: "real" as const,
      status: p.status,
      goalPreview: p.goalPreview,
      commitmentType: p.commitmentType,
      sprintStartedAt: p.sprintStartedAt,
      sprintDurationSec: p.sprintDurationSec,
      breakContentId: p.breakContentId,
      breakContentTitle: p.breakContentTitle,
      breakContentThumbnail: p.breakContentThumbnail,
    }));
    // ── Deterministic synthetic assignment ──────────────────
    // Each world gets an exclusive subset of synthetics so the same
    // coworker never appears in two rooms when the user switches.
    // Event-derived data (syntheticParticipants) overlays timing
    // when available; otherwise we fall back to client-side math.
    const SYNTHETIC_SPRINT_DURATIONS = [20, 25, 25, 25, 30, 30, 35];
    const SYNTHETIC_BREAK_SEC = 180; // last 3 min of cycle = break
    const now = Date.now();
    const currentWorldKey = world.worldKey;
    const roomSeed = partyId.split("").reduce((sum, ch) => sum + ch.charCodeAt(0), 0);

    // Deterministic baseline: exclusive synthetics for this room
    const roomSynthetics = getSyntheticsForRoom(currentWorldKey, roomSeed);

    // Build a lookup for event-derived timing data
    const eventTimingMap = new Map(
      syntheticParticipants.map((sp) => [sp.id, sp.lastSprintEventAt])
    );

    // Compute effective duration the same way the flyout does
    // (mirrors durationFromLength in useBreakContent.ts).
    function itemEffectiveDuration(item: { best_duration?: number | null; duration_seconds?: number | null }): number {
      if (item.best_duration) return item.best_duration;
      const secs = item.duration_seconds;
      if (!secs) return 5;
      if (secs < 480) return 3;
      if (secs < 720) return 5;
      return 10;
    }

    // Filter shelf to 5-min items only for synthetic assignment.
    // Uses the same duration logic as the flyout so synthetics
    // never show a video the user can't find in their 5-min tab.
    const syntheticShelf = breakShelfItems.filter(
      (item) => itemEffectiveDuration(item) === 5
    );

    const synthetic: ParticipantInfo[] = roomSynthetics.map((sp) => {
      const durIdx = (sp.id.charCodeAt(sp.id.length - 1) + roomSeed) % SYNTHETIC_SPRINT_DURATIONS.length;
      const sprintDur = SYNTHETIC_SPRINT_DURATIONS[durIdx] * 60; // seconds

      // Overlay server timing when available
      const lastSprintEventAt = eventTimingMap.get(sp.id) ?? null;
      let elapsed: number;
      let sprintStart: string;
      if (lastSprintEventAt) {
        const sinceLast = (now - new Date(lastSprintEventAt).getTime()) / 1000;
        // Cycle through sprints so synthetics don't get stuck at max elapsed
        elapsed = sprintDur > 0 ? sinceLast % sprintDur : 0;
        sprintStart = new Date(now - elapsed * 1000).toISOString();
      } else {
        const offsetMs = ((sp.id.charCodeAt(sp.id.length - 2) || 0) * 37_000) + (roomSeed * 17_000);
        elapsed = ((now - offsetMs) / 1000) % sprintDur;
        sprintStart = new Date(now - elapsed * 1000).toISOString();
      }

      const isOnBreak = elapsed >= sprintDur - SYNTHETIC_BREAK_SEC;
      // Hash the FULL id so each synthetic gets a different video.
      // charCodeAt(0) was always "s" (from "syn-*") → identical index for all.
      const idHash = sp.id.split("").reduce((h, c) => h * 31 + c.charCodeAt(0), 0);
      const shelfIdx = Math.abs(idHash + roomSeed) % Math.max(syntheticShelf.length, 1);
      const shelfItem = isOnBreak && syntheticShelf.length > 0 ? syntheticShelf[shelfIdx] : null;

      return {
        id: sp.id,
        displayName: sp.displayName,
        username: sp.handle,
        avatarUrl: sp.avatarUrl,
        isFocusing: !isOnBreak,
        isHost: false,
        participantType: "synthetic" as const,
        status: isOnBreak ? ("on_break" as const) : ("focused" as const),
        archetype: sp.archetype,
        syntheticFlavor: getSyntheticFlavor(sp.archetype, sprintDur > 0 ? elapsed / sprintDur : 0.5, sp.id),
        goalPreview: getSyntheticGoal(sp.archetype, sp.id),
        sprintStartedAt: isOnBreak ? null : sprintStart,
        sprintDurationSec: isOnBreak ? null : sprintDur,
        breakContentId: shelfItem?.id ?? null,
        breakContentTitle: shelfItem?.title ?? (isOnBreak ? getSyntheticBreakTitle(currentWorldKey, sp.id.charCodeAt(0)) : null),
        breakContentThumbnail: shelfItem?.thumbnail_url ?? null,
      };
    });
    return [host, ...real, ...synthetic];
  }, [presence.participants, userId, syntheticParticipants, hostConfig, world.worldKey, breakShelfItems, partyId]);

  // ─── Participant card + high-five ─────────────────────
  const [selectedParticipant, setSelectedParticipant] = useState<{
    participant: ParticipantInfo;
    anchorRect: DOMRect;
  } | null>(null);
  const [highFiveCooldowns, setHighFiveCooldowns] = useState<
    Map<string, number>
  >(new Map());
  const HIGH_FIVE_COOLDOWN_MS = 30_000;
  const previousPartyIdRef = useRef(partyId);

  useEffect(() => {
    if (previousPartyIdRef.current === partyId) return;
    previousPartyIdRef.current = partyId;

    roomEntrySourcePartyIdRef.current = null;
    resolutionHandledRef.current = false;
    restartingSprintRef.current = false;
    feedInitializedRef.current = false;
    lastFeedLengthRef.current = 0;

    setSelectedParticipant(null);
    setShowJoinModal(true);
    setPendingSwitchTaskId(null);
    setShowLeaveConfirm(false);
    setSprintGoalCardOpen(false);
    setJoiningCountdown(0);
    setResumingCountdown(0);
    setCheckInOpen(false);
    setFocusPopoverOpen(false);
    setMissionTransitionOpen(false);
    setFloatingFocusOpen(false);
    setBreakContent(null);
    setBreakActive(false);
    setBreakCategory("learning");
    setBreakPopoverOpen(false);
    setNotesPopoverOpen(false);
    setFloatingNotesOpen(false);
    setActivePanel("none");
    setMissionWorkspaceOpen(false);
    setCelebrations(new Map());
  }, [partyId]);

  const handleParticipantClick = useCallback(
    (participant: ParticipantInfo, rect: DOMRect) => {
      if (selectedParticipant?.participant.id === participant.id) {
        setSelectedParticipant(null);
      } else {
        setSelectedParticipant({ participant, anchorRect: rect });
      }
    },
    [selectedParticipant]
  );

  const handleCloseCard = useCallback(() => {
    setSelectedParticipant(null);
  }, []);

  const handleHighFive = useCallback(
    async (targetId: string, targetName: string) => {
      if (!userId) return;

      // Set cooldown immediately
      setHighFiveCooldowns((prev) => {
        const next = new Map(prev);
        next.set(targetId, Date.now() + HIGH_FIVE_COOLDOWN_MS);
        return next;
      });

      try {
        await logEvent({
          party_id: partyId,
          session_id: persistence.sessionRow?.id ?? null,
          user_id: userId,
          event_type: "high_five",
          body: targetName,
          payload: {
            target_user_id: targetId,
            target_display_name: targetName,
          },
        });
      } catch (err) {
        console.error("[EnvironmentPage] high five failed:", err);
      }

      // ── Synthetic reciprocal high-five ──
      // When a user high-fives a synthetic, it sometimes high-fives back
      const poolEntry = SYNTHETIC_POOL.find((s) => s.id === targetId);
      if (!poolEntry) return; // not a synthetic

      // Archetype-aware probability: gentle 90%, founders 75%, others 65%
      const prob =
        poolEntry.archetype === "gentle"
          ? 0.9
          : poolEntry.archetype === "founder"
            ? 0.75
            : 0.65;
      if (Math.random() > prob) return;

      // Natural delay: 2–5 seconds (feels like a human reacting)
      const delayMs = 2000 + Math.random() * 3000;

      setTimeout(() => {
        // Optimistic celebration on user's avatar
        setCelebrations((prev) =>
          new Map(prev).set(userId, { color: GOLD_600, text: "High five!" })
        );
        setTimeout(() => {
          setCelebrations((prev) => {
            const next = new Map(prev);
            next.delete(userId);
            return next;
          });
        }, 2000);

        // Persist to DB so it appears in momentum feed for all participants
        fetch("/api/synthetics/react", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            party_id: partyId,
            event_type: "high_five",
            body: poolEntry.displayName,
            payload: {
              synthetic_id: poolEntry.id,
              synthetic_handle: poolEntry.handle,
              target_user_id: userId,
              target_display_name: displayName,
            },
          }),
        }).catch(() => {});
      }, delayMs);
    },
    [userId, partyId, persistence.sessionRow?.id, displayName]
  );

  // ─── Render ────────────────────────────────────────────

  if (partyLoading || persistence.isHydrating) {
    return (
      <EnvironmentLoadingShell
        imageUrl={backgroundImageUrl}
        overlay={world.environmentOverlay}
        placeholderGradient={world.placeholderGradient}
      />
    );
  }

  return (
    <div className="relative flex h-full w-full overflow-hidden bg-forest-900">
      {/* Background (always visible) */}
      <EnvironmentBackground
        imageUrl={backgroundImageUrl}
        overlay={world.environmentOverlay}
        placeholderGradient={world.placeholderGradient}
      />

      {/* Hidden YouTube player for music */}
      <div
        data-music-container
        style={{
          position: "fixed",
          bottom: 0,
          right: 0,
          width: 200,
          height: 200,
          clipPath: "inset(100%)",
          overflow: "hidden",
          pointerEvents: "none",
        }}
      >
        <div id={music.playerContainerId} />
      </div>

      {/* Left-side participant strip (always visible — shown behind join modal too) */}
      <EnvironmentParticipants
        participants={participantInfos}
        onParticipantClick={handleParticipantClick}
        onWidthChange={setParticipantStripWidth}
        cameraStream={camera.stream}
        celebrations={celebrations}
      />
      {selectedParticipant && phase !== "setup" && (
        <ParticipantCard
          participant={selectedParticipant.participant}
          feedEvents={feedEvents}
          onHighFive={handleHighFive}
          highFiveCooldownUntil={
            highFiveCooldowns.get(
              selectedParticipant.participant.id
            ) ?? null
          }
          onClose={handleCloseCard}
          anchorRect={selectedParticipant.anchorRect}
          onJoinBreak={handleJoinBreak}
        />
      )}

      {/* Sprint goal — ~25% above dead center */}
      {phase === "sprint" && goal && !selectedMissionContext?.missionId && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center" style={{ paddingBottom: "25vh" }}>
          <SprintGoalBanner
            goalText={goal}
            parentGoalTitle={activeGoalForTask?.title ?? null}
          />
        </div>
      )}

      {/* Main content — full width, flyout overlays on top */}
      <div className="flex w-full flex-col pl-24">
            {/* Room header */}
            <EnvironmentHeader
              roomName={roomDisplayName}
              inviteCode={party?.invite_code ?? null}
              currentPartyId={partyId}
              userId={userId}
              displayName={displayName}
              hasActiveSession={Boolean(persistence.sessionRow)}
            />

            {/* Center content area (spacer + click-away) */}
            <div className="relative flex flex-1 flex-col">
              {/* Click-away to close timer dropdown */}
              {sprintGoalCardOpen && (
                <div
                  className="absolute inset-0 z-10"
                  onClick={handleCloseGoalCard}
                />
              )}
            </div>

            {/* Action bar (identical to existing session) */}
            {(phase === "sprint" || phase === "break" || phase === "joining" || phase === "resuming") && (
              <ActionBar
                micActive={micActive}
                onToggleMic={handleToggleMic}
                cameraActive={camera.isActive}
                onToggleCamera={camera.toggle}
                onOpenChat={handleToggleChat}
                onOpenSettings={handleToggleSettings}
                chatActive={activePanel === "chat"}
                focusPopover={{
                  open: focusPopoverOpen,
                  onToggle: handleToggleFocusPopover,
                  onClose: handleCloseFocusPopover,
                  goalText: goal,
                  onGoalTextChange: setGoal,
                  activeTaskId: activeTask?.id ?? null,
                  activeGoalId,
                  goals: activeGoals,
                  tasks: activeTasks,
                  accentColor: world.accentColor,
                  onSelectTask: handlePopoverSelectTask,
                  onSelectGoal: handlePopoverSelectGoal,
                  onCompleteTask: handleCompleteTask,
                  onDeleteTask: deleteTask,
                  onCompleteGoal: handleCompleteGoal,
                  onDeleteGoal: deleteGoalApi,
                  onAddTask: (title: string, goalId: string | null) => addTask({ title, goal_id: goalId }),
                  onAddGoal: (title: string) => createGoal({ title }),
                  onEditTask: editTask,
                  onEditGoal: (goalId: string, newTitle: string) => updateGoal(goalId, { title: newTitle }),
                  onComplete: () => {
                    if (activeTask) {
                      handleCompleteTask(activeTask.id);
                    } else if (activeGoalId) {
                      handleCompleteGoal(activeGoalId);
                    } else if (goal.trim()) {
                      // Freeform text — fire celebration and clear
                      if (userId) {
                        logEvent({
                          party_id: partyId,
                          session_id: persistence.sessionRow?.id ?? null,
                          user_id: userId,
                          event_type: "task_completed",
                          body: goal,
                        }).catch(() => {});
                        setCelebrations((prev) => new Map(prev).set(userId, { color: FOREST_300, text: "Done!" }));
                        setTimeout(() => {
                          setCelebrations((prev) => { const next = new Map(prev); next.delete(userId!); return next; });
                        }, 2000);
                      }
                      setGoal("");
                    }
                    handleCloseFocusPopover();
                  },
                  focusButtonRef,
                  missionSelection: {
                    selectedMissionId: selectedMissionContext?.missionId ?? null,
                    selectedMissionTitle: selectedMissionContext?.missionTitle ?? null,
                    selectedMissionDomain: selectedMissionContext?.missionDomain ?? null,
                    missionWorkspaceOpen,
                    canOpenMissionWorkspace: phase === "sprint",
                    onOpenMissionWorkspace: handleOpenMissionWorkspace,
                    onSelectMission: handleFocusMissionSelection,
                  },
                }}
                settingsActive={activePanel === "settings"}
                momentumActive={activePanel === "momentum"}
                onOpenMomentum={handleToggleMomentum}
                onEndSession={handleLeaveClick}
                music={{
                  popoverOpen: music.popoverOpen,
                  togglePopover: music.togglePopover,
                  closePopover: music.closePopover,
                  activeVibe: music.activeVibe,
                  selectVibe: music.selectVibe,
                  isPlaying: music.isPlaying,
                  togglePlayPause: music.togglePlayPause,
                  volume: music.volume,
                  setVolume: music.setVolume,
                  status: music.status,
                  roomControlled: true,
                }}
                phase={phase === "break" ? "break" : phase === "joining" ? "joining" : phase === "resuming" ? "resuming" : "sprint"}
                joiningCountdown={joiningCountdown}
                resumingCountdown={resumingCountdown}
                breakDurationMinutes={breakDuration}
                onChangeBreakDuration={handleChangeBreakDuration}
                onResetBreakTimer={handleResetBreakTimer}
                onEndBreak={handleBreakVideoFinish}
                breakResetKey={breakResetKey}
                timer={timer}
                currentDurationMin={currentDurationMin}
                onChangeDuration={handleChangeDuration}
                onResetTimer={handleResetTimer}
                goalCardOpen={sprintGoalCardOpen}
                onToggleGoalCard={handleToggleGoalCard}
                roomStateLabel={roomStateDisplay.label}
                roomStateIcon={roomStateDisplay.icon}
                roomStateColor={roomStateDisplay.color}
                checkInOpen={checkInOpen}
                onToggleCheckIn={handleToggleCheckIn}
                onCloseCheckIn={handleCloseCheckIn}
                onCheckIn={handleCheckIn}
                breaksActive={breakPopoverOpen || activePanel === "breaks"}
                breakPopoverOpen={breakPopoverOpen}
                onToggleBreakPopover={handleToggleBreakPopover}
                onCloseBreakPopover={handleCloseBreakPopover}
                onSelectBreakCategory={handleSelectBreakCategory}
                notesPopover={{
                  open: notesPopoverOpen,
                  onToggle: handleToggleNotesPopover,
                  text: notes.text,
                  setText: notes.setText,
                  isSaving: notes.isSaving,
                  onBlur: notes.onBlur,
                  onExpand: () => {
                    setNotesPopoverOpen(false);
                    setFloatingNotesOpen(true);
                  },
                  onClose: handleCloseNotesPopover,
                  notesButtonRef,
                }}
              />
            )}
      </div>

      {/* Right flyout panel — absolutely positioned overlay */}
      {phase !== "setup" && (
        <div
          className={`absolute right-0 top-0 z-20 h-full ${
            shouldAnimatePanel
              ? "transition-[width] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]"
              : ""
          }`}
          style={{ width: panelOpen ? PANEL_WIDTH : 0, overflow: "hidden" }}
        >
          <aside
            className="flex flex-col rounded-xl border border-white/[0.08]"
            style={{
              width: PANEL_WIDTH - 16,
              height: "calc(100% - 32px)",
              margin: "16px 16px 16px 0",
              background: "color-mix(in srgb, var(--sg-forest-900) 78%, transparent)",
              backdropFilter: "blur(24px)",
              WebkitBackdropFilter: "blur(24px)",
              boxShadow: "var(--shadow-float)",
            }}
            role="complementary"
            aria-label={
              activePanel === "momentum"
                ? "Momentum"
                : activePanel === "chat"
                  ? "Chat"
                  : activePanel === "breaks"
                    ? "Breaks"
                    : activePanel === "mission"
                      ? "Mission map"
                      : "Settings"
            }
          >
            {activePanel === "momentum" && (
              <EnvironmentRail
                activityEvents={feedEvents}
                displayNameMap={feedDisplayNameMap}
                onClose={closePanel}
              />
            )}
            {activePanel === "chat" && (
              <SideDrawer
                onClose={closePanel}
                panel="chat"
                messages={chat.messages}
                onSendMessage={chat.sendMessage}
              />
            )}
            {activePanel === "settings" && (
              <SettingsPanel
                onClose={closePanel}
                settings={settings}
                onUpdateSetting={updateSetting}
              />
            )}
            {activePanel === "breaks" && (
              breakCategory === "learning" && curriculum ? (
                <CurriculumBreakFlyout
                  curriculum={curriculum}
                  currentPosition={currentPosition}
                  roomWorldKey={world.worldKey}
                  onClose={closePanel}
                  onSelectContent={handleSelectBreakContent}
                />
              ) : (
                <BreaksFlyout
                  roomWorldKey={world.worldKey}
                  worldLabel={roomDisplayName}
                  category={breakCategory}
                  onClose={closePanel}
                  onSelectContent={handleSelectBreakContent}
                />
              )
            )}
            {activePanel === "mission" && (
              <>
                <PanelHeader
                  title="Mission Map"
                  onClose={handleCloseMissionFlyout}
                />

                <div className="min-h-0 flex-1">
                  {roomMissionLoading && !roomMissionPath ? (
                    <div className="flex h-full items-center justify-center">
                      <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/30 border-t-transparent" />
                    </div>
                  ) : roomMissionError || !roomMissionPath ? (
                    <div className="flex h-full items-center justify-center px-6 text-center">
                      <p className="text-sm text-white/45">
                        {roomMissionError ?? "Select an active mission to open it in this room."}
                      </p>
                    </div>
                  ) : (
                    <PathSidebar
                      path={roomMissionPath}
                      progress={roomMissionProgress}
                      currentItemIndex={roomMissionCurrentItemIndex}
                      onSelectItem={handleSelectMissionWorkspaceItem}
                      title={null}
                      showSkills={false}
                    />
                  )}
                </div>
              </>
            )}
          </aside>
        </div>
      )}

      {/* Leave confirmation (mid-sprint) */}
      <LeaveConfirmModal
        isOpen={showLeaveConfirm}
        remainingMin={Math.ceil(timer.getSnapshot().seconds / 60)}
        onKeepGoing={handleKeepGoing}
        onEndSession={handleConfirmLeave}
      />

      <SessionReviewModal
        isOpen={phase === "review"}
        sessionDurationSec={durationSec}
        elapsedSec={reviewElapsedRef.current}
        onAnotherRound={handleAnotherRound}
        onDone={handleDone}
        onReflectionComplete={handleReflectionComplete}
        linkedResource={activeLinkedResource}
        sessionId={persistence.sessionRow?.id ?? null}
      />

      {/* Task switch confirmation */}
      <SwitchTaskModal
        isOpen={pendingSwitchTaskId !== null}
        currentTaskText={activeTask?.title ?? ""}
        onComplete={handleSwitchComplete}
        onSwitch={handleSwitchSwitch}
        onCancel={handleSwitchCancel}
      />

      {/* Join room modal — shown on first visit before joining.
          Gated on hydration so it never flashes during session restore. */}
      {showJoinModal &&
        !persistence.isHydrating &&
        (!persistence.wasRestored ||
          (phase === "setup" && !persistence.sessionRow)) && (
        <JoinRoomModal
          partyId={partyId}
          isOpen={showJoinModal}
          onClose={() => setShowJoinModal(false)}
          party={party}
          syntheticParticipants={syntheticParticipants}
          onJoin={handleJoinFromModal}
          backgrounds={modalBackgrounds}
          presence={presence}
        />
      )}

      {missionWorkspaceOpen && phase === "sprint" && (
        <RoomMissionOverlay
          key={selectedMissionContext?.missionId ?? "room-mission"}
          path={roomMissionPath}
          progress={roomMissionProgress}
          achievement={roomMissionAchievement}
          skillReceipt={roomMissionSkillReceipt}
          recommendedPaths={roomMissionRecommendedPaths}
          recommendationsLoading={roomMissionRecommendationsLoading}
          currentItemIndex={roomMissionCurrentItemIndex}
          isLoading={roomMissionLoading}
          error={roomMissionError}
          isCompleted={roomMissionCompleted}
          showTransition={missionTransitionOpen}
          onClose={handleCloseMissionWorkspace}
          onViewProgress={() => router.push("/progress")}
          onCompleteItem={handleCompleteMissionWorkspaceItem}
          onAdvanceToItem={handleAdvanceMissionWorkspaceItem}
          leftInset={participantStripWidth + MISSION_OVERLAY_CENTER_GAP}
          rightInset={panelOpen ? PANEL_WIDTH + MISSION_OVERLAY_CENTER_GAP : MISSION_OVERLAY_CENTER_GAP}
        />
      )}

      {/* Break session flow — video overlay */}
      {breakActive && breakContent && (
        <BreakVideoOverlay
          content={breakContent}
          durationMinutes={breakDuration}
          segment={breakContent.segments?.find((s) => s.duration === breakDuration) ?? null}
          clips={breakClips}
          currentClipIndex={currentBreakClipIndex >= 0 ? currentBreakClipIndex : 0}
          onFinish={handleBreakVideoFinish}
          onChangeClip={handleChangeClip}
          onToggleNotes={handleToggleNotes}
          notesOpen={floatingNotesOpen}
          scaffolding={breakContent.scaffolding ?? null}
        />
      )}

      {/* Floating commitment panel */}
      {floatingFocusOpen && (
        <FloatingFocus
          activeTaskId={activeTask?.id ?? null}
          activeGoalId={activeGoalId}
          goals={activeGoals}
          tasks={activeTasks}
          accentColor={world.accentColor}
          onSelectTask={handlePopoverSelectTask}
          onSelectGoal={handlePopoverSelectGoal}
          onCompleteTask={handleCompleteTask}
          onDeleteTask={deleteTask}
          onCompleteGoal={handleCompleteGoal}
          onDeleteGoal={deleteGoalApi}
          onAddTask={(title, goalId) => addTask({ title, goal_id: goalId })}
          onAddGoal={(title) => createGoal({ title })}
          onEditTask={editTask}
          onEditGoal={(goalId: string, newTitle: string) => updateGoal(goalId, { title: newTitle })}
          onClose={() => setFloatingFocusOpen(false)}
          focusButtonRef={focusButtonRef}
        />
      )}

      {/* Floating notes window */}
      {floatingNotesOpen && sessionId && (
        <FloatingNotes
          text={notes.text}
          setText={notes.setText}
          isSaving={notes.isSaving}
          onBlur={notes.onBlur}
          onClose={() => setFloatingNotesOpen(false)}
          notesButtonRef={notesButtonRef}
        />
      )}

    </div>
  );
}
