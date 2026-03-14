// ─── Shelf Reorder API ───────────────────────────────────────

import { requireAdmin, isAdminError } from "@/lib/admin/requireAdmin";
import { createClient } from "@/lib/supabase/admin";

/**
 * PATCH /api/admin/content/shelf/reorder
 * Batch update sort_order for shelf items.
 */
export async function PATCH(request: Request): Promise<Response> {
  const auth = await requireAdmin();
  if (isAdminError(auth)) return auth;

  let body: { items?: Array<{ videoId: string; sortOrder: number }> } = {};
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!body.items || !Array.isArray(body.items) || body.items.length === 0) {
    return Response.json({ error: "items array required" }, { status: 400 });
  }

  const supabase = createClient();
  const errors: string[] = [];

  for (const item of body.items) {
    const { error } = await supabase
      .from("fp_break_content_items")
      .update({
        sort_order: item.sortOrder,
        updated_at: new Date().toISOString(),
      })
      .eq("video_id", item.videoId);

    if (error) errors.push(`${item.videoId}: ${error.message}`);
  }

  if (errors.length > 0) {
    return Response.json({
      ok: false,
      error: `Failed to update ${errors.length} items`,
      details: errors,
    }, { status: 500 });
  }

  return Response.json({ ok: true, updated: body.items.length });
}
