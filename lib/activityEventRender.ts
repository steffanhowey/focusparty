import {
  Play,
  CheckCircle2,
  Target,
  Trophy,
  MessageSquare,
  UserPlus,
  UserMinus,
  Zap,
  Sparkles,
  CircleDot,
  Hand,
  TrendingUp,
  Rocket,
  RotateCcw,
  Lock,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import type { ActivityEvent } from "./types";

// ─── Tone System ────────────────────────────────────────────

export type EventTone = "neutral" | "success" | "info" | "warning";

export interface RenderedActivityEvent {
  icon: LucideIcon;
  label: string;
  tone: EventTone;
  color: string;
}

// ─── Color Map (aligned with existing theme tokens) ─────────

const TONE_COLORS: Record<EventTone, string> = {
  success: "#5BC682",
  warning: "#F5C54E",
  info: "#5CC2EC",
  neutral: "#888888",
};

// ─── Actor Name Resolution ───────────────────────────────────

/**
 * Event types where `event.body` contains the actor's display name
 * (as opposed to content like a goal or host message).
 */
const ACTOR_IN_BODY_EVENTS = new Set([
  "participant_joined",
  "participant_left",
  "session_started",
  "session_completed",
  "sprint_completed",
  "sprint_started",
  "check_in",
  "commitment_declared",
  "commitment_succeeded",
  "commitment_failed",
]);

// ─── Renderer ───────────────────────────────────────────────

/**
 * Unified event rendering logic.
 * Used by both the room activity feed and the personal progress feed
 * to ensure consistent language and iconography.
 *
 * When no explicit actorName is provided, auto-resolves from event.body
 * for event types where body = actor display name (join, leave, sprint, etc.).
 */
export function renderActivityEvent(
  event: ActivityEvent,
  actorName?: string
): RenderedActivityEvent {
  const name =
    actorName ||
    (ACTOR_IN_BODY_EVENTS.has(event.event_type) && event.body
      ? event.body
      : "Someone");

  switch (event.event_type) {
    case "session_started":
      return {
        icon: Play,
        label: `${name} started a focus session`,
        tone: "warning",
        color: TONE_COLORS.warning,
      };

    case "session_completed":
      return {
        icon: Trophy,
        label: `${name} wrapped a focus session`,
        tone: "success",
        color: TONE_COLORS.success,
      };

    case "sprint_started": {
      const sprintNum = event.payload?.sprint_number;
      const suffix = sprintNum ? ` #${sprintNum}` : "";
      return {
        icon: Zap,
        label: `${name} started sprint${suffix}`,
        tone: "warning",
        color: TONE_COLORS.warning,
      };
    }

    case "sprint_completed":
      return {
        icon: CheckCircle2,
        label: `${name} completed a sprint`,
        tone: "success",
        color: TONE_COLORS.success,
      };

    case "goal_declared": {
      const goalText = event.body;
      const label = goalText
        ? `${name} declared: ${goalText.length > 50 ? goalText.slice(0, 47) + "..." : goalText}`
        : `${name} declared a goal`;
      return {
        icon: Target,
        label,
        tone: "info",
        color: TONE_COLORS.info,
      };
    }

    case "goal_completed":
      return {
        icon: CheckCircle2,
        label: `${name} completed a goal`,
        tone: "success",
        color: TONE_COLORS.success,
      };

    case "task_completed":
      return {
        icon: CheckCircle2,
        label: `${name} finished a task`,
        tone: "success",
        color: TONE_COLORS.success,
      };

    case "reflection_submitted":
      return {
        icon: MessageSquare,
        label: `${name} submitted a reflection`,
        tone: "info",
        color: TONE_COLORS.info,
      };

    case "participant_joined":
      return {
        icon: UserPlus,
        label: `${name} joined the room`,
        tone: "neutral",
        color: TONE_COLORS.neutral,
      };

    case "participant_left":
      return {
        icon: UserMinus,
        label: `${name} left the room`,
        tone: "neutral",
        color: TONE_COLORS.neutral,
      };

    case "host_prompt": {
      const hostName = (event.payload?.hostName as string) || "Host";
      const hostBody = event.body || "";
      return {
        icon: Sparkles,
        label: `${hostName}: ${hostBody}`,
        tone: "info",
        color: "#8C55EF",
      };
    }

    case "high_five": {
      const targetName =
        (event.payload?.target_display_name as string) || "someone";
      return {
        icon: Hand,
        label: `${name} high-fived ${targetName}`,
        tone: "success",
        color: "#F59E0B",
      };
    }

    case "check_in": {
      const action = event.payload?.action as string | undefined;
      const message = event.payload?.message as string | undefined;
      const taskTitle = event.payload?.task_title as string | undefined;

      switch (action) {
        case "progress":
          return {
            icon: TrendingUp,
            label: `${name} is making progress`,
            tone: "success",
            color: TONE_COLORS.success,
          };
        case "ship":
          return {
            icon: Rocket,
            label: taskTitle
              ? `${name} shipped ${taskTitle.length > 30 ? taskTitle.slice(0, 27) + "..." : taskTitle}`
              : `${name} shipped something`,
            tone: "success",
            color: "#F59E0B",
          };
        case "reset":
          return {
            icon: RotateCcw,
            label: `${name} is resetting`,
            tone: "warning",
            color: TONE_COLORS.warning,
          };
        case "update":
          return {
            icon: MessageSquare,
            label: message
              ? `${name}: "${message.length > 40 ? message.slice(0, 37) + "..." : message}"`
              : `${name} shared an update`,
            tone: "info",
            color: TONE_COLORS.info,
          };
        default:
          return {
            icon: Zap,
            label: `${name} checked in`,
            tone: "info",
            color: TONE_COLORS.info,
          };
      }
    }

    case "commitment_declared": {
      const commitType = event.payload?.commitment_type as string | undefined;
      const label =
        commitType === "locked"
          ? `${name} locked in a commitment`
          : commitType === "social"
            ? `${name} made a social commitment`
            : `${name} committed to a sprint`;
      return {
        icon: Lock,
        label,
        tone: "info",
        color: TONE_COLORS.info,
      };
    }

    case "commitment_succeeded":
      return {
        icon: Trophy,
        label: `${name} delivered on their commitment`,
        tone: "success",
        color: "#F59E0B",
      };

    case "commitment_failed":
      return {
        icon: XCircle,
        label: `${name} switched focus`,
        tone: "neutral",
        color: TONE_COLORS.neutral,
      };

    case "goal_shipped": {
      const goalTitle = event.payload?.goal_title as string | undefined;
      return {
        icon: Rocket,
        label: goalTitle
          ? `${name} shipped: ${goalTitle.length > 30 ? goalTitle.slice(0, 27) + "..." : goalTitle}`
          : `${name} shipped a goal`,
        tone: "success",
        color: "#F59E0B",
      };
    }

    default:
      return {
        icon: CircleDot,
        label: `${name} did something`,
        tone: "neutral",
        color: TONE_COLORS.neutral,
      };
  }
}

// ─── Relative Timestamp ─────────────────────────────────────

/** Stable relative time string ("just now", "2m ago", "1h ago", "3d ago"). */
export function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const seconds = Math.floor(diffMs / 1000);

  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
