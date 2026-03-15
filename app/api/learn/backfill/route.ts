import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/admin";
import { verifyAdminAuth } from "@/lib/admin/verifyAdminAuth";
import { indexVideoToContentLake } from "@/lib/learn/embeddings";

/**
 * POST /api/learn/backfill
 *
 * One-time backfill: indexes existing scored video candidates
 * into the content lake with embeddings.
 * Admin-only endpoint.
 */
export async function POST(request: Request): Promise<NextResponse> {
  if (!(await verifyAdminAuth(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const batchSize = Math.min(Number(body.limit ?? 50), 100);

  const supabase = createClient();

  // Find scored candidates not yet in content lake
  const { data: scored, error: fetchErr } = await supabase
    .from("fp_break_content_scores")
    .select(
      `
      id, candidate_id, world_key, taste_score,
      relevance_score, engagement_score, content_density,
      creator_authority, freshness_score, novelty_score,
      editorial_note, topics, segments,
      scaffolding, scaffolding_status
    `
    )
    .gte("taste_score", 55)
    .order("taste_score", { ascending: false })
    .limit(batchSize);

  if (fetchErr) {
    return NextResponse.json(
      { error: "Failed to fetch scores", details: fetchErr.message },
      { status: 500 }
    );
  }

  if (!scored?.length) {
    return NextResponse.json({ indexed: 0, message: "No candidates to backfill" });
  }

  // Get candidate details for each score
  const candidateIds = scored.map((s) => s.candidate_id).filter(Boolean);
  const { data: candidates } = await supabase
    .from("fp_break_content_candidates")
    .select("*")
    .in("id", candidateIds);

  const candidateMap = new Map(
    (candidates ?? []).map((c) => [c.id, c])
  );

  // Check which are already in the content lake
  const externalIds = (candidates ?? [])
    .map((c) => c.external_id)
    .filter(Boolean);

  const { data: existing } = await supabase
    .from("fp_content_lake")
    .select("external_id")
    .eq("content_type", "video")
    .in("external_id", externalIds.length > 0 ? externalIds : ["__none__"]);

  const existingSet = new Set(
    (existing ?? []).map((e) => e.external_id)
  );

  let indexed = 0;
  let skipped = 0;
  let errors = 0;
  const startTime = Date.now();

  for (const score of scored) {
    // Timeout guard: 50s max
    if (Date.now() - startTime > 50_000) {
      console.log("[learn/backfill] Timeout, stopping");
      break;
    }

    const candidate = candidateMap.get(score.candidate_id);
    if (!candidate) {
      skipped++;
      continue;
    }

    if (existingSet.has(candidate.external_id)) {
      skipped++;
      continue;
    }

    try {
      await indexVideoToContentLake(candidate, score);
      existingSet.add(candidate.external_id);
      indexed++;
    } catch (err) {
      console.error(
        `[learn/backfill] Failed to index "${candidate.title}":`,
        err
      );
      errors++;
    }
  }

  console.log(
    `[learn/backfill] Done: ${indexed} indexed, ${skipped} skipped, ${errors} errors`
  );

  return NextResponse.json({ indexed, skipped, errors });
}
