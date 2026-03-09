import { NextResponse } from "next/server";
import { runTick } from "@/lib/synthetics/engine";

/**
 * POST /api/synthetics/tick
 *
 * Runs one tick of the synthetic activity engine.
 * Accepts optional { partyId } to evaluate a single room.
 * If no partyId, evaluates all discoverable rooms.
 *
 * Fire-and-forget from client — no auth guard (same pattern as /api/host/trigger).
 * Rate limits are enforced internally by the engine.
 */
export async function POST(request: Request) {
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
