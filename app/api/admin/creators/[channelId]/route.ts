// ─── Creator Detail + Update ─────────────────────────────────

import { verifyAdminAuth } from "@/lib/admin/verifyAdminAuth";
import { getCreatorByChannelId } from "@/lib/creators/catalog";
import { createClient } from "@/lib/supabase/admin";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ channelId: string }> }
): Promise<Response> {
  if (!(await verifyAdminAuth(request))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { channelId } = await params;
  const creator = await getCreatorByChannelId(channelId);
  if (!creator) {
    return Response.json({ error: "Creator not found" }, { status: 404 });
  }

  return Response.json({ ok: true, creator });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ channelId: string }> }
): Promise<Response> {
  if (!(await verifyAdminAuth(request))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { channelId } = await params;

  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Allowlist of updatable fields
  const allowedFields = [
    "partnership_status",
    "notes",
    "topic_specialties",
  ];
  const updates: Record<string, unknown> = {};
  for (const field of allowedFields) {
    if (field in body) {
      updates[field] = body[field];
    }
  }

  if (Object.keys(updates).length === 0) {
    return Response.json({ error: "No valid fields to update" }, { status: 400 });
  }

  updates.updated_at = new Date().toISOString();

  const supabase = createClient();
  const { error } = await supabase
    .from("fp_creators")
    .update(updates)
    .eq("channel_id", channelId);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  const creator = await getCreatorByChannelId(channelId);
  return Response.json({ ok: true, creator });
}
