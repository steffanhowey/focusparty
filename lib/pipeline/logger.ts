// ─── Pipeline Event Logger ───────────────────────────────────
// Structured logging for every cron job and pipeline operation.
// Powers the pipeline health dashboard and alert system.

import { createClient } from "@/lib/supabase/admin";

// ─── Types ──────────────────────────────────────────────────

export type PipelineJobType =
  | "signal_collection"
  | "topic_clustering"
  | "discovery_scheduled"
  | "discovery_hot_topic"
  | "evaluation"
  | "scaffolding"
  | "shelf_refresh"
  | "room_auto_generate"
  | "room_lifecycle"
  | "background_rotate"
  | "synthetic_tick"
  | "analytics_aggregation"
  | "score_calibration"
  | "pipeline_unified"
  | "article_ingestion"
  | "path_discovery";

export interface PipelineEventHandle {
  eventId: string;
  complete: (result: {
    status?: "completed" | "partial";
    itemsProcessed?: number;
    itemsSucceeded?: number;
    itemsFailed?: number;
    summary?: object;
    errors?: Array<{ message: string; context?: unknown }>;
    metadata?: object;
  }) => Promise<void>;
  fail: (error: unknown) => Promise<void>;
}

export interface PipelineEvent {
  id: string;
  jobName: string;
  jobType: PipelineJobType;
  startedAt: string;
  completedAt: string | null;
  durationMs: number | null;
  status: "running" | "completed" | "partial" | "failed";
  itemsProcessed: number;
  itemsSucceeded: number;
  itemsFailed: number;
  summary: Record<string, unknown>;
  errors: Array<{ message: string; context?: unknown }>;
}

export interface PipelineHealthSummary {
  jobs: {
    jobType: PipelineJobType;
    jobName: string;
    lastRunAt: string | null;
    lastStatus: string | null;
    runsLast24h: number;
    successRate: number;
    avgDurationMs: number;
    isHealthy: boolean;
  }[];
  overallHealth: "healthy" | "degraded" | "critical";
}

export interface PipelineAlert {
  severity: "warning" | "critical";
  jobType: PipelineJobType;
  message: string;
  lastRunAt: string | null;
  expectedFrequencyMinutes: number;
}

// ─── Expected frequencies (minutes) ────────────────────────

const EXPECTED_FREQUENCIES: Record<PipelineJobType, number> = {
  signal_collection: 15,
  topic_clustering: 60,
  discovery_scheduled: 360,
  discovery_hot_topic: 120,
  evaluation: 720,
  scaffolding: 720,
  shelf_refresh: 1440,
  room_auto_generate: 240,
  room_lifecycle: 1440,
  background_rotate: 1440,
  synthetic_tick: 2,
  analytics_aggregation: 1440,
  score_calibration: 10080,
  pipeline_unified: 180,
  article_ingestion: 360,
  path_discovery: 720,
};

const JOB_NAMES: Record<PipelineJobType, string> = {
  signal_collection: "Signal Collection",
  topic_clustering: "Topic Clustering",
  discovery_scheduled: "Scheduled Discovery",
  discovery_hot_topic: "Hot-Topic Discovery",
  evaluation: "Content Evaluation",
  scaffolding: "Scaffolding Generation",
  shelf_refresh: "Shelf Refresh",
  room_auto_generate: "Auto Room Generation",
  room_lifecycle: "Room Lifecycle",
  background_rotate: "Background Rotation",
  synthetic_tick: "Synthetic Tick",
  analytics_aggregation: "Analytics Aggregation",
  score_calibration: "Score Calibration",
  pipeline_unified: "Unified Pipeline Run",
  article_ingestion: "Article Ingestion",
  path_discovery: "Learning Path Discovery",
};

// ─── Core ───────────────────────────────────────────────────

/**
 * Start a pipeline event. Returns a handle with complete() and fail() methods.
 */
export async function startPipelineEvent(
  jobType: PipelineJobType,
  jobName: string
): Promise<PipelineEventHandle> {
  const supabase = createClient();
  const startedAt = new Date();

  const { data, error } = await supabase
    .from("fp_pipeline_events")
    .insert({
      job_name: jobName,
      job_type: jobType,
      status: "running",
      started_at: startedAt.toISOString(),
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("[pipeline/logger] Failed to start event:", error);
    // Return a no-op handle so callers don't need to handle this failure
    return {
      eventId: "noop",
      complete: async () => {},
      fail: async () => {},
    };
  }

  const eventId = data.id;

  return {
    eventId,
    complete: async (result) => {
      try {
        const completedAt = new Date();
        const durationMs = completedAt.getTime() - startedAt.getTime();

        await supabase
          .from("fp_pipeline_events")
          .update({
            status: result.status ?? "completed",
            completed_at: completedAt.toISOString(),
            duration_ms: durationMs,
            items_processed: result.itemsProcessed ?? 0,
            items_succeeded: result.itemsSucceeded ?? result.itemsProcessed ?? 0,
            items_failed: result.itemsFailed ?? 0,
            summary: result.summary ?? {},
            errors: result.errors ?? [],
            metadata: result.metadata ?? {},
          })
          .eq("id", eventId);
      } catch (err) {
        console.error("[pipeline/logger] Failed to complete event:", err);
      }
    },
    fail: async (error) => {
      try {
        const completedAt = new Date();
        const durationMs = completedAt.getTime() - startedAt.getTime();
        const errorMessage = error instanceof Error ? error.message : String(error);

        await supabase
          .from("fp_pipeline_events")
          .update({
            status: "failed",
            completed_at: completedAt.toISOString(),
            duration_ms: durationMs,
            errors: [{ message: errorMessage }],
          })
          .eq("id", eventId);
      } catch (err) {
        console.error("[pipeline/logger] Failed to record failure:", err);
      }
    },
  };
}

/**
 * Get recent pipeline events for dashboard display.
 */
export async function getRecentEvents(options?: {
  jobType?: PipelineJobType;
  status?: string;
  limit?: number;
  hoursBack?: number;
}): Promise<PipelineEvent[]> {
  const supabase = createClient();
  const limit = options?.limit ?? 50;
  const hoursBack = options?.hoursBack ?? 24;

  const cutoff = new Date(
    Date.now() - hoursBack * 60 * 60 * 1000
  ).toISOString();

  let query = supabase
    .from("fp_pipeline_events")
    .select("*")
    .gte("started_at", cutoff)
    .order("started_at", { ascending: false })
    .limit(limit);

  if (options?.jobType) {
    query = query.eq("job_type", options.jobType);
  }
  if (options?.status) {
    query = query.eq("status", options.status);
  }

  const { data, error } = await query;

  if (error) {
    console.error("[pipeline/logger] getRecentEvents error:", error);
    return [];
  }

  return (data ?? []).map(mapEventRow);
}

/**
 * Get pipeline health summary for the last N hours.
 */
export async function getPipelineHealthSummary(
  hoursBack = 24
): Promise<PipelineHealthSummary> {
  const supabase = createClient();
  const cutoff = new Date(
    Date.now() - hoursBack * 60 * 60 * 1000
  ).toISOString();

  // Get all events in the window
  const { data: events } = await supabase
    .from("fp_pipeline_events")
    .select("job_type, job_name, status, started_at, duration_ms")
    .gte("started_at", cutoff)
    .order("started_at", { ascending: false });

  const allEvents = events ?? [];

  // Group by job type
  const jobTypes = Object.keys(EXPECTED_FREQUENCIES) as PipelineJobType[];
  const jobSummaries = jobTypes
    .filter((jt) => jt !== "synthetic_tick") // Skip synthetic tick in health summary
    .map((jobType) => {
      const jobEvents = allEvents.filter((e) => e.job_type === jobType);
      const lastEvent = jobEvents[0]; // Already sorted desc
      const completed = jobEvents.filter((e) => e.status === "completed" || e.status === "partial");
      const failed = jobEvents.filter((e) => e.status === "failed");
      const runsLast24h = jobEvents.length;
      const successRate = runsLast24h > 0 ? completed.length / runsLast24h : 1;
      const avgDurationMs =
        completed.length > 0
          ? Math.round(
              completed.reduce((sum, e) => sum + (e.duration_ms ?? 0), 0) /
                completed.length
            )
          : 0;

      // Health: healthy if last run succeeded and it ran on schedule
      const expectedFreq = EXPECTED_FREQUENCIES[jobType];
      const lastRunAt = lastEvent?.started_at ?? null;
      const minutesSinceLastRun = lastRunAt
        ? (Date.now() - new Date(lastRunAt).getTime()) / 60000
        : Infinity;
      const isHealthy =
        lastEvent?.status !== "failed" &&
        minutesSinceLastRun < expectedFreq * 2 &&
        successRate >= 0.5;

      return {
        jobType,
        jobName: lastEvent?.job_name ?? JOB_NAMES[jobType],
        lastRunAt,
        lastStatus: lastEvent?.status ?? null,
        runsLast24h,
        successRate: Math.round(successRate * 100) / 100,
        avgDurationMs,
        isHealthy,
      };
    });

  const unhealthy = jobSummaries.filter((j) => !j.isHealthy);
  const overallHealth: PipelineHealthSummary["overallHealth"] =
    unhealthy.length === 0
      ? "healthy"
      : unhealthy.length <= 2
        ? "degraded"
        : "critical";

  return { jobs: jobSummaries, overallHealth };
}

/**
 * Get pipeline alerts: jobs that haven't run on schedule, high failure rates, etc.
 */
export async function getPipelineAlerts(): Promise<PipelineAlert[]> {
  const supabase = createClient();
  const alerts: PipelineAlert[] = [];

  const jobTypes = (Object.keys(EXPECTED_FREQUENCIES) as PipelineJobType[]).filter(
    (jt) => jt !== "synthetic_tick"
  );

  for (const jobType of jobTypes) {
    const expectedFreq = EXPECTED_FREQUENCIES[jobType];

    // Get last 3 runs for this job type
    const { data: recentRuns } = await supabase
      .from("fp_pipeline_events")
      .select("status, started_at")
      .eq("job_type", jobType)
      .order("started_at", { ascending: false })
      .limit(3);

    const runs = recentRuns ?? [];
    const lastRun = runs[0];
    const lastRunAt = lastRun?.started_at ?? null;

    // Alert: job hasn't run in 2x expected frequency
    if (lastRunAt) {
      const minutesSinceLastRun =
        (Date.now() - new Date(lastRunAt).getTime()) / 60000;
      if (minutesSinceLastRun > expectedFreq * 2) {
        alerts.push({
          severity: minutesSinceLastRun > expectedFreq * 4 ? "critical" : "warning",
          jobType,
          message: `${JOB_NAMES[jobType]} hasn't run in ${Math.round(minutesSinceLastRun)} min (expected: every ${expectedFreq} min)`,
          lastRunAt,
          expectedFrequencyMinutes: expectedFreq,
        });
        continue;
      }
    } else {
      // Never ran
      alerts.push({
        severity: "warning",
        jobType,
        message: `${JOB_NAMES[jobType]} has never run`,
        lastRunAt: null,
        expectedFrequencyMinutes: expectedFreq,
      });
      continue;
    }

    // Alert: last 3 runs all failed
    if (runs.length >= 3 && runs.every((r) => r.status === "failed")) {
      alerts.push({
        severity: "critical",
        jobType,
        message: `${JOB_NAMES[jobType]} has failed 3 consecutive runs`,
        lastRunAt,
        expectedFrequencyMinutes: expectedFreq,
      });
      continue;
    }

    // Alert: 24h success rate below 50%
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: dayRuns } = await supabase
      .from("fp_pipeline_events")
      .select("status")
      .eq("job_type", jobType)
      .gte("started_at", oneDayAgo);

    const allDayRuns = dayRuns ?? [];
    if (allDayRuns.length >= 2) {
      const successCount = allDayRuns.filter(
        (r) => r.status === "completed" || r.status === "partial"
      ).length;
      const successRate = successCount / allDayRuns.length;
      if (successRate < 0.5) {
        alerts.push({
          severity: "warning",
          jobType,
          message: `${JOB_NAMES[jobType]} success rate is ${Math.round(successRate * 100)}% in last 24h`,
          lastRunAt,
          expectedFrequencyMinutes: expectedFreq,
        });
      }
    }
  }

  return alerts;
}

// ─── Helpers ────────────────────────────────────────────────

function mapEventRow(row: Record<string, unknown>): PipelineEvent {
  return {
    id: row.id as string,
    jobName: row.job_name as string,
    jobType: row.job_type as PipelineJobType,
    startedAt: row.started_at as string,
    completedAt: (row.completed_at as string) ?? null,
    durationMs: (row.duration_ms as number) ?? null,
    status: row.status as PipelineEvent["status"],
    itemsProcessed: (row.items_processed as number) ?? 0,
    itemsSucceeded: (row.items_succeeded as number) ?? 0,
    itemsFailed: (row.items_failed as number) ?? 0,
    summary: (row.summary as Record<string, unknown>) ?? {},
    errors: (row.errors as PipelineEvent["errors"]) ?? [],
  };
}
