// ─── Auto Room Generation Cron ───────────────────────────────
// Generates room blueprints for hot topics every 4 hours.

import { verifyAdminAuth } from "@/lib/admin/verifyAdminAuth";
import { startPipelineEvent } from "@/lib/pipeline/logger";
import { autoGenerateRooms } from "@/lib/rooms/autoGenerator";

export async function GET(request: Request): Promise<Response> {
  if (!(await verifyAdminAuth(request))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const event = await startPipelineEvent("room_auto_generate", "Auto Room Generation");

  try {
    const result = await autoGenerateRooms();

    console.log(
      `[auto-generate] Checked ${result.topicsChecked} topics, generated ${result.roomsGenerated} rooms in ${result.durationMs}ms`
    );

    await event.complete({
      itemsProcessed: result.topicsChecked,
      itemsSucceeded: result.roomsGenerated,
      summary: result,
    });

    return Response.json({ ok: true, ...result });
  } catch (error) {
    await event.fail(error);
    console.error("[auto-generate] cron error:", error);
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function POST(request: Request): Promise<Response> {
  if (!(await verifyAdminAuth(request))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    topicSlugs?: string[];
    heatThreshold?: number;
    maxRooms?: number;
  } = {};
  try {
    body = await request.json();
  } catch {
    // Use defaults
  }

  const result = await autoGenerateRooms({
    topicSlugs: body.topicSlugs,
    heatThreshold: body.heatThreshold,
    maxRooms: body.maxRooms,
  });

  return Response.json({ ok: true, ...result });
}
