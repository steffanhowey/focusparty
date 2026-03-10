import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/admin";

/**
 * Rotates each room's active background to the next approved candidate.
 * Cycles through all approved + active assets in creation order.
 *
 * GET  /api/backgrounds/rotate — Vercel Cron (auth via CRON_SECRET)
 * POST /api/backgrounds/rotate — Manual admin call
 *   Optional body: { worldKey?: string } to rotate a single room.
 */

function verifyAuth(request: Request): boolean {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return false;

  // Vercel Cron sends Authorization: Bearer <CRON_SECRET>
  // We also accept our ADMIN_SECRET
  const authHeader = request.headers.get("authorization");
  if (authHeader === `Bearer ${secret}`) return true;

  // Vercel Cron v2 uses CRON_SECRET env var
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

  // Get all worlds that have assets, or just the target
  const worldKeys = targetWorldKey
    ? [targetWorldKey]
    : ["default", "vibe-coding", "writer-room", "yc-build", "gentle-start"];

  const results: {
    worldKey: string;
    previousAssetId: string | null;
    newAssetId: string | null;
    success: boolean;
    error?: string;
  }[] = [];

  for (const worldKey of worldKeys) {
    try {
      // Get all eligible assets for this world (active + approved), ordered by creation
      const { data: assets, error: fetchErr } = await supabase
        .from("fp_room_background_assets")
        .select("id, status, created_at")
        .eq("world_key", worldKey)
        .in("status", ["active", "approved"])
        .order("created_at", { ascending: true });

      if (fetchErr || !assets || assets.length < 2) {
        results.push({
          worldKey,
          previousAssetId: null,
          newAssetId: null,
          success: false,
          error: assets?.length === 1 ? "Only 1 asset, nothing to rotate" : "No assets found",
        });
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
        previousAssetId: currentActive.id,
        newAssetId: nextAsset.id,
        success: true,
      });

      console.log(`[bg-rotate] ${worldKey}: ${currentActive.id} → ${nextAsset.id}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      results.push({
        worldKey,
        previousAssetId: null,
        newAssetId: null,
        success: false,
        error: message,
      });
    }
  }

  const successCount = results.filter((r) => r.success).length;
  console.log(`[bg-rotate] Done: ${successCount}/${worldKeys.length} rotated`);

  return NextResponse.json({ results, successCount });
}
