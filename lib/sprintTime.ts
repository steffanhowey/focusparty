/**
 * Compute how many seconds remain in a sprint based on its start time and duration.
 * Returns 0 if the sprint has expired or is already completed.
 */
export function computeRemainingSeconds(sprint: {
  started_at: string;
  duration_sec: number;
  completed: boolean;
  ended_at: string | null;
}): number {
  if (sprint.completed || sprint.ended_at) return 0;
  const elapsedSec = Math.floor(
    (Date.now() - new Date(sprint.started_at).getTime()) / 1000
  );
  return Math.max(0, sprint.duration_sec - elapsedSec);
}
