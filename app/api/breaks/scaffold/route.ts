// ─── Scaffolding Generation Cron ─────────────────────────────
// Generates learning scaffolding for scored candidates.
// Schedule: 2x daily at 4am and 4pm UTC (1 hour after evaluation).

import { verifyAdminAuth } from "@/lib/admin/verifyAdminAuth";
import { startPipelineEvent } from "@/lib/pipeline/logger";
import { generateScaffoldingBatch } from "@/lib/scaffolding/generator";

export async function GET(request: Request): Promise<Response> {
  if (!(await verifyAdminAuth(request))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const event = await startPipelineEvent("scaffolding", "Scaffolding Generation");

  try {
    const result = await generateScaffoldingBatch({ limit: 10, minScore: 55 });

    console.log(
      `[scaffold] Generated ${result.succeeded} scaffoldings, ${result.failed} failed, ${result.skippedNoTranscript} no transcript in ${result.durationMs}ms`
    );

    await event.complete({
      itemsProcessed: result.processed,
      itemsSucceeded: result.succeeded,
      itemsFailed: result.failed,
      summary: result,
    });

    return Response.json({ ok: true, ...result });
  } catch (error) {
    await event.fail(error);
    console.error("[scaffold] cron error:", error);
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function POST(request: Request): Promise<Response> {
  if (!(await verifyAdminAuth(request))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { limit?: number; minScore?: number; videoIds?: string[] } = {};
  try {
    body = await request.json();
  } catch {
    // Use defaults
  }

  const result = await generateScaffoldingBatch({
    limit: body.limit ?? 10,
    minScore: body.minScore ?? 55,
    videoIds: body.videoIds,
  });

  return Response.json({ ok: true, ...result });
}
