// ─── Admin Topics API ────────────────────────────────────────
// GET: List all topics (filterable by category, status, search)
// POST: Create a new topic

import { NextResponse } from "next/server";
import { verifyAdminAuth } from "@/lib/admin/verifyAdminAuth";
import { createClient } from "@/lib/supabase/admin";
import { createTopic, invalidateCache } from "@/lib/topics/taxonomy";

/**
 * GET /api/admin/topics — List topics from taxonomy.
 * Query params: category, status, search
 */
export async function GET(request: Request): Promise<NextResponse> {
  const isAdmin = await verifyAdminAuth(request);
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const category = url.searchParams.get("category");
  const status = url.searchParams.get("status");
  const search = url.searchParams.get("search");

  const supabase = createClient();
  let query = supabase
    .from("fp_topic_taxonomy")
    .select("*")
    .order("category")
    .order("slug");

  if (category) {
    query = query.eq("category", category);
  }
  if (status) {
    query = query.eq("status", status);
  }
  if (search) {
    // Search name, slug, and aliases
    query = query.or(
      `slug.ilike.%${search}%,name.ilike.%${search}%`
    );
  }

  const { data, error } = await query;

  if (error) {
    console.error("[admin/topics] fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch topics" }, { status: 500 });
  }

  return NextResponse.json({ topics: data ?? [], total: (data ?? []).length });
}

/**
 * POST /api/admin/topics — Create a new topic.
 * Body: { slug, name, category, description?, aliases?, parentId? }
 */
export async function POST(request: Request): Promise<NextResponse> {
  const isAdmin = await verifyAdminAuth(request);
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { slug, name, category, description, aliases, parentId } = body as {
      slug: string;
      name: string;
      category: string;
      description?: string;
      aliases?: string[];
      parentId?: string;
    };

    if (!slug || !name || !category) {
      return NextResponse.json(
        { error: "slug, name, and category are required" },
        { status: 400 }
      );
    }

    const topic = await createTopic({
      slug,
      name,
      category,
      description,
      aliases,
      parentId,
    });

    return NextResponse.json({ ok: true, topic });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[admin/topics] create error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
