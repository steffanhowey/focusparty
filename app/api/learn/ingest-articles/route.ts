import { NextResponse } from "next/server";
import { discoverArticlesFromSignals } from "@/lib/learn/articleDiscovery";
import { evaluateArticleBatch } from "@/lib/learn/articleScoring";

/**
 * GET /api/learn/ingest-articles
 *
 * Cron endpoint: discovers articles from RSS signals,
 * evaluates pending candidates, and indexes passing ones
 * into the content lake.
 *
 * Schedule: every 6 hours (0 *​/6 * * *)
 */
export async function GET(request: Request): Promise<NextResponse> {
  // Verify cron auth
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startTime = Date.now();
  const results: Record<string, unknown> = {};

  // Stage 1: Discover articles from RSS signals
  try {
    const discovery = await discoverArticlesFromSignals(40);
    results.discovery = discovery;
    console.log(
      `[learn/ingest] Discovery: ${discovery.discovered} new articles`
    );
  } catch (err) {
    console.error("[learn/ingest] Discovery failed:", err);
    results.discovery = { error: String(err) };
  }

  // Stage 2: Evaluate pending article candidates
  try {
    const evaluation = await evaluateArticleBatch(20);
    results.evaluation = evaluation;
    console.log(
      `[learn/ingest] Evaluation: ${evaluation.evaluated} evaluated, ${evaluation.indexed} indexed`
    );
  } catch (err) {
    console.error("[learn/ingest] Evaluation failed:", err);
    results.evaluation = { error: String(err) };
  }

  const durationMs = Date.now() - startTime;
  console.log(`[learn/ingest] Complete in ${durationMs}ms`);

  return NextResponse.json({
    ok: true,
    durationMs,
    ...results,
  });
}
