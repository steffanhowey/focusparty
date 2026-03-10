// ─── Room Backgrounds ───────────────────────────────────────
// Client-side queries for active AI-generated room backgrounds.
// Falls back gracefully when no AI background is active.

import { createClient } from "./supabase/client";
import type { TimeOfDayState } from "./timeOfDay";

export interface ActiveBackground {
  id: string;
  publicUrl: string;
  thumbUrl: string;
  worldKey: string;
  timeOfDayState: TimeOfDayState;
  activatedAt: string;
}

/** Derive thumbnail URL from main image URL (convention: -thumb suffix). */
function toThumbUrl(publicUrl: string): string {
  return publicUrl.replace(".webp", "-thumb.webp");
}

/**
 * Fetch the currently active AI-generated background for a world + time state.
 * Returns null if no AI background is active (caller falls back to static).
 */
export async function getActiveBackground(
  worldKey: string,
  timeOfDayState: TimeOfDayState
): Promise<ActiveBackground | null> {
  const { data, error } = await createClient()
    .from("fp_room_background_assets")
    .select("id, public_url, world_key, time_of_day_state, activated_at")
    .eq("world_key", worldKey)
    .eq("time_of_day_state", timeOfDayState)
    .eq("status", "active")
    .single();

  if (error || !data) return null;

  return {
    id: data.id,
    publicUrl: data.public_url,
    thumbUrl: toThumbUrl(data.public_url),
    worldKey: data.world_key,
    timeOfDayState: data.time_of_day_state,
    activatedAt: data.activated_at,
  };
}

/**
 * Fetch active backgrounds for all worlds for a specific time state.
 * Map is keyed by worldKey — the time state is filtered upfront.
 * Useful for the room discovery page to show time-appropriate thumbnails.
 */
export async function getAllActiveBackgrounds(
  timeOfDayState: TimeOfDayState
): Promise<Map<string, ActiveBackground>> {
  const { data, error } = await createClient()
    .from("fp_room_background_assets")
    .select("id, public_url, world_key, time_of_day_state, activated_at")
    .eq("time_of_day_state", timeOfDayState)
    .eq("status", "active");

  if (error || !data) return new Map();

  const map = new Map<string, ActiveBackground>();
  for (const row of data) {
    map.set(row.world_key, {
      id: row.id,
      publicUrl: row.public_url,
      thumbUrl: toThumbUrl(row.public_url),
      worldKey: row.world_key,
      timeOfDayState: row.time_of_day_state,
      activatedAt: row.activated_at,
    });
  }
  return map;
}
