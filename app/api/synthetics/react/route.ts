import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/admin";
import { createClient as createServerClient } from "@/lib/supabase/server";

/**
 * POST /api/synthetics/react
 *
 * Insert a synthetic reaction event (e.g. reciprocal high-five).
 * Requires an authenticated user session. Uses the admin client
 * to bypass RLS since synthetic events have user_id = null and
 * actor_type = "synthetic".
 */
export async function POST(request: Request) {
  try {
    // Verify the caller is an authenticated user
    const serverSupabase = await createServerClient();
    const { data: { user } } = await serverSupabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;

    const partyId = body.party_id as string | undefined;
    const eventType = body.event_type as string | undefined;
    const syntheticName = body.body as string | undefined;
    const payload = body.payload as Record<string, unknown> | undefined;

    if (!partyId || !eventType || !syntheticName || !payload) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const supabase = createClient();
    const { error } = await supabase.from("fp_activity_events").insert({
      party_id: partyId,
      session_id: null,
      user_id: null,
      actor_type: "synthetic",
      event_type: eventType,
      body: syntheticName,
      payload,
      created_at: new Date().toISOString(),
    });

    if (error) {
      console.error("[synthetics/react] insert error:", error);
      return NextResponse.json({ error: "Insert failed" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[synthetics/react] error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
