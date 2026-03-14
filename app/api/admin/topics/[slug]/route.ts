// ─── Admin Topic Detail API ──────────────────────────────────
// PATCH: Update a topic by slug

import { NextResponse } from "next/server";
import { verifyAdminAuth } from "@/lib/admin/verifyAdminAuth";
import { createClient } from "@/lib/supabase/admin";
import { invalidateCache } from "@/lib/topics/taxonomy";

/**
 * PATCH /api/admin/topics/[slug] — Update a topic.
 * Body: partial fields (name, category, aliases, status, description)
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
): Promise<NextResponse> {
  const isAdmin = await verifyAdminAuth(request);
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { slug } = await params;

  try {
    const body = await request.json();
    const { name, category, aliases, status, description } = body as {
      name?: string;
      category?: string;
      aliases?: string[];
      status?: string;
      description?: string;
    };

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (name !== undefined) updates.name = name;
    if (category !== undefined) updates.category = category;
    if (aliases !== undefined) updates.aliases = aliases;
    if (status !== undefined) updates.status = status;
    if (description !== undefined) updates.description = description;

    const supabase = createClient();
    const { data, error } = await supabase
      .from("fp_topic_taxonomy")
      .update(updates)
      .eq("slug", slug)
      .select()
      .single();

    if (error) {
      console.error("[admin/topics] update error:", error);
      return NextResponse.json({ error: "Failed to update topic" }, { status: 500 });
    }

    invalidateCache();

    return NextResponse.json({ ok: true, topic: data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
