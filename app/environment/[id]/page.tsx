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
import { useHostTriggers } from "@/lib/useHostTriggers";
import { useMusic } from "@/lib/useMusic";
import { useChat } from "@/lib/useChat";
import { useTheme } from "@/components/providers/ThemeProvider";
import {
  getParty,
  updatePartyStatus,
  getSyntheticParticipants,
  type Party,
  type SyntheticPresenceInfo,
} from "@/lib/parties";
import { getWorldConfig, getPartyHostPersonality } from "@/lib/worlds";
import { getHostConfig } from "@/lib/hosts";
import { getActiveBackground, type ActiveBackground } from "@/lib/roomBackgrounds";
import { getUserTimeState } from "@/lib/timeOfDay";
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
import { SideDrawer } from "@/components/session/SideDrawer";
import { SettingsPanel } from "@/components/session/SettingsPanel";
import { SessionReviewModal } from "@/components/session/SessionReviewModal";
import { SwitchTaskModal } from "@/components/session/SwitchTaskModal";
import { logEvent } from "@/lib/sessions";
import { computeRemainingSeconds } from "@/lib/sprintTime";
import { SYNTHETIC_POOL } from "@/lib/synthetics/pool";
import { JoinRoomModal, type JoinConfig } from "@/components/party/JoinRoomModal";
import type { SessionPhase, SessionReflection } from "@/lib/types";

type SidePanel = "none" | "momentum" | "tasks" | "chat" | "settings";
type CelebrationInfo = { color: string; text: string };
const PANEL_WIDTH = 380;
const DEFAULT_DURATION_SEC = 25 * 60;

export default function EnvironmentPage() {
  const params = useParams();
  const partyId = params.id as string;
  const router = useRouter();
  const { userId, displayName, username, avatarUrl } = useCurrentUser();
  const { characterAccent } = useTheme();

  // ─── Party lookup ──────────────────────────────────────
  const [party, setParty] = useState<Party | null>(null);
  const [partyLoading, setPartyLoading] = useState(true);

  useEffect(() => {
    if (!partyId) return;
    let cancelled = false;
    getParty(partyId)
      .then((p) => {
        if (!cancelled) setParty(p);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setPartyLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [partyId]);

  // ─── Synthetic participants (poll every 30s) ────────────
  const [syntheticParticipants, setSyntheticParticipants] = useState<
    SyntheticPresenceInfo[]
  >([]);

  useEffect(() => {
    if (!partyId) return;
    let cancelled = false;
    const load = () =>
      getSyntheticParticipants(partyId)
        .then((sp) => {
          if (!cancelled) setSyntheticParticipants(sp);
        })
        .catch(() => {});
    load();
    const id = setInterval(load, 30_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [partyId]);

  // ─── Derived config ────────────────────────────────────
  const world = party ? getWorldConfig(party.world_key) : getWorldConfig("default");
  const hostConfig = party
    ? getHostConfig(getPartyHostPersonality(party))
    : getHostConfig("default");

  // ─── AI background (falls back to placeholder gradient) ───
  // Lock the time state on mount so it never changes mid-session
  const lockedTimeStateRef = useRef(getUserTimeState());
  const [aiBackground, setAiBackground] = useState<ActiveBackground | null>(null);
  useEffect(() => {
    const wk = party?.world_key;
    if (!wk) return;
    getActiveBackground(wk, lockedTimeStateRef.current).then(setAiBackground).catch(() => {});
  }, [party?.world_key]);
  const backgroundImageUrl = aiBackground?.publicUrl ?? null;
  const modalBackgrounds = useMemo(() => {
    if (!aiBackground || !party?.world_key) return undefined;
    return new Map([[party.world_key, aiBackground]]);
  }, [aiBackground, party?.world_key]);

  // ─── Session state machine ────────────────────────────
  const persistence = useSessionPersistence(userId);
  const [phase, setPhase] = useState<SessionPhase>("setup");
  const [showJoinModal, setShowJoinModal] = useState(true);
  const [goal, setGoal] = useState("");
  const [durationSec, setDurationSec] = useState(DEFAULT_DURATION_SEC);
  const reviewElapsedRef = useRef(0);
  const [pendingSwitchTaskId, setPendingSwitchTaskId] = useState<string | null>(null);
  const [sprintGoalCardOpen, setSprintGoalCardOpen] = useState(false);
  const [micActive, setMicActive] = useState(false);
  const [checkInOpen, setCheckInOpen] = useState(false);
  const [celebrations, setCelebrations] = useState<Map<string, CelebrationInfo>>(new Map());
  const lastFeedLengthRef = useRef(0);

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
    persistence.completeSprint().catch(() => {});
    persistence.updatePhase("review").catch(() => {});
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
        targetId = (event.payload?.target_user_id as string) ?? null;
        color = "#F59E0B";
        text = "High five!";
      }

      if (targetId) {
        setCelebrations((prev) => new Map(prev).set(targetId!, { color, text }));
        setTimeout(() => {
          setCelebrations((prev) => {
            const next = new Map(prev);
            next.delete(targetId!);
            return next;
          });
        }, 2000);
      }
    }
  }, [feedEvents.length]); // eslint-disable-line react-hooks/exhaustive-deps

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
        .then(() => {
          if (config.goalText) {
            persistence.declareGoal({
              user_id: userId,
              task_id: config.taskId ?? undefined,
              body: config.goalText,
            });
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
  const defaultDurationApplied = useRef(false);
  useEffect(() => {
    if (!party || defaultDurationApplied.current) return;
    defaultDurationApplied.current = true;
    setDurationSec(world.defaultSprintLength * 60);
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
          .then(() => {
            persistence.declareGoal({
              user_id: userId,
              task_id: activeTask?.id ?? undefined,
              body: goalText,
            });
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
    persistence.completeSprint().catch(() => {});
    persistence.updatePhase("review").catch(() => {});
    hostTriggers.triggerReviewEntered();
  }, [durationSec, timer, music, persistence, hostTriggers]);

  const handleAnotherRound = useCallback(() => {
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
        .catch(() => {});
      persistence.updatePhase("sprint").catch(() => {});
    }
  }, [durationSec, timer, persistence, hostTriggers]);

  const handleDone = useCallback(() => {
    hostTriggers.triggerSessionCompleted();
    persistence.endSession("completed").catch(() => {});
    if (partyId && !party?.persistent) {
      updatePartyStatus(partyId, "completed").catch(() => {});
    }
    router.push("/party");
  }, [router, persistence, hostTriggers, partyId, party?.persistent]);

  const handleReflectionComplete = useCallback(
    (reflection: SessionReflection) => {
      persistence
        .submitReflection({
          mood: reflection.mood,
          productivity: reflection.productivity,
          actual_duration_sec: reflection.sessionDurationSec,
        })
        .catch(() => {});
    },
    [persistence]
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

      const taskTitle = activeTask?.title;
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
    }));
    const synthetic: ParticipantInfo[] = syntheticParticipants.map((sp) => {
      const poolEntry = SYNTHETIC_POOL.find((s) => s.id === sp.id);
      return {
        id: sp.id,
        displayName: sp.displayName,
        username: sp.handle,
        avatarUrl: sp.avatarUrl,
        isFocusing: true,
        isHost: false,
        participantType: "synthetic" as const,
        archetype: poolEntry?.archetype,
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
    },
    [userId, partyId, persistence.sessionRow?.id]
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
            />
          )}
        </>
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

            {/* Spacer so action bar stays at bottom */}
            <div className="relative flex-1">
              {/* Click-away to close timer dropdown */}
              {sprintGoalCardOpen && (
                <div
                  className="absolute inset-0 z-10"
                  onClick={handleCloseGoalCard}
                />
              )}
            </div>

            {/* Action bar (identical to existing session) */}
            {phase === "sprint" && (
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
                onEndSession={handleEndSession}
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
                }}
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
              background: "rgba(13,14,32,0.65)",
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
                onCompleteTask={completeTask}
                onUncompleteTask={uncompleteTask}
                onAddTask={addTask}
                onDeleteTask={deleteTask}
                onEditTask={editTask}
                onReorderTasks={reorderTasks}
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
          </aside>
        </div>
      )}

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
    </div>
  );
}
