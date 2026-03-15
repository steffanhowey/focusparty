/**
 * Onboarding analytics events.
 *
 * Lightweight fire-and-forget tracking. Events are sent to the server
 * via the /api/events endpoint. Falls back silently on failure.
 */

interface OnboardingEvent {
  event: string;
  properties: Record<string, unknown>;
}

/** Fire an analytics event. Non-blocking, never throws. */
function track(event: string, properties: Record<string, unknown> = {}): void {
  const payload: OnboardingEvent = {
    event,
    properties: {
      ...properties,
      timestamp: new Date().toISOString(),
    },
  };

  // Log in development for debugging
  if (process.env.NODE_ENV === "development") {
    console.log("[track]", payload.event, payload.properties);
  }

  // Fire-and-forget to server (when endpoint exists)
  fetch("/api/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).catch(() => {
    // Silently fail — analytics should never break the product
  });
}

// ─── Onboarding Wizard Events ────────────────────────────────

/** User viewed a wizard step. */
export function trackStepViewed(step: number, extra?: Record<string, unknown>): void {
  track("onboarding_step_viewed", { step, ...extra });
}

/** User completed a wizard step. */
export function trackStepCompleted(
  step: number,
  selection: string,
  durationMs: number,
  extra?: Record<string, unknown>
): void {
  track("onboarding_step_completed", { step, selection, duration_ms: durationMs, ...extra });
}

/** User selected a professional function. */
export function trackFunctionSelected(
  primary: string,
  secondaries: string[]
): void {
  track("onboarding_function_selected", { primary, secondaries });
}

/** User selected a fluency level. */
export function trackFluencySelected(level: string, usedNotSure: boolean): void {
  track("onboarding_fluency_selected", { level, used_not_sure: usedNotSure });
}

/** A path was recommended to the user. */
export function trackPathRecommended(
  pathId: string,
  pathTitle: string,
  position: "hero" | "also"
): void {
  track("onboarding_path_recommended", { path_id: pathId, path_title: pathTitle, position });
}

/** User accepted a recommended path. */
export function trackPathAccepted(pathId: string, wasHero: boolean): void {
  track("onboarding_path_accepted", { path_id: pathId, was_hero: wasHero });
}

/** User completed the full onboarding wizard. */
export function trackOnboardingCompleted(totalDurationMs: number, stepsCompleted: number): void {
  track("onboarding_completed", { total_duration_ms: totalDurationMs, steps_completed: stepsCompleted });
}

// ─── Post-Onboarding Events ─────────────────────────────────

/** User completed their first hands-on mission. */
export function trackFirstMissionCompleted(pathId: string, minutesSinceOnboard: number): void {
  track("first_mission_completed", { path_id: pathId, minutes_since_onboard: minutesSinceOnboard });
}

/** Room bridge prompt was shown to the user. */
export function trackRoomBridgeShown(roomId: string, daysSinceOnboard: number): void {
  track("room_bridge_shown", { room_id: roomId, days_since_onboard: daysSinceOnboard });
}

/** User accepted the room bridge prompt. */
export function trackRoomBridgeAccepted(roomId: string): void {
  track("room_bridge_accepted", { room_id: roomId });
}

/** User dismissed the room bridge prompt. */
export function trackRoomBridgeDismissed(dismissalCount: number): void {
  track("room_bridge_dismissed", { dismissal_count: dismissalCount });
}
