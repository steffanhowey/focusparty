import { updateGoal } from "./goals";
import { logEvent } from "./sessions";
import type { TaskRecord } from "./types";

/**
 * Check if all tasks under a goal are done. If so, auto-complete the goal
 * and log a "goal_shipped" activity event.
 *
 * Call this after any task completion — not just during sprint review.
 */
export async function checkGoalCompletion(
  goalId: string,
  goalTitle: string,
  tasks: TaskRecord[],
  opts: {
    userId: string;
    partyId: string;
    sessionId: string | null;
  }
): Promise<boolean> {
  const siblingTasks = tasks.filter((t) => t.goal_id === goalId);
  if (siblingTasks.length === 0) return false;

  const allDone = siblingTasks.every((t) => t.status === "done");
  if (!allDone) return false;

  // Auto-complete the goal
  await updateGoal(goalId, {
    status: "completed",
    completed_at: new Date().toISOString(),
  });

  // Log goal_shipped event
  logEvent({
    party_id: opts.partyId,
    session_id: opts.sessionId,
    user_id: opts.userId,
    event_type: "goal_shipped",
    body: goalTitle,
  }).catch(() => {});

  return true;
}
