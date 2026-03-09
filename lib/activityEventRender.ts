import {
  Play,
  CheckCircle2,
  Target,
  Trophy,
  MessageSquare,
  UserPlus,
  UserMinus,
  Zap,
  CircleDot,
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
  neutral: "#888995",
};

// ─── Renderer ───────────────────────────────────────────────

/**
 * Unified event rendering logic.
 * Used by both the room activity feed and the personal progress feed
 * to ensure consistent language and iconography.
 */
export function renderActivityEvent(
  event: ActivityEvent,
  actorName?: string
): RenderedActivityEvent {
  const name = actorName || "Someone";

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
