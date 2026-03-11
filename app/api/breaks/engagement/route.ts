import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/breaks/engagement
 * Track user engagement with break content.
 * Body: { content_item_id, event_type, elapsed_seconds? }
 */
export async function POST(request: Request) {
  const supabase = await createClient();

  // Get authenticated user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    content_item_id?: string;
    event_type?: string;
    elapsed_seconds?: number;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { content_item_id, event_type, elapsed_seconds } = body;

  if (!content_item_id || !event_type) {
    return NextResponse.json(
      { error: "content_item_id and event_type required" },
      { status: 400 }
    );
  }

  const validTypes = ["started", "completed", "abandoned"];
  if (!validTypes.includes(event_type)) {
    return NextResponse.json(
      { error: `event_type must be one of: ${validTypes.join(", ")}` },
      { status: 400 }
    );
  }

  const { error } = await supabase.from("fp_break_engagement").insert({
    content_item_id,
    user_id: user.id,
    event_type,
    elapsed_seconds: elapsed_seconds ?? null,
  });

  if (error) {
    console.error("[breaks/engagement] insert error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
