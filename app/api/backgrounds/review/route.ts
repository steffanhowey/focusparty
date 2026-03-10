import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/admin";

type ReviewAction = "approve" | "reject" | "activate" | "archive";

/**
 * POST /api/backgrounds/review
 *
 * Admin endpoint to approve, reject, activate, or archive a background asset.
 * Protected by ADMIN_SECRET.
 *
 * Body: {
 *   assetId: string,
 *   action: "approve" | "reject" | "activate" | "archive",
 *   notes?: string,
 *   score?: number   // 0-1 overall score
 * }
 */
export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  const secret = process.env.ADMIN_SECRET;

  if (!secret) {
    return NextResponse.json(
      { error: "ADMIN_SECRET env var not configured" },
      { status: 500 }
    );
  }

  if (authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    assetId?: string;
    action?: ReviewAction;
    notes?: string;
    score?: number;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { assetId, action, notes, score } = body;

  if (!assetId || !action) {
    return NextResponse.json(
      { error: "assetId and action are required" },
      { status: 400 }
    );
  }

  const validActions: ReviewAction[] = ["approve", "reject", "activate", "archive"];
  if (!validActions.includes(action)) {
    return NextResponse.json(
      { error: `Invalid action. Must be one of: ${validActions.join(", ")}` },
      { status: 400 }
    );
  }

  const supabase = createClient();
  const now = new Date().toISOString();

  // Fetch the target asset
  const { data: asset, error: fetchError } = await supabase
    .from("fp_room_background_assets")
    .select("id, world_key, status, time_of_day_state")
    .eq("id", assetId)
    .single();

  if (fetchError || !asset) {
    return NextResponse.json(
      { error: "Asset not found" },
      { status: 404 }
    );
  }

  switch (action) {
    case "approve": {
      const { error } = await supabase
        .from("fp_room_background_assets")
        .update({
          status: "approved",
          reviewed_at: now,
          ...(notes != null ? { review_notes: notes } : {}),
          ...(score != null ? { score_overall: score } : {}),
        })
        .eq("id", assetId);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ success: true, assetId, status: "approved" });
    }

    case "reject": {
      const { error } = await supabase
        .from("fp_room_background_assets")
        .update({
          status: "archived",
          archived_at: now,
          reviewed_at: now,
          ...(notes != null ? { review_notes: notes } : {}),
          ...(score != null ? { score_overall: score } : {}),
        })
        .eq("id", assetId);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ success: true, assetId, status: "archived" });
    }

    case "activate": {
      // Archive current active background for this (world, time state)
      await supabase
        .from("fp_room_background_assets")
        .update({ status: "archived", archived_at: now })
        .eq("world_key", asset.world_key)
        .eq("time_of_day_state", asset.time_of_day_state)
        .eq("status", "active");

      // Activate the target asset
      const { error } = await supabase
        .from("fp_room_background_assets")
        .update({
          status: "active",
          activated_at: now,
          reviewed_at: now,
          ...(notes != null ? { review_notes: notes } : {}),
          ...(score != null ? { score_overall: score } : {}),
        })
        .eq("id", assetId);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      // Fetch the full asset to return the public URL
      const { data: activated } = await supabase
        .from("fp_room_background_assets")
        .select("id, public_url, world_key, activated_at")
        .eq("id", assetId)
        .single();

      return NextResponse.json({
        success: true,
        assetId,
        status: "active",
        asset: activated,
      });
    }

    case "archive": {
      const { error } = await supabase
        .from("fp_room_background_assets")
        .update({
          status: "archived",
          archived_at: now,
          ...(notes != null ? { review_notes: notes } : {}),
        })
        .eq("id", assetId);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ success: true, assetId, status: "archived" });
    }
  }
}
