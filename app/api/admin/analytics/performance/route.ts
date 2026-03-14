// ─── Analytics Performance API ───────────────────────────────

import { requireAdmin, isAdminError } from "@/lib/admin/requireAdmin";
import { getTopPerformingContent, getUnderperformingContent } from "@/lib/analytics/contentPerformance";
import { createClient } from "@/lib/supabase/admin";

/**
 * GET /api/admin/analytics/performance
 * Returns content + room performance summaries.
 */
export async function GET(request: Request): Promise<Response> {
  const auth = await requireAdmin();
  if (isAdminError(auth)) return auth;

  const url = new URL(request.url);
  const daysBack = Number(url.searchParams.get("daysBack") ?? 30);
  const worldKey = url.searchParams.get("worldKey") ?? undefined;

  const [topContent, underContent, perfSummary] = await Promise.all([
    getTopPerformingContent({ worldKey, daysBack, limit: 15 }),
    getUnderperformingContent({ worldKey, daysBack, limit: 15, minStarts: 5 }),
    getPerformanceOverview(daysBack),
  ]);

  return Response.json({
    ok: true,
    overview: perfSummary,
    topPerforming: topContent,
    underperforming: underContent,
  });
}

async function getPerformanceOverview(daysBack: number): Promise<{
  avgCompletionRate: number;
  avgEngagementScore: number;
  totalStarts: number;
  totalCompletions: number;
  contentWithData: number;
}> {
  const supabase = createClient();
  const cutoff = new Date(Date.now() - daysBack * 86400000).toISOString().split("T")[0];

  const { data } = await supabase
    .from("fp_content_performance")
    .select("completion_rate, engagement_score, starts, completions")
    .gte("period_date", cutoff)
    .gt("starts", 0);

  const rows = data ?? [];
  if (rows.length === 0) {
    return { avgCompletionRate: 0, avgEngagementScore: 0, totalStarts: 0, totalCompletions: 0, contentWithData: 0 };
  }

  return {
    avgCompletionRate: rows.reduce((s, r) => s + Number(r.completion_rate), 0) / rows.length,
    avgEngagementScore: rows.reduce((s, r) => s + Number(r.engagement_score), 0) / rows.length,
    totalStarts: rows.reduce((s, r) => s + (r.starts ?? 0), 0),
    totalCompletions: rows.reduce((s, r) => s + (r.completions ?? 0), 0),
    contentWithData: rows.length,
  };
}
