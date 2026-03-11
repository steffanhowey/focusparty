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
import { useGoals } from "@/lib/useGoals";
import { useCommitments } from "@/lib/useCommitments";
import { useHostTriggers } from "@/lib/useHostTriggers";
import { useMusic } from "@/lib/useMusic";
import { useChat } from "@/lib/useChat";
import { useTheme } from "@/components/providers/ThemeProvider";
import { updatePartyStatus, type Party } from "@/lib/parties";
import { useEnvironmentParty } from "@/lib/useEnvironmentParty";
import { computeRoomState, ROOM_STATE_CONFIG } from "@/lib/roomState";
import { EnvironmentBackground } from "@/components/environment/EnvironmentBackground";
import { EnvironmentHeader } from "@/components/environment/EnvironmentHeader";
import {
  EnvironmentParticipants,
  type ParticipantInfo,
} from "@/components/environment/EnvironmentParticipants";
import { ParticipantCard } from "@/components/environment/ParticipantCard";
import { EnvironmentRail } from "@/components/environment/EnvironmentRail";
import { EnvironmentSetup } from "@/components/environment/EnvironmentSetup";
import { ActionBar } from "@/components/session/ActionBar";
import { SprintGoalBanner } from "@/components/session/SprintGoalBanner";
import { SideDrawer } from "@/components/session/SideDrawer";
import { SettingsPanel } from "@/components/session/SettingsPanel";
import { SessionReviewModal } from "@/components/session/SessionReviewModal";
import { LeaveConfirmModal } from "@/components/session/LeaveConfirmModal";
import { SwitchTaskModal } from "@/components/session/SwitchTaskModal";
import { logEvent } from "@/lib/sessions";
import { computeRemainingSeconds } from "@/lib/sprintTime";
import { SYNTHETIC_POOL } from "@/lib/synthetics/pool";
import { JoinRoomModal, type JoinConfig } from "@/components/party/JoinRoomModal";
import type { SessionPhase, SessionReflection, SprintResolution, BreakContentItem, BreakDuration, BreakSegment } from "@/lib/types";
import { updateSessionGoalStatus } from "@/lib/sessions";
import { checkGoalCompletion } from "@/lib/goalCascade";
import { BreaksFlyout } from "@/components/environment/BreaksFlyout";
import { BreakSessionConfirm } from "@/components/environment/BreakSessionConfirm";
import { BreakVideoOverlay } from "@/components/environment/BreakVideoOverlay";
import { BreakReEntryCountdown } from "@/components/environment/BreakReEntryCountdown";
import { useBreakContent, type BreakClip } from "@/lib/useBreakContent";

type SidePanel = "none" | "momentum" | "tasks" | "chat" | "settings" | "breaks";
type CelebrationInfo = { color: string; text: string };
const PANEL_WIDTH = 380;
const DEFAULT_DURATION_SEC = 25 * 60;

export default function EnvironmentPage() {
  const params = useParams();
  const partyId = params.id as string;
  const router = useRouter();
  const { userId, displayName, username, avatarUrl } = useCurrentUser();
  const { characterAccent } = useTheme();

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

  // ─── Session state machine ────────────────────────────
  const persistence = useSessionPersistence(userId);
  const [phase, setPhase] = useState<SessionPhase>("setup");
  const [showJoinModal, setShowJoinModal] = useState(true);
  const [goal, setGoal] = useState("");
  const [durationSec, setDurationSec] = useState(DEFAULT_DURATION_SEC);
  const reviewElapsedRef = useRef(0);
  const [pendingSwitchTaskId, setPendingSwitchTaskId] = useState<string | null>(null);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [sprintGoalCardOpen, setSprintGoalCardOpen] = useState(false);
  const [commitmentType, setCommitmentType] = useState<import("@/lib/types").CommitmentType>("personal");
  const [sessionGoalId, setSessionGoalId] = useState<string | null>(null);
  const resolutionHandledRef = useRef(false);
  const [micActive, setMicActive] = useState(false);
  const [checkInOpen, setCheckInOpen] = useState(false);
  const [celebrations, setCelebrations] = useState<Map<string, CelebrationInfo>>(new Map());
  const lastFeedLengthRef = useRef(0);

  // ─── Break session state ────────────────────────────────
  const [breakContent, setBreakContent] = useState<BreakContentItem | null>(null);
  const [breakDuration, setBreakDuration] = useState<BreakDuration>(5);
  const [showBreakConfirm, setShowBreakConfirm] = useState(false);
  const [breakActive, setBreakActive] = useState(false);
  const [showBreakReEntry, setShowBreakReEntry] = useState(false);

  // Break content clips for channel changer
  const { clips: allBreakClips } = useBreakContent(world.worldKey, "learning");
  const breakClipsForDuration = useMemo(
    () => allBreakClips.filter((c) => c.duration === breakDuration),
    [allBreakClips, breakDuration]
  );
  const currentBreakClipIndex = useMemo(
    () => breakContent ? breakClipsForDuration.findIndex((c) => c.clipId === breakContent.id) : 0,
    [breakClipsForDuration, breakContent]
  );

  const handleChangeClip = useCallback((clip: BreakClip) => {
    setBreakContent(clip.sourceItem);
    setBreakDuration(clip.duration);
  }, []);

  // ─── Side panel state (same pattern as session page) ──
  const [activePanel, setActivePanel] = useState<SidePanel>("none");
  const prevPanelRef = useRef<SidePanel>(activePanel);
  const panelOpen = activePanel !== "none";
  const wasOpen = prevPanelRef.current !== "none";
  const shouldAnimatePanel = panelOpen !== wasOpen;
  useEffect(() => {
    prevPanelRef.current = activePanel;
  }, [activePanel]);

  // ─── Host triggers ref (break circular dep) ──────────
  const hostTriggersRef = useRef<{ triggerReviewEntered: () => void }>({
    triggerReviewEntered: () => {},
  });

  const handleTimerComplete = useCallback(() => {
    reviewElapsedRef.current = durationSec;
    setPhase("review");
    // fire-and-forget: non-critical persistence
    persistence.completeSprint().catch((err) => console.error("Failed to complete sprint:", err));
    persistence.updatePhase("review").catch((err) => console.error("Failed to update phase to review:", err));
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
  });

  // ─── Activity feed + room state ───────────────────────
  const feedDisplayNameMap = useMemo(() => {
    const map = new Map<string, string>();
    presence.participants.forEach((p) => map.set(p.userId, p.displayName));
    return map;
  }, [presence.participants]);

  const { events: feedEvents } = usePartyActivityFeed(partyId, feedDisplayNameMap);
  const roomState = useMemo(
    () => computeRoomState(feedEvents, presence.participants.length),
    [feedEvents, presence.participants.length]
  );
  const roomStateDisplay = ROOM_STATE_CONFIG[roomState];

  // ─── Avatar celebration bursts (check-in + high-five) ──
  useEffect(() => {
    if (feedEvents.length <= lastFeedLengthRef.current) {
      lastFeedLengthRef.current = feedEvents.length;
      return;
    }
    const newEvents = feedEvents.slice(lastFeedLengthRef.current);
    lastFeedLengthRef.current = feedEvents.length;

    for (const event of newEvents) {
      let targetId: string | null = null;
      let color = "#5CC2EC";
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
          color = "#5BC682";
          text = "Making progress";
        } else if (action === "ship") {
          color = "#F59E0B";
          text = taskTitle ? `Shipped ${taskTitle}` : "Shipped something";
        } else if (action === "reset") {
          color = "#F5C54E";
          text = "Taking a reset";
        } else if (action === "update") {
          color = "#5CC2EC";
          text = message || "Shared an update";
        }
      }

      if (event.event_type === "high_five") {
        const hfTarget = (event.payload?.target_user_id as string) ?? null;
        // Skip synthetic return high-fives targeting us — already handled optimistically
        if (event.actor_type === "synthetic" && hfTarget === userId) continue;
        targetId = hfTarget;
        color = "#F59E0B";
        text = "High five!";
      }

      if (event.event_type === "sprint_completed") {
        targetId =
          event.actor_type === "synthetic"
            ? (event.payload?.synthetic_id as string) ?? null
            : event.user_id;
        color = "#5BC682";
        text = "Sprint complete!";
      }

      if (event.event_type === "break_completed") {
        targetId = event.user_id;
        color = "#8C55EF";
        text = "Back to it!";
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
  }, [feedEvents.length]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // ─── Goals (for task drawer context) ─────────────────────
  const { activeGoals } = useGoals();
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

  const [isAISuggesting, setIsAISuggesting] = useState(false);

  const handleSetSprintGoal = useCallback(
    (taskId: string) => {
      const task = [...activeTasks, ...completedTasks].find((t) => t.id === taskId);
      if (task) {
        setGoal(task.title);
        selectTask(taskId);
      }
    },
    [activeTasks, completedTasks, selectTask]
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
    try {
      const raw = sessionStorage.getItem("fp_join_config");
      if (raw) {
        sessionStorage.removeItem("fp_join_config");
        joinConfigRef.current = JSON.parse(raw);
      }
    } catch {}
  }, []);

  // ─── Hide join modal if session already exists ──────────
  useEffect(() => {
    if (persistence.wasRestored) setShowJoinModal(false);
    if (joinConfigRef.current) setShowJoinModal(false);
  }, [persistence.wasRestored]);

  // ─── Handle join from modal ───────────────────────────────
  const handleJoinFromModal = useCallback((config: JoinConfig) => {
    joinConfigRef.current = config;
    setShowJoinModal(false);

    // Apply the config directly (same as Priority 2 hydration)
    if (config.taskId) selectTask(config.taskId);
    setGoal(config.goalText);
    setDurationSec(config.durationSec);
    musicAutoPlayRef.current = config.musicAutoPlay ?? false;

    if (config.autoStart && userId) {
      const sec = config.durationSec;
      timer.reset(sec);
      timer.start();
      setPhase("sprint");
      setSprintGoalCardOpen(false);

      persistence
        .startSession({
          user_id: userId,
          party_id: partyId,
          task_id: config.taskId ?? undefined,
          character: characterAccent,
          goal_text: config.goalText,
          planned_duration_sec: sec,
        })
        .then((session) =>
          persistence.startSprint({
            session_id: session.id,
            sprint_number: 1,
            duration_sec: sec,
          })
        )
        .then(async () => {
          // Auto-create task from freeform text if no task was selected
          let taskId = config.taskId;
          if (!taskId && config.goalText) {
            const createdId = await addTask({ title: config.goalText });
            if (createdId) {
              taskId = createdId;
              selectTask(createdId);
            }
          }

          let sgId: string | null = null;
          if (config.goalText) {
            const sg = await persistence.declareGoal({
              user_id: userId,
              task_id: taskId ?? undefined,
              goal_id: config.goalId ?? undefined,
              body: config.goalText,
            });
            if (sg) {
              sgId = sg.id;
              setSessionGoalId(sg.id);
            }
          }
          const ct = config.commitmentType || "personal";
          setCommitmentType(ct);

          // Create commitment
          commitments.createCommitment({
            user_id: userId,
            session_goal_id: sgId,
            session_id: persistence.sessionRow?.id ?? null,
            goal_id: config.goalId ?? null,
            type: ct,
          });

          // Log commitment event for social/locked
          if (ct !== "personal" && persistence.sessionRow) {
            logEvent({
              party_id: partyId,
              session_id: persistence.sessionRow.id,
              user_id: userId,
              event_type: "commitment_declared",
              body: config.goalText,
              payload: { commitment_type: ct },
            }).catch(() => {});
          }

          hostTriggers.triggerSessionStarted();
          hostTriggers.triggerSprintStarted();
        })
        .catch((err) =>
          console.error("[EnvironmentPage] join from modal failed:", err)
        );
    }
  }, [userId, partyId, characterAccent, timer, persistence, hostTriggers, selectTask]);

  // Clear task selection on mount (skip if restoring active sprint or join config present)
  const taskClearRef = useRef(false);
  useEffect(() => {
    if (taskClearRef.current) return;
    taskClearRef.current = true;
    const hasJoinConfig = joinConfigRef.current !== null;
    const hasActiveSession = persistence.wasRestored && persistence.sessionRow?.phase === "sprint";
    if (!persistence.isHydrating && !hasActiveSession && !hasJoinConfig) {
      selectTask(null);
    }
  }, [persistence.isHydrating, persistence.wasRestored, persistence.sessionRow]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Hydration: restore active session / resume sprint ──
  const hydrationApplied = useRef(false);
  useEffect(() => {
    if (hydrationApplied.current) return;
    if (persistence.isHydrating) return;
    hydrationApplied.current = true;

    // Priority 1: Restore active session from DB
    if (persistence.wasRestored && persistence.sessionRow) {
      const s = persistence.sessionRow;
      setPhase(s.phase);
      setGoal(s.goal_text ?? "");
      setDurationSec(s.planned_duration_sec);

      // Restore task selection if session has a task
      if (s.task_id) selectTask(s.task_id);

      // Resume timer if sprint is still active
      if (s.phase === "sprint" && persistence.currentSprint && !persistence.currentSprint.completed) {
        const remaining = computeRemainingSeconds(persistence.currentSprint);
        if (remaining > 0) {
          timer.reset(remaining);
          timer.start();
        } else {
          // Sprint expired while away — go directly to review
          handleTimerComplete();
        }
      }
      return;
    }

    // Priority 2: Apply join config from modal
    const jc = joinConfigRef.current;
    if (jc) {
      joinConfigRef.current = null;
      if (jc.taskId) selectTask(jc.taskId);
      setGoal(jc.goalText);
      setDurationSec(jc.durationSec);
      musicAutoPlayRef.current = jc.musicAutoPlay ?? false;

      if (jc.autoStart && userId) {
        // Auto-start sprint
        const sec = jc.durationSec;
        timer.reset(sec);
        timer.start();
        setPhase("sprint");
        setSprintGoalCardOpen(false);

        persistence
          .startSession({
            user_id: userId,
            party_id: partyId,
            task_id: jc.taskId ?? undefined,
            character: characterAccent,
            goal_text: jc.goalText,
            planned_duration_sec: sec,
          })
          .then((session) =>
            persistence.startSprint({
              session_id: session.id,
              sprint_number: 1,
              duration_sec: sec,
            })
          )
          .then(() => {
            if (jc.goalText) {
              persistence.declareGoal({
                user_id: userId,
                task_id: jc.taskId ?? undefined,
                body: jc.goalText,
              });
            }
            hostTriggers.triggerSessionStarted();
            hostTriggers.triggerSprintStarted();
          })
          .catch((err) =>
            console.error("[EnvironmentPage] join config auto-start failed:", err)
          );
      }
    }
  }, [persistence.isHydrating, persistence.wasRestored, persistence.sessionRow]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Room visit tracking ─────────────────────────────────
  const roomEnteredRef = useRef(false);
  useEffect(() => {
    if (roomEnteredRef.current) return;
    if (persistence.isHydrating) return;
    if (!userId || !persistence.sessionRow) return;
    roomEnteredRef.current = true;

    logEvent({
      party_id: partyId,
      session_id: persistence.sessionRow.id,
      user_id: userId,
      event_type: "room_entered",
      payload: { source_party_id: persistence.sessionRow.party_id },
    }).catch((err) =>
      console.error("[EnvironmentPage] room_entered log failed:", err)
    );
  }, [persistence.isHydrating, persistence.sessionRow, userId, partyId]);

  // ─── Set default duration from world config ────────────
  // Skip if a join config already provided a user-chosen duration
  const defaultDurationApplied = useRef(false);
  useEffect(() => {
    if (!party || defaultDurationApplied.current) return;
    defaultDurationApplied.current = true;
    if (!joinConfigRef.current) {
      setDurationSec(world.defaultSprintLength * 60);
    }
  }, [party, world.defaultSprintLength]);

  // ─── Sprint lifecycle ──────────────────────────────────

  const handleStartSprint = useCallback(
    (durationMinutes: number, freeformGoal?: string) => {
      const goalText = activeTask?.title || freeformGoal || goal;
      if (!goalText) return;
      setGoal(goalText);
      const sec = durationMinutes * 60;
      setDurationSec(sec);
      timer.reset(sec);
      timer.start();
      setPhase("sprint");
      setSprintGoalCardOpen(false);

      if (userId) {
        persistence
          .startSession({
            user_id: userId,
            party_id: partyId,
            task_id: activeTask?.id ?? undefined,
            character: characterAccent,
            goal_text: goalText,
            planned_duration_sec: sec,
          })
          .then((session) =>
            persistence.startSprint({
              session_id: session.id,
              sprint_number: 1,
              duration_sec: sec,
            })
          )
          .then(async () => {
            const sg = await persistence.declareGoal({
              user_id: userId,
              task_id: activeTask?.id ?? undefined,
              body: goalText,
            });
            if (sg) setSessionGoalId(sg.id);
            hostTriggers.triggerSessionStarted();
            hostTriggers.triggerSprintStarted();
          })
          .catch((err) =>
            console.error("[EnvironmentPage] persist startSprint failed:", err)
          );
      }
    },
    [activeTask, goal, timer, userId, partyId, characterAccent, persistence, hostTriggers]
  );

  const handleEndSession = useCallback(() => {
    reviewElapsedRef.current = durationSec - timer.getSnapshot().seconds;
    timer.pause();
    music.pause();
    setPhase("review");
    // fire-and-forget: non-critical persistence
    persistence.completeSprint().catch((err) => console.error("Failed to complete sprint:", err));
    persistence.updatePhase("review").catch((err) => console.error("Failed to update phase to review:", err));
    hostTriggers.triggerReviewEntered();
  }, [durationSec, timer, music, persistence, hostTriggers]);

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

  const handleAnotherRound = useCallback(() => {
    resolutionHandledRef.current = false;
    timer.reset(durationSec);
    timer.start();
    setPhase("sprint");

    if (persistence.sessionRow) {
      const nextNum = (persistence.currentSprint?.sprint_number ?? 0) + 1;
      persistence
        .startSprint({
          session_id: persistence.sessionRow.id,
          sprint_number: nextNum,
          duration_sec: durationSec,
        })
        .then(() => hostTriggers.triggerSprintStarted())
        .catch((err) => console.error("Failed to start another sprint:", err));
      // fire-and-forget: non-critical persistence
      persistence.updatePhase("sprint").catch((err) => console.error("Failed to update phase to sprint:", err));
    }
  }, [durationSec, timer, persistence, hostTriggers]);

  const handleDone = useCallback(() => {
    hostTriggers.triggerSessionCompleted();
    // fire-and-forget: non-critical persistence
    persistence.endSession("completed").catch((err) => console.error("Failed to end session:", err));
    // fire-and-forget: non-critical persistence
    if (partyId && !party?.persistent) {
      updatePartyStatus(partyId, "completed").catch((err) => console.error("Failed to update party status:", err));
    }
    // Safety net: resolve any orphaned commitment that wasn't handled by handleResolution
    if (commitments.activeCommitment && !resolutionHandledRef.current) {
      commitments.resolveCommitment("failed").catch(() => {});
    }
    router.push("/rooms");
  }, [router, persistence, hostTriggers, partyId, party?.persistent, commitments]);

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

      // Check goal cascade: if completed task belongs to a goal, see if all siblings are now done
      if (!userId) return;
      const task = [...activeTasks, ...completedTasks].find((t) => t.id === taskId);
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

  const closePanel = useCallback(() => setActivePanel("none"), []);
  const handleToggleMomentum = useCallback(
    () => setActivePanel((prev) => (prev === "momentum" ? "none" : "momentum")),
    []
  );
  const handleToggleTasks = useCallback(
    () => setActivePanel((prev) => (prev === "tasks" ? "none" : "tasks")),
    []
  );
  const handleToggleChat = useCallback(
    () => setActivePanel((prev) => (prev === "chat" ? "none" : "chat")),
    []
  );
  const handleToggleSettings = useCallback(
    () => setActivePanel((prev) => (prev === "settings" ? "none" : "settings")),
    []
  );
  const handleToggleMic = useCallback(() => setMicActive((v) => !v), []);
  const handleToggleGoalCard = useCallback(
    () => setSprintGoalCardOpen((v) => !v),
    []
  );
  const handleCloseGoalCard = useCallback(() => setSprintGoalCardOpen(false), []);
  const handleToggleBreaks = useCallback(
    () => setActivePanel((prev) => (prev === "breaks" ? "none" : "breaks")),
    []
  );

  // ─── Break flow ────────────────────────────────────────

  const handleSelectBreakContent = useCallback((item: BreakContentItem, duration: BreakDuration) => {
    setBreakContent(item);
    setBreakDuration(duration);
    setShowBreakConfirm(true);
    setActivePanel("none");
  }, []);

  const handleConfirmBreak = useCallback(() => {
    setShowBreakConfirm(false);
    setBreakActive(true);
    timer.pause();
    setPhase("break");
    persistence.updatePhase("break").catch((err) =>
      console.error("Failed to update phase to break:", err)
    );

    if (userId && persistence.sessionRow) {
      logEvent({
        party_id: partyId,
        session_id: persistence.sessionRow.id,
        user_id: userId,
        event_type: "break_started",
        body: displayName,
        payload: {
          category: "learning",
          content_title: breakContent?.title ?? null,
        },
      }).catch(() => {});
    }
  }, [timer, persistence, userId, partyId, displayName, breakContent]);

  const handleCancelBreakConfirm = useCallback(() => {
    setShowBreakConfirm(false);
    setBreakContent(null);
  }, []);

  const [breakResetKey, setBreakResetKey] = useState(0);

  const handleChangeBreakDuration = useCallback((minutes: number) => {
    setBreakDuration(minutes as BreakDuration);
  }, []);

  const handleResetBreakTimer = useCallback(() => {
    setBreakResetKey((k) => k + 1);
  }, []);

  const handleBreakVideoFinish = useCallback(() => {
    setBreakActive(false);
    setShowBreakReEntry(true);
  }, []);

  const handleResumeFromBreak = useCallback(() => {
    setShowBreakReEntry(false);
    setBreakContent(null);
    timer.start();
    setPhase("sprint");
    persistence.updatePhase("sprint").catch((err) =>
      console.error("Failed to update phase to sprint:", err)
    );

    if (userId && persistence.sessionRow) {
      logEvent({
        party_id: partyId,
        session_id: persistence.sessionRow.id,
        user_id: userId,
        event_type: "break_completed",
        body: displayName,
        payload: {
          category: "learning",
          content_title: breakContent?.title ?? null,
        },
      }).catch(() => {});
    }
  }, [timer, persistence, userId, partyId, displayName, breakContent]);



  // ─── Join someone else's break ──────────────────────────

  const handleJoinBreak = useCallback(
    async (contentId: string) => {
      try {
        const res = await fetch(`/api/breaks/content?id=${encodeURIComponent(contentId)}`);
        if (!res.ok) return;
        const item = await res.json();
        if (item) {
          setBreakContent(item);
          setBreakDuration(5); // default for "Watch too" joins
          setShowBreakConfirm(true);
          setSelectedParticipant(null);
        }
      } catch {
        // silently fail
      }
    },
    []
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
      let color = "#5CC2EC";
      let text = "";
      const taskTitle = activeTask?.title;

      if (action === "progress") {
        color = "#5BC682";
        text = "Making progress";
      } else if (action === "ship") {
        color = "#F59E0B";
        text = taskTitle ? `Shipped ${taskTitle}` : "Shipped something";
      } else if (action === "reset") {
        color = "#F5C54E";
        text = "Taking a reset";
      } else if (action === "update") {
        color = "#5CC2EC";
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

  // ─── Task switching ────────────────────────────────────

  const handleStartTask = useCallback(
    (taskId: string) => {
      if (!activeTask || activeTask.id === taskId) {
        selectTask(taskId);
      } else {
        setPendingSwitchTaskId(taskId);
      }
    },
    [activeTask, selectTask]
  );

  const handleSwitchConfirm = useCallback(
    (action: "complete" | "switch") => {
      if (action === "complete" && activeTask) {
        completeTask(activeTask.id);
      }
      if (pendingSwitchTaskId) {
        selectTask(pendingSwitchTaskId);
      }
      setPendingSwitchTaskId(null);
    },
    [activeTask, completeTask, selectTask, pendingSwitchTaskId]
  );

  // ─── Unique synthetic flavor assignment ──────────────────
  // Sorted index + epoch rotation guarantees zero collisions
  const SYNTHETIC_FLAVOR_POOL = [
    // short + casual
    "fixing a bug",
    "emails",
    "writing",
    "research",
    "reading",
    "outline for tmrw",
    "finally cleaning up this PR",
    "notes",
    // medium + specific
    "rewriting the intro section",
    "debugging auth flow",
    "investor update email",
    "updating the landing page",
    "working through feedback",
    "cleaning up my task list",
    "reviewing pull requests",
    "prepping slides for Friday",
    "sorting out the API layer",
    "editing ch. 3 draft",
    "organizing project notes",
    "user interview followups",
    "migrating to the new SDK",
    // longer + conversational
    "trying to finish this blog post",
    "almost done with the redesign",
    "deep in a refactor rn",
    "catching up on code reviews",
    "mapping out next week's sprint",
    "just need to finish testing",
    "rewriting the onboarding copy",
    "working thru a tricky edge case",
    // with typos (sparse — ~10%)
    "updaing the docs",
    "finsihing up the proposal",
    "reviwing the metrics dashboard",
    "wrting investor updates",
    // minimal / vibe
    "heads down",
    "in the zone",
    "deep work block",
    "flow state",
  ];
  const FLAVOR_ROTATION_MS = 12 * 60 * 1000;

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
    // Assign unique flavors: sorted index + epoch offset → no collisions
    const epoch = Math.floor(Date.now() / FLAVOR_ROTATION_MS);
    const sortedIds = [...syntheticParticipants].sort((a, b) => a.id.localeCompare(b.id)).map((s) => s.id);
    // Derive sprint timing for each synthetic deterministically.
    // Duration varies per synthetic (20-35 min). We compute a "current sprint start"
    // by rolling forward from an anchor time so the timer is always mid-sprint.
    const SYNTHETIC_SPRINT_DURATIONS = [20, 25, 25, 25, 30, 30, 35];
    const SYNTHETIC_BREAK_SEC = 90; // last 90s of cycle = break
    const SYNTHETIC_BREAK_TITLES = [
      "CSS Grid Deep Dive",
      "React Server Components Explained",
      "Building with the AI SDK",
      "Mastering TypeScript Generics",
      "The Art of Code Review",
      "Designing for Accessibility",
      "Postgres Performance Tips",
      "Writing Better Commit Messages",
    ];
    const now = Date.now();
    const synthetic: ParticipantInfo[] = syntheticParticipants.map((sp) => {
      const poolEntry = SYNTHETIC_POOL.find((s) => s.id === sp.id);
      const sortedIndex = sortedIds.indexOf(sp.id);
      const flavorIndex = (sortedIndex + epoch) % SYNTHETIC_FLAVOR_POOL.length;
      // Deterministic sprint duration per synthetic
      const durIdx = sp.id.charCodeAt(sp.id.length - 1) % SYNTHETIC_SPRINT_DURATIONS.length;
      const sprintDur = SYNTHETIC_SPRINT_DURATIONS[durIdx] * 60; // seconds
      // Roll forward: compute where they are in their current sprint cycle
      // Use a per-synthetic offset so they don't all start at the same time
      const offsetMs = (sp.id.charCodeAt(sp.id.length - 2) || 0) * 37_000; // stagger up to ~9 min
      const elapsed = ((now - offsetMs) / 1000) % sprintDur;
      const sprintStart = new Date(now - elapsed * 1000).toISOString();
      // ~10% of synthetics are on break (last 90s of their cycle)
      const isOnBreak = elapsed >= sprintDur - SYNTHETIC_BREAK_SEC;
      const breakTitleIdx = sp.id.charCodeAt(0) % SYNTHETIC_BREAK_TITLES.length;
      return {
        id: sp.id,
        displayName: sp.displayName,
        username: sp.handle,
        avatarUrl: sp.avatarUrl,
        isFocusing: !isOnBreak,
        isHost: false,
        participantType: "synthetic" as const,
        status: isOnBreak ? ("on_break" as const) : ("focused" as const),
        archetype: poolEntry?.archetype,
        syntheticFlavor: SYNTHETIC_FLAVOR_POOL[flavorIndex],
        sprintStartedAt: isOnBreak ? null : sprintStart,
        sprintDurationSec: isOnBreak ? null : sprintDur,
        breakContentTitle: isOnBreak ? SYNTHETIC_BREAK_TITLES[breakTitleIdx] : null,
      };
    });
    return [host, ...real, ...synthetic];
  }, [presence.participants, userId, syntheticParticipants, hostConfig]);

  // ─── Participant card + high-five ─────────────────────
  const [selectedParticipant, setSelectedParticipant] = useState<{
    participant: ParticipantInfo;
    anchorRect: DOMRect;
  } | null>(null);
  const [highFiveCooldowns, setHighFiveCooldowns] = useState<
    Map<string, number>
  >(new Map());
  const HIGH_FIVE_COOLDOWN_MS = 30_000;

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
          new Map(prev).set(userId, { color: "#F59E0B", text: "High five!" })
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
    return <div className="h-full bg-black" />;
  }

  return (
    <div className="relative flex h-full w-full animate-env-fade-in overflow-hidden bg-black">
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

      {/* Left-side participant strip (absolute, always visible during sprint) */}
      {phase !== "setup" && (
        <>
          <EnvironmentParticipants
            participants={participantInfos}
            onParticipantClick={handleParticipantClick}
            cameraStream={camera.stream}
            celebrations={celebrations}
          />
          {selectedParticipant && (
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
        </>
      )}

      {/* Sprint goal — ~25% above dead center */}
      {phase === "sprint" && goal && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center" style={{ paddingBottom: "25vh" }}>
          <SprintGoalBanner
            goalText={goal}
            parentGoalTitle={activeGoalForTask?.title ?? null}
          />
        </div>
      )}

      {/* Main content — full width, flyout overlays on top */}
      <div className="flex w-full flex-col pl-24">
        {phase === "setup" && !showJoinModal ? (
          <EnvironmentSetup
            roomName={party?.name ?? world.label}
            hostName={hostConfig.hostName}
            hostAvatarUrl={hostConfig.avatarUrl}
            accentColor={world.accentColor}
            defaultDuration={world.defaultSprintLength}
            activeTask={activeTask}
            activeTasks={activeTasks}
            initialGoal={!activeTask && goal ? goal : undefined}
            onSelectTask={handleStartTask}
            onAddTask={addTask}
            onStartSprint={handleStartSprint}
          />
        ) : (
          <>
            {/* Room header */}
            <EnvironmentHeader
              roomName={party?.name ?? world.label}
              inviteCode={party?.invite_code ?? null}
              currentPartyId={partyId}
              userId={userId}
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
            {(phase === "sprint" || phase === "break") && (
              <ActionBar
                micActive={micActive}
                onToggleMic={handleToggleMic}
                cameraActive={camera.isActive}
                onToggleCamera={camera.toggle}
                onOpenChat={handleToggleChat}
                onOpenTasks={handleToggleTasks}
                onOpenSettings={handleToggleSettings}
                chatActive={activePanel === "chat"}
                tasksActive={activePanel === "tasks"}
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
                phase={phase === "break" ? "break" : "sprint"}
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
                breaksActive={activePanel === "breaks"}
                onOpenBreaks={handleToggleBreaks}
              />
            )}
          </>
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
            className="flex flex-col rounded-xl border border-[var(--color-border-default)]"
            style={{
              width: PANEL_WIDTH - 16,
              height: "calc(100% - 32px)",
              margin: "16px 16px 16px 0",
              background: "rgba(10,10,10,0.65)",
              backdropFilter: "blur(24px)",
              WebkitBackdropFilter: "blur(24px)",
              boxShadow:
                "0 8px 32px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.06)",
            }}
            role="complementary"
            aria-label={
              activePanel === "momentum"
                ? "Momentum"
                : activePanel === "tasks"
                  ? "Tasks"
                  : activePanel === "chat"
                    ? "Chat"
                    : activePanel === "breaks"
                      ? "Breaks"
                      : "Settings"
            }
          >
            {activePanel === "momentum" && (
              <EnvironmentRail
                activityEvents={feedEvents}
                onClose={closePanel}
              />
            )}
            {(activePanel === "tasks" || activePanel === "chat") && (
              <SideDrawer
                onClose={closePanel}
                panel={activePanel as "tasks" | "chat"}
                activeTasks={activeTasks}
                completedTasks={completedTasks}
                onCompleteTask={handleCompleteTask}
                onUncompleteTask={uncompleteTask}
                onAddTask={addTask}
                onDeleteTask={deleteTask}
                onEditTask={editTask}
                onReorderTasks={reorderTasks}
                activeGoal={activeGoalForTask}
                goalTasks={goalTasks}
                onSetSprintGoal={handleSetSprintGoal}
                onAISuggest={activeGoalForTask ? handleAISuggest : undefined}
                isAISuggesting={isAISuggesting}
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
              <BreaksFlyout
                roomWorldKey={world.worldKey}
                worldLabel={world.label}
                onClose={closePanel}
                onSelectContent={handleSelectBreakContent}
              />
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

      {/* Review modal */}
      <SessionReviewModal
        isOpen={phase === "review"}
        sessionDurationSec={durationSec}
        elapsedSec={reviewElapsedRef.current}
        onAnotherRound={handleAnotherRound}
        onDone={handleDone}
        onReflectionComplete={handleReflectionComplete}
      />

      {/* Task switch confirmation */}
      <SwitchTaskModal
        isOpen={pendingSwitchTaskId !== null}
        currentTaskText={activeTask?.title ?? ""}
        onComplete={() => handleSwitchConfirm("complete")}
        onSwitch={() => handleSwitchConfirm("switch")}
        onCancel={() => setPendingSwitchTaskId(null)}
      />

      {/* Join room modal — shown on first visit before joining */}
      {showJoinModal && (
        <JoinRoomModal
          partyId={partyId}
          isOpen={showJoinModal}
          onClose={() => setShowJoinModal(false)}
          onJoin={handleJoinFromModal}
          backgrounds={modalBackgrounds}
        />
      )}

      {/* Break session flow */}
      {showBreakConfirm && breakContent && (
        <BreakSessionConfirm
          isOpen={showBreakConfirm}
          content={breakContent}
          durationMinutes={breakDuration}
          onConfirm={handleConfirmBreak}
          onCancel={handleCancelBreakConfirm}
        />
      )}

      {breakActive && breakContent && (
        <BreakVideoOverlay
          key={breakContent.id}
          content={breakContent}
          durationMinutes={breakDuration}
          segment={breakContent.segments?.find((s) => s.duration === breakDuration) ?? null}
          clips={breakClipsForDuration}
          currentClipIndex={currentBreakClipIndex >= 0 ? currentBreakClipIndex : 0}
          onFinish={handleBreakVideoFinish}
          onChangeClip={handleChangeClip}
        />
      )}

      <BreakReEntryCountdown
        isOpen={showBreakReEntry}
        onComplete={handleResumeFromBreak}
      />
    </div>
  );
}
