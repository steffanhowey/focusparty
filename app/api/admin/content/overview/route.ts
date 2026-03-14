// ─── Content Pipeline Overview ───────────────────────────────

import { requireAdmin, isAdminError } from "@/lib/admin/requireAdmin";
import { createClient } from "@/lib/supabase/admin";

/**
 * GET /api/admin/content/overview
 * Returns funnel stats: candidates → evaluated → scaffolded → on shelf.
 */
export async function GET(): Promise<Response> {
  const auth = await requireAdmin();
  if (isAdminError(auth)) return auth;

  const supabase = createClient();

  const [candidates, evaluated, scaffolded, shelf] = await Promise.all([
    supabase
      .from("fp_break_content_candidates")
      .select("id", { count: "exact", head: true }),
    supabase
      .from("fp_break_content_scores")
      .select("id", { count: "exact", head: true }),
    supabase
      .from("fp_break_content_candidates")
      .select("id", { count: "exact", head: true })
      .eq("scaffolding_status", "completed"),
    supabase
      .from("fp_break_content_items")
      .select("id", { count: "exact", head: true }),
  ]);

  return Response.json({
    ok: true,
    funnel: {
      candidates: candidates.count ?? 0,
      evaluated: evaluated.count ?? 0,
      scaffolded: scaffolded.count ?? 0,
      onShelf: shelf.count ?? 0,
    },
  });
}
