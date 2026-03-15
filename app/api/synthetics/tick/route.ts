import { NextResponse } from "next/server";
import { runTick } from "@/lib/synthetics/engine";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { verifyAdminAuth } from "@/lib/admin/verifyAdminAuth";

/**
 * POST /api/synthetics/tick
 *
 * Runs one tick of the synthetic activity engine.
 * Accepts optional { partyId } to evaluate a single room.
 * If no partyId, evaluates all discoverable rooms.
 *
 * Requires authenticated user session or admin/cron secret.
 * Rate limits are enforced internally by the engine.
 */
export async function POST(request: Request): Promise<NextResponse> {
  // Auth: require a logged-in user or admin token
  const isAdmin = await verifyAdminAuth(request);
  if (!isAdmin) {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const body = await request.json().catch(() => ({}));
    const targetPartyId = (body as Record<string, unknown>).partyId as
      | string
      | undefined;

    const result = await runTick(targetPartyId);

    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[synthetics/tick] error:", err);
    return NextResponse.json(
      { error: "Internal error" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/synthetics/tick
 *
 * Called by Vercel Cron every 2 minutes to keep synthetic
 * activity alive regardless of active client connections.
 * Requires CRON_SECRET or ADMIN_SECRET.
 */
export async function GET(request: Request): Promise<NextResponse> {
  if (!(await verifyAdminAuth(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runTick();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[synthetics/tick] cron error:", err);
    return NextResponse.json(
      { error: "Internal error" },
      { status: 500 }
    );
  }
}
