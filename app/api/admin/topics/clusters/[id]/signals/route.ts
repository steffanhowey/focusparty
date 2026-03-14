// ─── Cluster Signals API ─────────────────────────────────────
// GET: Signals for a specific topic cluster

import { NextResponse } from "next/server";
import { verifyAdminAuth } from "@/lib/admin/verifyAdminAuth";
import { createClient } from "@/lib/supabase/admin";

/**
 * GET /api/admin/topics/clusters/[id]/signals — Get signals for a cluster.
 * Returns recent signals sorted by created_at descending.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const isAdmin = await verifyAdminAuth(request);
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const url = new URL(request.url);
  const limit = parseInt(url.searchParams.get("limit") ?? "50", 10);

  const supabase = createClient();

  // Fetch cluster details
  const { data: cluster, error: clusterErr } = await supabase
    .from("fp_topic_clusters")
    .select(`
      *,
      topic:fp_topic_taxonomy(*)
    `)
    .eq("id", id)
    .single();

  if (clusterErr || !cluster) {
    return NextResponse.json({ error: "Cluster not found" }, { status: 404 });
  }

  // Fetch signals for this cluster
  const { data: signals, error: signalsErr } = await supabase
    .from("fp_signals")
    .select("*")
    .eq("topic_cluster_id", id)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (signalsErr) {
    console.error("[admin/topics/clusters/signals] fetch error:", signalsErr);
    return NextResponse.json(
      { error: "Failed to fetch signals" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    cluster,
    signals: signals ?? [],
    total: (signals ?? []).length,
  });
}
