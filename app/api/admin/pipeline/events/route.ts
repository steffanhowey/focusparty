// ─── Pipeline Events API ─────────────────────────────────────

import { NextRequest } from "next/server";
import { requireAdmin, isAdminError } from "@/lib/admin/requireAdmin";
import { getRecentEvents } from "@/lib/pipeline/logger";
import type { PipelineJobType } from "@/lib/pipeline/logger";

/**
 * GET /api/admin/pipeline/events
 * Returns recent pipeline events with optional filters.
 */
export async function GET(request: NextRequest): Promise<Response> {
  const auth = await requireAdmin();
  if (isAdminError(auth)) return auth;

  const url = new URL(request.url);
  const jobType = url.searchParams.get("jobType") as PipelineJobType | null;
  const status = url.searchParams.get("status");
  const limit = parseInt(url.searchParams.get("limit") ?? "50", 10);
  const hoursBack = parseInt(url.searchParams.get("hoursBack") ?? "24", 10);

  const events = await getRecentEvents({
    jobType: jobType ?? undefined,
    status: status ?? undefined,
    limit,
    hoursBack,
  });

  return Response.json({ ok: true, events });
}
