// ─── Room Backgrounds ───────────────────────────────────────
// Client-side queries for active AI-generated room backgrounds.
// Falls back gracefully when no AI background is active.

import { createClient } from "./supabase/client";

export interface ActiveBackground {
  id: string;
  publicUrl: string;
  thumbUrl: string;
  worldKey: string;
  activatedAt: string;
}

/** Derive thumbnail URL from main image URL (convention: -thumb suffix). */
function toThumbUrl(publicUrl: string): string {
  return publicUrl.replace(".webp", "-thumb.webp");
}

/**
 * Fetch the currently active AI-generated background for a world.
 * Returns null if no AI background is active (caller falls back to static).
 */
export async function getActiveBackground(
  worldKey: string
): Promise<ActiveBackground | null> {
  const { data, error } = await createClient()
    .from("fp_room_background_assets")
    .select("id, public_url, world_key, activated_at")
    .eq("world_key", worldKey)
    .eq("status", "active")
    .single();

  if (error || !data) return null;

  return {
    id: data.id,
    publicUrl: data.public_url,
    thumbUrl: toThumbUrl(data.public_url),
    worldKey: data.world_key,
    activatedAt: data.activated_at,
  };
}

/**
 * Fetch active backgrounds for all worlds at once.
 * Useful for the room discovery page to show AI backgrounds on cards.
 */
export async function getAllActiveBackgrounds(): Promise<
  Map<string, ActiveBackground>
> {
  const { data, error } = await createClient()
    .from("fp_room_background_assets")
    .select("id, public_url, world_key, activated_at")
    .eq("status", "active");

  if (error || !data) return new Map();

  const map = new Map<string, ActiveBackground>();
  for (const row of data) {
    map.set(row.world_key, {
      id: row.id,
      publicUrl: row.public_url,
      thumbUrl: toThumbUrl(row.public_url),
      worldKey: row.world_key,
      activatedAt: row.activated_at,
    });
  }
  return map;
}
