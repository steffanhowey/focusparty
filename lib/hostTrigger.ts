import { createClient } from "./supabase/admin";
import { renderActivityEvent } from "./activityEventRender";
import { computeRoomState } from "./roomState";
import type { ActivityEvent, HostGenerationInput, HostTriggerType } from "./types";

interface TriggerInput {
  triggerType: HostTriggerType;
  partyId: string;
  sessionId?: string | null;
  sprintId?: string | null;
  userId?: string | null;
  /** Client-side context passed through to avoid extra DB queries. */
  context?: {
    goalSummary?: string | null;
    participantCount?: number;
    sprintNumber?: number | null;
    sprintDurationSec?: number | null;
    sprintElapsedSec?: number | null;
  };
}

/**
 * Build compact context for the host prompt generator.
 * Queries recent activity and host messages from the DB, merges with client context.
 */
export async function buildHostContext(
  input: TriggerInput,
  partyName: string,
  hostPersonality: string
): Promise<HostGenerationInput> {
  const supabase = createClient();
  const ctx = input.context ?? {};

  // Fetch last 20 activity events for this party (used for both summaries and room state)
  const { data: recentEvents } = await supabase
    .from("fp_activity_events")
    .select("id, party_id, session_id, user_id, event_type, body, actor_type, payload, created_at")
    .eq("party_id", input.partyId)
    .order("created_at", { ascending: false })
    .limit(20);

  const allEvents = (recentEvents ?? []) as ActivityEvent[];

  // Compact summaries for the host prompt (last 5 only)
  const recentActivity = allEvents.slice(0, 5).map((e) => {
    const rendered = renderActivityEvent(e, "Someone");
    return rendered.label;
  });

  // Compute ambient room state from the full event window
  const roomState = computeRoomState(allEvents, ctx.participantCount ?? 1);

  // Fetch last 3 host messages for deduplication
  const { data: hostEvents } = await supabase
    .from("fp_activity_events")
    .select("body")
    .eq("party_id", input.partyId)
    .eq("actor_type", "host")
    .order("created_at", { ascending: false })
    .limit(3);

  const recentHostMessages = (hostEvents ?? [])
    .map((e) => e.body)
    .filter((b): b is string => !!b);

  return {
    partyId: input.partyId,
    partyName,
    hostPersonality,
    triggerType: input.triggerType,
    goalSummary: ctx.goalSummary ?? null,
    recentActivity,
    recentHostMessages,
    participantCount: ctx.participantCount ?? 1,
    sprintNumber: ctx.sprintNumber ?? null,
    sprintDurationSec: ctx.sprintDurationSec ?? null,
    sprintElapsedSec: ctx.sprintElapsedSec ?? null,
    roomState,
  };
}

/**
 * Check whether the host should be rate-limited for this party.
 * Returns true if a cooldown is active (i.e., do NOT post).
 */
export async function isCooldownActive(
  partyId: string,
  cooldownSeconds: number
): Promise<boolean> {
  const supabase = createClient();
  const cutoff = new Date(Date.now() - cooldownSeconds * 1000).toISOString();

  const { data } = await supabase
    .from("fp_activity_events")
    .select("created_at")
    .eq("party_id", partyId)
    .eq("actor_type", "host")
    .gte("created_at", cutoff)
    .order("created_at", { ascending: false })
    .limit(1);

  return (data?.length ?? 0) > 0;
}
