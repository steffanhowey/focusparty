// ─── Room Lifecycle Cron ─────────────────────────────────────
// Daily check on auto-generated rooms: archive stale, activate
// waiting, update trending status.

import { verifyAdminAuth } from "@/lib/admin/verifyAdminAuth";
import { startPipelineEvent } from "@/lib/pipeline/logger";
import { runLifecycleChecks } from "@/lib/rooms/lifecycle";

export async function GET(request: Request): Promise<Response> {
  if (!(await verifyAdminAuth(request))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const event = await startPipelineEvent("room_lifecycle", "Room Lifecycle");

  try {
    const result = await runLifecycleChecks();

    console.log(
      `[lifecycle] Checked ${result.roomsChecked} rooms: ${result.roomsArchived} archived, ${result.roomsActivated} activated, ${result.roomsDetended} detrended (${result.durationMs}ms)`
    );

    await event.complete({
      itemsProcessed: result.roomsChecked,
      itemsSucceeded: result.roomsChecked,
      summary: result,
    });

    return Response.json({ ok: true, ...result });
  } catch (error) {
    await event.fail(error);
    console.error("[lifecycle] cron error:", error);
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}
