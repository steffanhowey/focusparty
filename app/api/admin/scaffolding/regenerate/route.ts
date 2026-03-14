// ─── Scaffolding Regeneration ────────────────────────────────

import { verifyAdminAuth } from "@/lib/admin/verifyAdminAuth";
import { createClient } from "@/lib/supabase/admin";
import { generateScaffoldingBatch } from "@/lib/scaffolding/generator";

export async function POST(request: Request): Promise<Response> {
  if (!(await verifyAdminAuth(request))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { videoIds?: string[]; limit?: number } = {};
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Reset scaffolding status for specified videos
  if (body.videoIds && body.videoIds.length > 0) {
    const supabase = createClient();
    // First get candidate IDs for the video IDs
    const { data: candidates } = await supabase
      .from("fp_break_content_candidates")
      .select("id")
      .in("external_id", body.videoIds);

    if (candidates && candidates.length > 0) {
      const candidateIds = candidates.map((c) => c.id);
      await supabase
        .from("fp_break_content_scores")
        .update({ scaffolding_status: "none", scaffolding: null })
        .in("candidate_id", candidateIds);
    }
  }

  const result = await generateScaffoldingBatch({
    limit: body.limit ?? 10,
    minScore: 0,
    videoIds: body.videoIds,
  });

  return Response.json({ ok: true, ...result });
}
