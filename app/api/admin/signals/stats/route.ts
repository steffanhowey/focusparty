// ─── Signal Statistics API ───────────────────────────────────
// GET: Signal stats by source, processing rate, top topics.

import { NextResponse } from "next/server";
import { verifyAdminAuth } from "@/lib/admin/verifyAdminAuth";
import { createClient } from "@/lib/supabase/admin";

/**
 * GET /api/admin/signals/stats — Signal statistics.
 * Query params: period (24h, 7d, 30d — default 7d)
 */
export async function GET(request: Request): Promise<NextResponse> {
  const isAdmin = await verifyAdminAuth(request);
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const period = url.searchParams.get("period") ?? "7d";

  const periodMs: Record<string, number> = {
    "24h": 24 * 60 * 60 * 1000,
    "7d": 7 * 24 * 60 * 60 * 1000,
    "30d": 30 * 24 * 60 * 60 * 1000,
  };

  const ms = periodMs[period] ?? periodMs["7d"];
  const since = new Date(Date.now() - ms).toISOString();

  const supabase = createClient();

  try {
    // Signals by source for period
    const { data: periodSignals } = await supabase
      .from("fp_signals")
      .select("source")
      .gte("created_at", since);

    const bySource: Record<string, number> = {};
    for (const signal of periodSignals ?? []) {
      bySource[signal.source] = (bySource[signal.source] ?? 0) + 1;
    }

    // Total signals all time
    const { count: totalAllTime } = await supabase
      .from("fp_signals")
      .select("*", { count: "exact", head: true });

    // Processing rate (% clustered)
    const { count: totalSignals } = await supabase
      .from("fp_signals")
      .select("*", { count: "exact", head: true })
      .gte("created_at", since);

    const { count: processedSignals } = await supabase
      .from("fp_signals")
      .select("*", { count: "exact", head: true })
      .eq("processed", true)
      .gte("created_at", since);

    const processingRate =
      (totalSignals ?? 0) > 0
        ? Math.round(((processedSignals ?? 0) / (totalSignals ?? 1)) * 100)
        : 0;

    // Top clusters by signal count
    const { data: topClusters } = await supabase
      .from("fp_topic_clusters")
      .select(`
        *,
        topic:fp_topic_taxonomy(slug, name, category)
      `)
      .order("signal_count", { ascending: false })
      .limit(10);

    return NextResponse.json({
      period,
      bySource,
      totalAllTime: totalAllTime ?? 0,
      totalPeriod: totalSignals ?? 0,
      processedPeriod: processedSignals ?? 0,
      processingRate,
      topClusters: topClusters ?? [],
    });
  } catch (err) {
    console.error("[admin/signals/stats] error:", err);
    return NextResponse.json(
      { error: "Failed to fetch signal stats" },
      { status: 500 }
    );
  }
}
