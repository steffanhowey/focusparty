import { NextResponse } from "next/server";
import { requireAdmin, isAdminError } from "@/lib/admin/requireAdmin";
import { createClient as createAdminClient } from "@/lib/supabase/admin";
import { SYNTHETIC_POOL } from "@/lib/synthetics/pool";

export async function GET() {
  const auth = await requireAdmin();
  if (isAdminError(auth)) return auth;

  const admin = createAdminClient();

  // Get recent synthetic events (last 2 hours) to derive current room membership
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

  const { data: events } = await admin
    .from("fp_activity_events")
    .select("*")
    .eq("actor_type", "synthetic")
    .gte("created_at", twoHoursAgo)
    .order("created_at", { ascending: false });

  // Derive current room for each synthetic
  const syntheticRooms = new Map<string, string>();
  for (const event of events ?? []) {
    const synId = event.payload?.synthetic_id as string;
    if (!synId || syntheticRooms.has(synId)) continue;

    if (event.event_type === "participant_left") {
      // Most recent event is a leave — not in any room
      syntheticRooms.set(synId, "");
    } else {
      syntheticRooms.set(synId, event.party_id ?? "");
    }
  }

  // Get recent event count per synthetic
  const syntheticEventCounts = new Map<string, number>();
  for (const event of events ?? []) {
    const synId = event.payload?.synthetic_id as string;
    if (!synId) continue;
    syntheticEventCounts.set(synId, (syntheticEventCounts.get(synId) ?? 0) + 1);
  }

  const synthetics = SYNTHETIC_POOL.map((s) => ({
    id: s.id,
    handle: s.handle,
    displayName: s.displayName,
    avatarUrl: s.avatarUrl,
    archetype: s.archetype,
    preferredWorldKeys: s.preferredWorldKeys,
    currentRoomId: syntheticRooms.get(s.id) || null,
    recentEventCount: syntheticEventCounts.get(s.id) ?? 0,
  }));

  return NextResponse.json({ synthetics });
}
