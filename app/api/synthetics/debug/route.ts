import { NextResponse } from "next/server";
import {
  getActiveRooms,
  getRecentRoomEvents,
} from "@/lib/synthetics/engine";
import { SYNTHETIC_POOL } from "@/lib/synthetics/pool";
import { computeRoomState } from "@/lib/roomState";

/**
 * GET /api/synthetics/debug
 *
 * Lightweight diagnostic endpoint for auditing synthetic activity.
 * Returns per-room breakdown: synthetic count, real user count,
 * ratio, room state, last synthetic event, and active synthetic names.
 *
 * No auth guard — internal use only (same pattern as tick endpoint).
 */
export async function GET() {
  try {
    const enabled = process.env.SYNTHETICS_ENABLED !== "false";
    const rooms = await getActiveRooms();

    const poolMap = new Map(SYNTHETIC_POOL.map((s) => [s.id, s]));
    const roomReports = [];

    for (const room of rooms) {
      const events = await getRecentRoomEvents(room.id);
      const roomState = computeRoomState(events, 0);

      // Count synthetic vs real events (excluding backdated)
      let syntheticLiveCount = 0;
      let realLiveCount = 0;
      const activeSyntheticIds = new Set<string>();
      let lastSyntheticEvent: { type: string; timestamp: string; name: string } | null = null;

      // Derive synthetic states from events
      const syntheticStates = new Map<string, string>();

      for (const e of events) {
        const isBackdated = (e.payload as Record<string, unknown> | null)?.backdated === true;

        if (e.actor_type === "synthetic") {
          if (!isBackdated) syntheticLiveCount++;

          const synId = (e.payload as Record<string, unknown> | null)?.synthetic_id as string | undefined;
          if (synId) {
            // Track state
            switch (e.event_type) {
              case "participant_joined":
                syntheticStates.set(synId, "joined");
                break;
              case "session_started":
              case "sprint_completed":
              case "check_in":
              case "high_five":
                syntheticStates.set(synId, "in_session");
                break;
              case "session_completed":
                syntheticStates.set(synId, "joined");
                break;
              case "participant_left":
                syntheticStates.set(synId, "absent");
                break;
            }

            // Track last synthetic event
            lastSyntheticEvent = {
              type: e.event_type,
              timestamp: e.created_at,
              name: e.body ?? synId,
            };
          }
        } else {
          if (!isBackdated) realLiveCount++;
        }
      }

      // Gather active synthetic names
      for (const [synId, state] of syntheticStates) {
        if (state === "joined" || state === "in_session") {
          activeSyntheticIds.add(synId);
        }
      }

      const activeSynthetics = Array.from(activeSyntheticIds).map((id) => {
        const entry = poolMap.get(id);
        return {
          id,
          name: entry?.displayName ?? id,
          archetype: entry?.archetype ?? "unknown",
          expressionMode: entry?.expressionMode ?? "unknown",
        };
      });

      const totalLive = syntheticLiveCount + realLiveCount;
      const ratio = totalLive > 0 ? syntheticLiveCount / totalLive : 0;

      roomReports.push({
        roomId: room.id,
        worldKey: room.world_key,
        status: room.status,
        roomState,
        syntheticCount: activeSynthetics.length,
        realUserCount: new Set(
          events
            .filter((e) => e.actor_type !== "synthetic" && e.user_id)
            .map((e) => e.user_id)
        ).size,
        syntheticRatio: Math.round(ratio * 100) + "%",
        totalLiveEvents: totalLive,
        lastSyntheticEvent,
        activeSynthetics,
      });
    }

    return NextResponse.json({
      enabled,
      timestamp: new Date().toISOString(),
      roomCount: rooms.length,
      rooms: roomReports,
    });
  } catch (err) {
    console.error("[synthetics/debug] error:", err);
    return NextResponse.json(
      { error: "Internal error" },
      { status: 500 }
    );
  }
}
