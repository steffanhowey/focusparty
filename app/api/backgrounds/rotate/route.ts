import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/admin";
import { TIME_OF_DAY_STATES } from "@/lib/timeOfDay";

/**
 * Rotates each room's active background to the next approved candidate.
 * Cycles through all approved + active assets in creation order,
 * independently within each (world_key, time_of_day_state) group.
 *
 * GET  /api/backgrounds/rotate — Vercel Cron (auth via CRON_SECRET)
 * POST /api/backgrounds/rotate — Manual admin call
 *   Optional body: { worldKey?: string } to rotate a single room.
 */

function verifyAuth(request: Request): boolean {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return false;

  const authHeader = request.headers.get("authorization");
  if (authHeader === `Bearer ${secret}`) return true;

  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader === `Bearer ${cronSecret}`) return true;

  return false;
}

export async function GET(request: Request) {
  if (!verifyAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return rotateAll(null);
}

export async function POST(request: Request) {
  if (!verifyAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let targetWorldKey: string | null = null;
  try {
    const body = await request.json().catch(() => null);
    if (body?.worldKey) targetWorldKey = body.worldKey;
  } catch {
    // No body — rotate all
  }

  return rotateAll(targetWorldKey);
}

async function rotateAll(targetWorldKey: string | null) {
  const supabase = createClient();
  const now = new Date().toISOString();

  const worldKeys = targetWorldKey
    ? [targetWorldKey]
    : ["default", "vibe-coding", "writer-room", "yc-build", "gentle-start"];

  const results: {
    worldKey: string;
    timeOfDayState: string;
    previousAssetId: string | null;
    newAssetId: string | null;
    success: boolean;
    error?: string;
  }[] = [];

  for (const worldKey of worldKeys) {
    for (const timeState of TIME_OF_DAY_STATES) {
      try {
        // Get all eligible assets for this (world, time state) group
        const { data: assets, error: fetchErr } = await supabase
          .from("fp_room_background_assets")
          .select("id, status, created_at")
          .eq("world_key", worldKey)
          .eq("time_of_day_state", timeState)
          .in("status", ["active", "approved"])
          .order("created_at", { ascending: true });

        if (fetchErr || !assets || assets.length < 2) {
          // Skip silently — many (world, time) combos may not have assets yet
          if (assets && assets.length >= 1) {
            results.push({
              worldKey,
              timeOfDayState: timeState,
              previousAssetId: null,
              newAssetId: null,
              success: false,
              error: "Only 1 asset, nothing to rotate",
            });
          }
          continue;
        }

        // Find current active
        const currentActive = assets.find((a) => a.status === "active");
        if (!currentActive) {
          // No active — just activate the first approved
          const first = assets[0];
          await supabase
            .from("fp_room_background_assets")
            .update({ status: "active", activated_at: now })
            .eq("id", first.id);

          results.push({
            worldKey,
            timeOfDayState: timeState,
            previousAssetId: null,
            newAssetId: first.id,
            success: true,
          });
          continue;
        }

        // Find the next asset in cycle order
        const currentIndex = assets.findIndex((a) => a.id === currentActive.id);
        const nextIndex = (currentIndex + 1) % assets.length;
        const nextAsset = assets[nextIndex];

        // Demote current active to approved
        await supabase
          .from("fp_room_background_assets")
          .update({ status: "approved", activated_at: null })
          .eq("id", currentActive.id);

        // Promote next to active
        await supabase
          .from("fp_room_background_assets")
          .update({ status: "active", activated_at: now })
          .eq("id", nextAsset.id);

        results.push({
          worldKey,
          timeOfDayState: timeState,
          previousAssetId: currentActive.id,
          newAssetId: nextAsset.id,
          success: true,
        });

        console.log(`[bg-rotate] ${worldKey}/${timeState}: ${currentActive.id} → ${nextAsset.id}`);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        results.push({
          worldKey,
          timeOfDayState: timeState,
          previousAssetId: null,
          newAssetId: null,
          success: false,
          error: message,
        });
      }
    }
  }

  const successCount = results.filter((r) => r.success).length;
  console.log(`[bg-rotate] Done: ${successCount} groups rotated`);

  return NextResponse.json({ results, successCount });
}
