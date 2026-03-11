// ─── Batch Candidate Evaluator ──────────────────────────────
// Fetches pending candidates, scores them with AI, and persists
// scores + status updates to the database.

import { createClient } from "@/lib/supabase/admin";
import { evaluateCandidate } from "./scoring";
import type { BreakContentCandidate } from "@/lib/types";

interface BatchResult {
  evaluated: number;
  rejected: number;
  errors: number;
}

/**
 * Evaluate up to `limit` pending candidates.
 * If worldKey is provided, only evaluates that world.
 * Processes sequentially to respect OpenAI rate limits.
 */
export async function evaluatePendingCandidates(
  worldKey?: string,
  limit = 10
): Promise<BatchResult> {
  const supabase = createClient();

  // Fetch pending candidates (oldest first)
  let query = supabase
    .from("fp_break_content_candidates")
    .select("*")
    .eq("status", "pending")
    .order("discovered_at", { ascending: true })
    .limit(limit);

  if (worldKey) {
    query = query.eq("world_key", worldKey);
  }

  const { data: candidates, error: fetchErr } = await query;
  if (fetchErr) {
    console.error("[breaks/evaluate] fetch error:", fetchErr);
    return { evaluated: 0, rejected: 0, errors: 1 };
  }

  if (!candidates || candidates.length === 0) {
    console.log("[breaks/evaluate] No pending candidates");
    return { evaluated: 0, rejected: 0, errors: 0 };
  }

  console.log(
    `[breaks/evaluate] Processing ${candidates.length} candidates`
  );

  // Fetch current shelf titles per world for novelty context
  const worldKeys = [...new Set(candidates.map((c) => c.world_key))];
  const shelfTitlesByWorld = new Map<string, string[]>();

  for (const wk of worldKeys) {
    const { data: shelfItems } = await supabase
      .from("fp_break_content_items")
      .select("title")
      .eq("room_world_key", wk)
      .eq("status", "active");
    shelfTitlesByWorld.set(
      wk,
      (shelfItems ?? []).map((i) => i.title)
    );
  }

  let evaluated = 0;
  let rejected = 0;
  let errors = 0;

  for (const candidate of candidates as BreakContentCandidate[]) {
    try {
      const shelfTitles = shelfTitlesByWorld.get(candidate.world_key) ?? [];
      const result = await evaluateCandidate(
        candidate,
        candidate.world_key,
        shelfTitles
      );

      if (result.rejected) {
        // Mark as rejected
        await supabase
          .from("fp_break_content_candidates")
          .update({ status: "rejected" })
          .eq("id", candidate.id);
        rejected++;
        console.log(
          `[breaks/evaluate] REJECTED "${candidate.title}" — ${result.evaluationNotes}`
        );
      } else {
        // Insert score
        const { error: scoreErr } = await supabase
          .from("fp_break_content_scores")
          .insert({
            candidate_id: candidate.id,
            world_key: candidate.world_key,
            taste_score: result.tasteScore,
            relevance_score: result.relevanceScore,
            engagement_score: result.engagementScore,
            educational_density: result.educationalDensity,
            creator_authority: result.creatorAuthority,
            freshness_score: result.freshnessScore,
            novelty_score: result.noveltyScore,
            evaluation_notes: result.evaluationNotes,
            editorial_note: result.editorialNote,
          });

        if (scoreErr) {
          console.error("[breaks/evaluate] score insert error:", scoreErr);
          errors++;
          continue;
        }

        // Mark candidate as evaluated
        await supabase
          .from("fp_break_content_candidates")
          .update({ status: "evaluated" })
          .eq("id", candidate.id);

        evaluated++;
        console.log(
          `[breaks/evaluate] SCORED "${candidate.title}" → ${result.tasteScore} — ${result.evaluationNotes}`
        );
      }
    } catch (err) {
      console.error(
        `[breaks/evaluate] error on "${candidate.title}":`,
        err
      );
      errors++;
    }
  }

  console.log(
    `[breaks/evaluate] Done: ${evaluated} evaluated, ${rejected} rejected, ${errors} errors`
  );

  return { evaluated, rejected, errors };
}
