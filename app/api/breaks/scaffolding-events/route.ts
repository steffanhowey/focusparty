import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const VALID_EVENT_TYPES = [
  "pre_watch_shown",
  "pre_watch_attempted",
  "pre_watch_skipped",
  "key_moment_clicked",
  "comprehension_shown",
  "comprehension_answer_revealed",
  "comprehension_rewatch",
  "exercise_shown",
  "exercise_completed",
  "exercise_skipped",
  "discussion_shared",
  "post_watch_dismissed",
  "post_watch_auto_dismissed",
];

/**
 * POST /api/breaks/scaffolding-events
 * Track user interactions with learning scaffolding.
 * Body: { content_item_id, event_type, payload? }
 */
export async function POST(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    content_item_id?: string;
    event_type?: string;
    payload?: Record<string, unknown> | null;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { content_item_id, event_type, payload } = body;

  if (!content_item_id || !event_type) {
    return NextResponse.json(
      { error: "content_item_id and event_type required" },
      { status: 400 }
    );
  }

  if (!VALID_EVENT_TYPES.includes(event_type)) {
    return NextResponse.json(
      { error: `event_type must be one of: ${VALID_EVENT_TYPES.join(", ")}` },
      { status: 400 }
    );
  }

  const { error } = await supabase.from("fp_scaffolding_events").insert({
    content_item_id,
    user_id: user.id,
    event_type,
    payload: payload ?? {},
  });

  if (error) {
    console.error("[breaks/scaffolding-events] insert error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
