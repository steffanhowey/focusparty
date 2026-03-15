// ─── Health Check Endpoint ───────────────────────────────────
// Returns platform health status: pipeline job summaries + alerts.
// Public GET for uptime monitors. Detailed info requires admin auth.

import { NextResponse } from "next/server";
import { getPipelineHealthSummary, getPipelineAlerts } from "@/lib/pipeline/logger";
import { verifyAdminAuth } from "@/lib/admin/verifyAdminAuth";
import { logger } from "@/lib/logger";

const log = logger("health");

/**
 * GET /api/health
 *
 * Public: returns { status, overall_health, timestamp }
 * Admin (Bearer ADMIN_SECRET): adds { jobs, alerts } detail.
 */
export async function GET(request: Request): Promise<NextResponse> {
  try {
    const summary = await getPipelineHealthSummary(24);
    const isAdmin = await verifyAdminAuth(request);

    // Public response: just the headline
    const response: Record<string, unknown> = {
      status: "ok",
      overall_health: summary.overallHealth,
      timestamp: new Date().toISOString(),
    };

    // Admin gets the full picture
    if (isAdmin) {
      const alerts = await getPipelineAlerts();
      response.jobs = summary.jobs;
      response.alerts = alerts;
      response.unhealthy_count = summary.jobs.filter((j) => !j.isHealthy).length;
    }

    const httpStatus = summary.overallHealth === "critical" ? 503 : 200;
    return NextResponse.json(response, { status: httpStatus });
  } catch (error) {
    log.error("Health check failed", error);
    return NextResponse.json(
      {
        status: "error",
        overall_health: "unknown",
        timestamp: new Date().toISOString(),
        error: "Health check failed",
      },
      { status: 500 }
    );
  }
}
