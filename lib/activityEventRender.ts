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
  Coffee,
  GitBranch,
  type LucideIcon,
} from "lucide-react";
import type { ActivityEvent } from "./types";
import { CATEGORY_FEED_LABEL } from "./breakConstants";
import { TONE_SUCCESS, TONE_NEUTRAL } from "./palette";

// ─── Tone System ────────────────────────────────────────────
// Linear-inspired: only two tones.
//   success (green) — completions, wins, shipped items
//   neutral (gray)  — everything else (the icon shape carries meaning)

export type EventTone = "neutral" | "success" | "info" | "warning";

export interface RenderedActivityEvent {
  icon: LucideIcon;
  label: string;
  tone: EventTone;
  color: string;
}

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
  "break_started",
  "break_completed",
  "break_cancelled",
  "integration_linked",
  "integration_writeback",
]);

// ─── Renderer ───────────────────────────────────────────────

/**
 * Unified event rendering logic.
 * Used by both the room activity feed and the personal progress feed
 * to ensure consistent language and iconography.
 *
 * Color philosophy: green = win/completion, neutral gray = everything else.
 * The icon shape communicates the event type; color only signals achievement.
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
        tone: "neutral",
        color: TONE_NEUTRAL,
      };

    case "session_completed":
      return {
        icon: Trophy,
        label: `${name} wrapped a focus session`,
        tone: "success",
        color: TONE_SUCCESS,
      };

    case "sprint_started": {
      const sprintNum = event.payload?.sprint_number;
      const suffix = sprintNum ? ` #${sprintNum}` : "";
      return {
        icon: Zap,
        label: `${name} started sprint${suffix}`,
        tone: "neutral",
        color: TONE_NEUTRAL,
      };
    }

    case "sprint_completed": {
      const sprintN = event.payload?.sprint_number;
      return {
        icon: Zap,
        label: sprintN ? `${name} completed sprint #${sprintN}` : `${name} completed a sprint`,
        tone: "success",
        color: TONE_SUCCESS,
      };
    }

    case "goal_declared": {
      const goalText = event.body;
      const label = goalText
        ? `${name} declared: ${goalText.length > 50 ? goalText.slice(0, 47) + "..." : goalText}`
        : `${name} declared a goal`;
      return {
        icon: Target,
        label,
        tone: "neutral",
        color: TONE_NEUTRAL,
      };
    }

    case "goal_completed":
      return {
        icon: CheckCircle2,
        label: `${name} completed a goal`,
        tone: "success",
        color: TONE_SUCCESS,
      };

    case "task_completed": {
      const taskTitle = event.body;
      return {
        icon: CheckCircle2,
        label: taskTitle
          ? `${name} finished: ${taskTitle.length > 35 ? taskTitle.slice(0, 32) + "..." : taskTitle}`
          : `${name} finished a task`,
        tone: "success",
        color: TONE_SUCCESS,
      };
    }

    case "reflection_submitted":
      return {
        icon: MessageSquare,
        label: `${name} submitted a reflection`,
        tone: "neutral",
        color: TONE_NEUTRAL,
      };

    case "participant_joined":
      return {
        icon: UserPlus,
        label: `${name} joined the room`,
        tone: "neutral",
        color: TONE_NEUTRAL,
      };

    case "participant_left":
      return {
        icon: UserMinus,
        label: `${name} left the room`,
        tone: "neutral",
        color: TONE_NEUTRAL,
      };

    case "host_prompt": {
      const hostName = (event.payload?.hostName as string) || "Host";
      const hostBody = event.body || "";
      return {
        icon: Sparkles,
        label: `${hostName}: ${hostBody}`,
        tone: "neutral",
        color: TONE_NEUTRAL,
      };
    }

    case "high_five": {
      const targetName =
        (event.payload?.target_display_name as string) || "someone";
      return {
        icon: Hand,
        label: `${name} high-fived ${targetName}`,
        tone: "neutral",
        color: TONE_NEUTRAL,
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
            tone: "neutral",
            color: TONE_NEUTRAL,
          };
        case "ship":
          return {
            icon: Rocket,
            label: taskTitle
              ? `${name} shipped ${taskTitle.length > 30 ? taskTitle.slice(0, 27) + "..." : taskTitle}`
              : `${name} shipped something`,
            tone: "success",
            color: TONE_SUCCESS,
          };
        case "reset":
          return {
            icon: RotateCcw,
            label: `${name} is resetting`,
            tone: "neutral",
            color: TONE_NEUTRAL,
          };
        case "update":
          return {
            icon: MessageSquare,
            label: message
              ? `${name}: "${message.length > 40 ? message.slice(0, 37) + "..." : message}"`
              : `${name} shared an update`,
            tone: "neutral",
            color: TONE_NEUTRAL,
          };
        default:
          return {
            icon: Zap,
            label: `${name} checked in`,
            tone: "neutral",
            color: TONE_NEUTRAL,
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
        tone: "neutral",
        color: TONE_NEUTRAL,
      };
    }

    case "commitment_succeeded":
      return {
        icon: Trophy,
        label: `${name} delivered on their commitment`,
        tone: "success",
        color: TONE_SUCCESS,
      };

    case "commitment_failed":
      return {
        icon: XCircle,
        label: `${name} switched focus`,
        tone: "neutral",
        color: TONE_NEUTRAL,
      };

    case "goal_shipped": {
      const goalTitle = event.payload?.goal_title as string | undefined;
      return {
        icon: Rocket,
        label: goalTitle
          ? `${name} shipped: ${goalTitle.length > 30 ? goalTitle.slice(0, 27) + "..." : goalTitle}`
          : `${name} shipped a goal`,
        tone: "success",
        color: TONE_SUCCESS,
      };
    }

    case "break_started": {
      const contentTitle = event.payload?.content_title as string | undefined;
      const categoryLabel = CATEGORY_FEED_LABEL[event.payload?.category as string] ?? "learning";
      return {
        icon: Coffee,
        label: contentTitle
          ? `${name} took a ${categoryLabel} break: ${contentTitle.length > 30 ? contentTitle.slice(0, 27) + "..." : contentTitle}`
          : `${name} took a ${categoryLabel} break`,
        tone: "neutral",
        color: TONE_NEUTRAL,
      };
    }

    case "break_completed":
      return {
        icon: Play,
        label: `${name} returned to sprint`,
        tone: "neutral",
        color: TONE_NEUTRAL,
      };

    case "break_cancelled":
      return {
        icon: XCircle,
        label: `${name} skipped break`,
        tone: "neutral",
        color: TONE_NEUTRAL,
      };

    case "integration_linked": {
      const provider = event.payload?.provider as string | undefined;
      const resourceTitle = event.payload?.resource_title as string | undefined;
      return {
        icon: GitBranch,
        label: resourceTitle
          ? `${name} linked ${provider ?? "external"} item: ${resourceTitle.length > 30 ? resourceTitle.slice(0, 27) + "..." : resourceTitle}`
          : `${name} linked an external item`,
        tone: "neutral",
        color: TONE_NEUTRAL,
      };
    }

    case "integration_writeback": {
      const wbProvider = event.payload?.provider as string | undefined;
      return {
        icon: GitBranch,
        label: `${name} posted progress to ${wbProvider ?? "external service"}`,
        tone: "neutral",
        color: TONE_NEUTRAL,
      };
    }

    default:
      return {
        icon: CircleDot,
        label: `${name} did something`,
        tone: "neutral",
        color: TONE_NEUTRAL,
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
