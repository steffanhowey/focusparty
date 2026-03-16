/**
 * GET /api/intelligence/feed
 *
 * Public endpoint returning published intelligence insights.
 * Query params:
 *   - type: filter by insight_type (optional)
 *   - limit: max results (default 10, max 50)
 */

import { createClient } from "@/lib/supabase/admin";
import type { SkillIntelligence } from "@/lib/types/intelligence";

export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "10", 10), 50);

  const admin = createClient();

  let query = admin
    .from("fp_skill_intelligence")
    .select("*")
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (type) {
    query = query.eq("insight_type", type);
  }

  const { data, error } = await query;

  if (error) {
    console.error("[intelligence/feed] error:", error);
    return Response.json({ insights: [] });
  }

  const insights: SkillIntelligence[] = (data ?? []).map(
    (row: Record<string, unknown>) => ({
      id: row.id as string,
      skill_slugs: row.skill_slugs as string[],
      insight_type: row.insight_type as SkillIntelligence["insight_type"],
      headline: row.headline as string,
      analysis: row.analysis as string,
      evidence: row.evidence as SkillIntelligence["evidence"],
      recommendations:
        row.recommendations as SkillIntelligence["recommendations"],
      confidence: row.confidence as number,
      impact_score: row.impact_score as number,
      status: row.status as SkillIntelligence["status"],
      published_at: row.published_at as string | null,
      expires_at: row.expires_at as string | null,
      source_snapshot_date: row.source_snapshot_date as string | null,
      created_at: row.created_at as string,
    })
  );

  return Response.json({ insights });
}
