// ─── Signal Collection Health API ────────────────────────────
// GET: Health dashboard data for signal collection monitoring.

import { NextResponse } from "next/server";
import { verifyAdminAuth } from "@/lib/admin/verifyAdminAuth";
import { createClient } from "@/lib/supabase/admin";
import { SIGNAL_SOURCES } from "@/lib/signals/config";

/**
 * GET /api/admin/signals/health — Signal collection health overview.
 * Returns last run per source, 24h signal counts, error summary, uptime.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const isAdmin = await verifyAdminAuth(request);
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient();
  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

  try {
    // Last run per source
    const sourceHealthPromises = Object.keys(SIGNAL_SOURCES).map(async (source) => {
      const { data: lastRun } = await supabase
        .from("fp_signal_collection_runs")
        .select("*")
        .eq("source", source)
        .order("started_at", { ascending: false })
        .limit(1)
        .single();

      // 24h signal count for this source
      const { count: signalCount24h } = await supabase
        .from("fp_signals")
        .select("*", { count: "exact", head: true })
        .eq("source", source)
        .gte("created_at", oneDayAgo);

      // 7d uptime: % of runs that completed
      const { data: recentRuns } = await supabase
        .from("fp_signal_collection_runs")
        .select("status")
        .eq("source", source)
        .gte("started_at", sevenDaysAgo);

      const totalRuns = recentRuns?.length ?? 0;
      const completedRuns = recentRuns?.filter((r) => r.status === "completed").length ?? 0;
      const uptime = totalRuns > 0 ? Math.round((completedRuns / totalRuns) * 100) : null;

      return {
        source,
        enabled: SIGNAL_SOURCES[source].enabled,
        frequencyMinutes: SIGNAL_SOURCES[source].frequencyMinutes,
        lastRun: lastRun ?? null,
        signalCount24h: signalCount24h ?? 0,
        uptime7d: uptime,
        totalRuns7d: totalRuns,
      };
    });

    const sourceHealth = await Promise.all(sourceHealthPromises);

    // Total signals in last 24h
    const { count: totalSignals24h } = await supabase
      .from("fp_signals")
      .select("*", { count: "exact", head: true })
      .gte("created_at", oneDayAgo);

    return NextResponse.json({
      sources: sourceHealth,
      totalSignals24h: totalSignals24h ?? 0,
      timestamp: now.toISOString(),
    });
  } catch (err) {
    console.error("[admin/signals/health] error:", err);
    return NextResponse.json(
      { error: "Failed to fetch health data" },
      { status: 500 }
    );
  }
}
