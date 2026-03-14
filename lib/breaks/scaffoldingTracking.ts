// ─── Scaffolding Engagement Tracking ────────────────────────
// Fire-and-forget client-side tracking for scaffolding interactions.
// Never blocks UI — all errors are silently swallowed.

export type ScaffoldingEventType =
  | "pre_watch_shown"
  | "pre_watch_attempted"
  | "pre_watch_skipped"
  | "key_moment_clicked"
  | "comprehension_shown"
  | "comprehension_answer_revealed"
  | "comprehension_rewatch"
  | "exercise_shown"
  | "exercise_completed"
  | "exercise_skipped"
  | "discussion_shared"
  | "post_watch_dismissed"
  | "post_watch_auto_dismissed";

/**
 * Track a scaffolding interaction event.
 * Fire-and-forget — never awaited, never blocks UI.
 */
export function trackScaffoldingEvent(
  contentItemId: string,
  eventType: ScaffoldingEventType,
  payload?: Record<string, unknown>
): void {
  fetch("/api/breaks/scaffolding-events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      content_item_id: contentItemId,
      event_type: eventType,
      payload: payload ?? null,
    }),
  }).catch(() => {});
}
