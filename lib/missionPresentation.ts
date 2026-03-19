import type {
  ItemState,
  LearningPath,
  LearningProgress,
  MissionBriefing,
  PathItem,
} from "@/lib/types";

export type MissionUiState = "ready" | "saved" | "active" | "completed";

function getItemKey(item: PathItem, index: number): string {
  return item.item_id ?? item.content_id ?? `idx-${index}`;
}

function formatTopicLabel(topic: string): string {
  return topic
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Returns the user's current item in a mission, falling back to the first item.
 */
export function getMissionCurrentItem(
  path: LearningPath,
  progress?: LearningProgress | null,
): PathItem | null {
  if (path.items.length === 0) return null;
  const currentIndex = progress?.current_item_index ?? 0;
  return path.items[currentIndex] ?? path.items[0] ?? null;
}

/**
 * Returns the primary work item for a mission, preferring the next incomplete
 * do step and falling back to the first available mission item.
 */
export function getMissionWorkItem(
  path: LearningPath,
  itemStates?: Record<string, ItemState> | null,
): PathItem | null {
  const nextOpenMission = path.items.find((item, index) => {
    if (item.task_type !== "do" || !item.mission) return false;
    return !(itemStates?.[getItemKey(item, index)]?.completed ?? false);
  });

  const firstMission =
    path.items.find((item) => item.task_type === "do" && item.mission) ?? null;

  return nextOpenMission ?? firstMission ?? path.items[0] ?? null;
}

/**
 * Returns the most relevant mission briefing for a path.
 */
export function getMissionBriefing(
  path: LearningPath,
  progress?: LearningProgress | null,
): MissionBriefing | null {
  const workItem = getMissionWorkItem(path, progress?.item_states);
  return workItem?.mission ?? null;
}

/**
 * Returns the most relevant skill or topic labels to show on mission surfaces.
 */
export function getMissionPrimaryArea(
  path: LearningPath,
): { label: string; detail: string | null } {
  const primarySkill =
    path.skill_tags?.find((tag) => tag.relevance === "primary") ??
    path.skill_tags?.[0] ??
    null;

  if (primarySkill) {
    return {
      label: primarySkill.skill_name,
      detail: primarySkill.domain_name,
    };
  }

  return {
    label: path.topics[0] ? formatTopicLabel(path.topics[0]) : "AI Mission",
    detail: null,
  };
}

/**
 * Formats a duration into a compact effort label for mission surfaces.
 */
export function formatMissionDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `~${Math.max(minutes, 1)}m`;

  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder > 0 ? `~${hours}h ${remainder}m` : `~${hours}h`;
}

/**
 * Returns a compact summary of effort and rep count for a mission.
 */
export function getMissionRepSummary(path: LearningPath): string {
  const repCount = path.items.filter((item) => item.task_type === "do").length;
  const effort = formatMissionDuration(path.estimated_duration_seconds);

  if (repCount === 0) return effort;
  if (repCount === 1) return `${effort} · 1 work rep`;
  return `${effort} · ${repCount} work reps`;
}

/**
 * Returns the mission state for UI surfaces based on progress and saved state.
 */
export function getMissionUiState(
  progress?: LearningProgress | null,
  isSaved = false,
): MissionUiState {
  if (progress?.status === "completed") return "completed";
  if (progress?.status === "in_progress" || (progress?.items_completed ?? 0) > 0) {
    return "active";
  }
  if (isSaved) return "saved";
  return "ready";
}

/**
 * Returns a short state label for mission badges.
 */
export function getMissionStateLabel(
  progress?: LearningProgress | null,
  isSaved = false,
): string {
  const state = getMissionUiState(progress, isSaved);

  switch (state) {
    case "completed":
      return "Completed";
    case "active":
      return "Active";
    case "saved":
      return "Saved";
    case "ready":
    default:
      return "Ready";
  }
}

/**
 * Returns a compact progress summary for active missions.
 */
export function getMissionProgressSummary(
  progress?: LearningProgress | null,
): string {
  if (!progress) return "Ready to start";

  if (progress.status === "completed") {
    return `${progress.items_total}/${progress.items_total} complete`;
  }

  return `${progress.items_completed}/${progress.items_total} complete`;
}

/**
 * Returns a work-oriented framing line for the mission.
 */
export function getMissionFraming(
  path: LearningPath,
  progress?: LearningProgress | null,
): string {
  const mission = getMissionBriefing(path, progress);
  const currentItem = getMissionCurrentItem(path, progress);

  return (
    mission?.objective ??
    path.goal ??
    currentItem?.title ??
    path.description ??
    "A structured mission built around practical work."
  );
}

/**
 * Returns the scenario or context line for the mission.
 */
export function getMissionContext(
  path: LearningPath,
  progress?: LearningProgress | null,
): string {
  const mission = getMissionBriefing(path, progress);

  return (
    mission?.context ??
    path.description ??
    path.goal ??
    "A practical rep designed to turn AI understanding into output."
  );
}

/**
 * Returns the expected output summary for the mission.
 */
export function getMissionExpectedOutput(
  path: LearningPath,
  progress?: LearningProgress | null,
): string {
  const mission = getMissionBriefing(path, progress);

  if (!mission) return "A finished step you can carry into your next rep.";
  if (mission.success_criteria[0]) return mission.success_criteria[0];

  if (mission.submission_type === "screenshot") {
    return "A tangible result you can capture or describe.";
  }

  if (mission.submission_type === "either") {
    return "A clear output you can paste back or capture.";
  }

  return "A written output that shows what you made.";
}

/**
 * Returns the next step in clear mission language.
 */
export function getMissionNextAction(
  path: LearningPath,
  progress?: LearningProgress | null,
): string {
  if (progress?.status === "completed") {
    return "Review your outcome and decide what to work on next.";
  }

  const currentItem = getMissionCurrentItem(path, progress);
  if (!currentItem) return "Start the first step.";

  if (currentItem.task_type === "do" && currentItem.mission) {
    return currentItem.mission.objective;
  }

  if (currentItem.task_type === "watch") {
    return `Watch ${currentItem.title} to set up the rep.`;
  }

  if (currentItem.task_type === "check") {
    return `Check your work in ${currentItem.title}.`;
  }

  if (currentItem.task_type === "reflect") {
    return `Capture the takeaway in ${currentItem.title}.`;
  }

  return currentItem.title;
}

/**
 * Returns a short list of checkpoints for the current mission.
 */
export function getMissionCheckpoints(
  path: LearningPath,
  progress?: LearningProgress | null,
): string[] {
  const mission = getMissionBriefing(path, progress);

  if (mission?.steps.length) return mission.steps;

  if (path.modules?.length) {
    return path.modules.map((module) => module.title);
  }

  return path.items.slice(0, 4).map((item) => item.title);
}

/**
 * Returns a short preview of what good completion looks like.
 */
export function getMissionSuccessPreview(
  path: LearningPath,
  progress?: LearningProgress | null,
): string[] {
  const mission = getMissionBriefing(path, progress);

  if (mission?.success_criteria.length) {
    return mission.success_criteria;
  }

  return [getMissionExpectedOutput(path, progress)];
}

/**
 * Returns a mission-to-room hint without assuming a specific room.
 */
export function getMissionRoomHint(
  progress?: LearningProgress | null,
): string {
  if (progress && progress.status === "in_progress") {
    return "Bring this into a room for a live sprint when you want shared momentum.";
  }

  return "Works well in a room when you want structure plus other people in motion.";
}

/**
 * Returns a compact mission structure summary for detail and card surfaces.
 */
export function getMissionStructureSummary(path: LearningPath): string {
  const partCount = path.modules?.length ?? path.items.filter((item) => item.task_type === "do").length;
  const partLabel = partCount > 0 ? `${partCount} parts` : null;
  const stepLabel = `${path.items.length} steps`;

  return [partLabel, stepLabel].filter(Boolean).join(" · ");
}
