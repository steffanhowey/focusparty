// ─── Reject Auto-Generated Blueprint ─────────────────────────

import { verifyAdminAuth } from "@/lib/admin/verifyAdminAuth";
import { createClient } from "@/lib/supabase/admin";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  if (!(await verifyAdminAuth(request))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  let notes: string | undefined;
  try {
    const body = await request.json();
    notes = body.notes;
  } catch {
    // No notes provided
  }

  const supabase = createClient();

  // Verify blueprint exists and is auto-generated
  const { data: bp, error: fetchError } = await supabase
    .from("fp_room_blueprints")
    .select("id, generation_source")
    .eq("id", id)
    .single();

  if (fetchError || !bp) {
    return Response.json({ error: "Blueprint not found" }, { status: 404 });
  }

  if (bp.generation_source !== "auto") {
    return Response.json({ error: "Not an auto-generated blueprint" }, { status: 400 });
  }

  const { error: updateError } = await supabase
    .from("fp_room_blueprints")
    .update({
      review_status: "rejected",
      review_notes: notes ?? null,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (updateError) {
    return Response.json({ error: updateError.message }, { status: 500 });
  }

  return Response.json({ ok: true, blueprintId: id, reviewStatus: "rejected" });
}
