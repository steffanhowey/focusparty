// ─── Hot-Topic Discovery Cron ────────────────────────────────
// Discovers YouTube content for trending topics identified by
// the heat engine. Runs every 2 hours.

import { verifyAdminAuth } from "@/lib/admin/verifyAdminAuth";
import { startPipelineEvent } from "@/lib/pipeline/logger";
import { discoverForHotTopics } from "@/lib/breaks/topicTriggeredDiscovery";

export async function GET(request: Request): Promise<Response> {
  if (!(await verifyAdminAuth(request))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const event = await startPipelineEvent("discovery_hot_topic", "Hot-Topic Discovery");

  try {
    const result = await discoverForHotTopics();

    console.log(
      `[discover-hot] ${result.topicsDiscovered} topics yielded ${result.totalCandidates} new candidates in ${result.durationMs}ms`
    );

    await event.complete({
      itemsProcessed: result.topicsDiscovered,
      itemsSucceeded: result.totalCandidates,
      summary: result,
    });

    return Response.json({ ok: true, ...result });
  } catch (error) {
    await event.fail(error);
    console.error("[discover-hot] cron error:", error);
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function POST(request: Request): Promise<Response> {
  if (!(await verifyAdminAuth(request))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    heatThreshold?: number;
    maxTopics?: number;
    topicSlugs?: string[];
  } = {};
  try {
    body = await request.json();
  } catch {
    // Use defaults
  }

  const result = await discoverForHotTopics({
    heatThreshold: body.heatThreshold,
    maxTopics: body.maxTopics,
    topicSlugs: body.topicSlugs,
  });

  return Response.json({ ok: true, ...result });
}
