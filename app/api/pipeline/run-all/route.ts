// ─── Pipeline Run-All Orchestrator ───────────────────────────
// Runs the full content pipeline in sequence for local development.
// POST /api/pipeline/run-all (protected by ADMIN_SECRET)

import { NextResponse } from "next/server";
import type { PipelineJobType } from "@/lib/pipeline/logger";

// ─── Stage definitions in execution order ────────────────────

interface PipelineStage {
  name: string;
  jobType: PipelineJobType;
  endpoint: string;
  /** GET for cron endpoints, POST for endpoints that accept parameters */
  method: "GET" | "POST";
}

const PIPELINE_STAGES: PipelineStage[] = [
  { name: "signals", jobType: "signal_collection", endpoint: "/api/signals/collect", method: "GET" },
  { name: "cluster", jobType: "topic_clustering", endpoint: "/api/topics/cluster", method: "GET" },
  { name: "discover", jobType: "discovery_scheduled", endpoint: "/api/breaks/discover", method: "GET" },
  { name: "discover-hot", jobType: "discovery_hot_topic", endpoint: "/api/breaks/discover-hot", method: "GET" },
  { name: "evaluate", jobType: "evaluation", endpoint: "/api/breaks/evaluate", method: "GET" },
  { name: "scaffold", jobType: "scaffolding", endpoint: "/api/breaks/scaffold", method: "GET" },
  { name: "shelf", jobType: "shelf_refresh", endpoint: "/api/breaks/refresh-shelf", method: "GET" },
  { name: "auto-generate", jobType: "room_auto_generate", endpoint: "/api/rooms/auto-generate", method: "GET" },
  { name: "lifecycle", jobType: "room_lifecycle", endpoint: "/api/rooms/lifecycle", method: "GET" },
];

const VALID_STAGE_NAMES = new Set(PIPELINE_STAGES.map((s) => s.name));

// ─── Types ──────────────────────────────────────────────────

interface StageResult {
  name: string;
  jobType: PipelineJobType;
  status: "success" | "error" | "skipped";
  durationMs: number;
  httpStatus?: number;
  result?: unknown;
  error?: string;
}

interface RunAllRequest {
  secret?: string;
  stages?: string[];
  dryRun?: boolean;
}

// ─── Handler ────────────────────────────────────────────────

/**
 * POST /api/pipeline/run-all
 * Runs the full pipeline in sequence. Protected by ADMIN_SECRET.
 *
 * Body:
 *   secret: string        — ADMIN_SECRET for auth
 *   stages?: string[]     — optional subset of stage names to run
 *   dryRun?: boolean      — if true, logs what would run without executing
 */
export async function POST(request: Request): Promise<Response> {
  let body: RunAllRequest = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Auth: check secret in body or Authorization header
  const adminSecret = process.env.ADMIN_SECRET;
  const authHeader = request.headers.get("authorization");
  const headerMatch = adminSecret && authHeader === `Bearer ${adminSecret}`;
  const bodyMatch = adminSecret && body.secret === adminSecret;

  if (!headerMatch && !bodyMatch) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Determine which stages to run
  let stagesToRun = PIPELINE_STAGES;
  if (body.stages && body.stages.length > 0) {
    const invalid = body.stages.filter((s) => !VALID_STAGE_NAMES.has(s));
    if (invalid.length > 0) {
      return NextResponse.json(
        { error: `Unknown stages: ${invalid.join(", ")}`, validStages: [...VALID_STAGE_NAMES] },
        { status: 400 }
      );
    }
    const requestedSet = new Set(body.stages);
    stagesToRun = PIPELINE_STAGES.filter((s) => requestedSet.has(s.name));
  }

  // Dry run — return plan without executing
  if (body.dryRun) {
    return NextResponse.json({
      dryRun: true,
      stages: stagesToRun.map((s) => ({
        name: s.name,
        jobType: s.jobType,
        endpoint: s.endpoint,
        method: s.method,
      })),
      totalStages: stagesToRun.length,
    });
  }

  // Execute stages in sequence
  const baseUrl = new URL(request.url).origin;
  const cronSecret = process.env.CRON_SECRET ?? process.env.ADMIN_SECRET ?? "";
  const results: StageResult[] = [];
  const pipelineStart = Date.now();

  console.log(`[pipeline/run-all] Starting ${stagesToRun.length} stages...`);

  for (const stage of stagesToRun) {
    const stageStart = Date.now();
    console.log(`[pipeline/run-all] ▶ ${stage.name} (${stage.endpoint})`);

    try {
      const res = await fetch(`${baseUrl}${stage.endpoint}`, {
        method: stage.method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${cronSecret}`,
        },
      });

      const durationMs = Date.now() - stageStart;
      let result: unknown = null;
      try {
        result = await res.json();
      } catch {
        result = { rawStatus: res.status, statusText: res.statusText };
      }

      const status = res.ok ? "success" : "error";
      console.log(
        `[pipeline/run-all] ${status === "success" ? "✓" : "✗"} ${stage.name}: ${res.status} in ${durationMs}ms`
      );

      results.push({
        name: stage.name,
        jobType: stage.jobType,
        status,
        durationMs,
        httpStatus: res.status,
        result,
        error: res.ok ? undefined : `HTTP ${res.status}`,
      });
    } catch (err) {
      const durationMs = Date.now() - stageStart;
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error(`[pipeline/run-all] ✗ ${stage.name}: ${errorMsg}`);

      results.push({
        name: stage.name,
        jobType: stage.jobType,
        status: "error",
        durationMs,
        error: errorMsg,
      });
    }
  }

  const totalDurationMs = Date.now() - pipelineStart;
  const succeeded = results.filter((r) => r.status === "success").length;
  const failed = results.filter((r) => r.status === "error").length;

  console.log(
    `[pipeline/run-all] Done: ${succeeded} succeeded, ${failed} failed in ${totalDurationMs}ms`
  );

  return NextResponse.json({
    ok: failed === 0,
    totalDurationMs,
    stagesRun: results.length,
    succeeded,
    failed,
    stages: results,
  });
}
