// ─── Shelf Item Toggle API ───────────────────────────────────

import { requireAdmin, isAdminError } from "@/lib/admin/requireAdmin";
import { createClient } from "@/lib/supabase/admin";

/**
 * PATCH /api/admin/content/[videoId]/shelf
 * Toggle pin status or update position for a shelf item.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ videoId: string }> }
): Promise<Response> {
  const auth = await requireAdmin();
  if (isAdminError(auth)) return auth;

  const { videoId } = await params;

  let body: { pinned?: boolean; position?: number } = {};
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const supabase = createClient();

  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (body.pinned !== undefined) updates.pinned = body.pinned;
  if (body.position !== undefined) updates.position = body.position;

  const { error } = await supabase
    .from("fp_break_content_items")
    .update(updates)
    .eq("video_id", videoId);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ ok: true, videoId, ...body });
}
