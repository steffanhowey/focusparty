// ─── Pipeline Manual Trigger API ─────────────────────────────

import { requireAdmin, isAdminError } from "@/lib/admin/requireAdmin";
import type { PipelineJobType } from "@/lib/pipeline/logger";

const JOB_ENDPOINTS: Record<PipelineJobType, string> = {
  signal_collection: "/api/signals/collect",
  topic_clustering: "/api/topics/cluster",
  discovery_scheduled: "/api/breaks/discover",
  discovery_hot_topic: "/api/breaks/discover-hot",
  evaluation: "/api/breaks/evaluate",
  scaffolding: "/api/breaks/scaffold",
  shelf_refresh: "/api/breaks/refresh-shelf",
  room_auto_generate: "/api/rooms/auto-generate",
  room_lifecycle: "/api/rooms/lifecycle",
  background_rotate: "/api/backgrounds/rotate",
  synthetic_tick: "/api/synthetics/tick",
  analytics_aggregation: "/api/analytics/aggregate",
  score_calibration: "/api/analytics/calibrate",
  pipeline_unified: "/api/pipeline/run",
  article_ingestion: "/api/learn/ingest-articles",
  path_discovery: "/api/learn/discover",
  practitioner_aggregation: "/api/intelligence/practitioner-aggregate",
  skill_heat_computation: "/api/intelligence/skill-heat",
  intelligence_synthesis: "/api/intelligence/synthesize",
  skill_index_generation: "/api/intelligence/generate-index",
};

/**
 * POST /api/admin/pipeline/trigger
 * Triggers a pipeline job manually by calling its cron endpoint.
 */
export async function POST(request: Request): Promise<Response> {
  const auth = await requireAdmin();
  if (isAdminError(auth)) return auth;

  let body: { jobType?: string } = {};
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const jobType = body.jobType as PipelineJobType;
  const endpoint = JOB_ENDPOINTS[jobType];

  if (!endpoint) {
    return Response.json({ error: `Unknown job type: ${body.jobType}` }, { status: 400 });
  }

  // Build internal URL
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    ? new URL(request.url).origin
    : "http://localhost:3000";

  const cronSecret = process.env.CRON_SECRET ?? process.env.ADMIN_SECRET;

  try {
    const res = await fetch(`${baseUrl}${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cronSecret}`,
      },
    });

    const result = await res.json();
    return Response.json({ ok: true, jobType, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return Response.json({ error: message }, { status: 500 });
  }
}
