// ─── Signal Insertion Utility ────────────────────────────────
// Shared helper for all collectors to insert signals into fp_signals
// with automatic deduplication and collection run tracking.

import { createClient } from "@/lib/supabase/admin";
import type { RawSignal } from "@/lib/signals/types";

// ─── Collection Run Tracking ────────────────────────────────

/**
 * Start a collection run — creates a tracking row in fp_signal_collection_runs.
 * Returns the run ID for later completion.
 */
export async function startCollectionRun(source: string): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("fp_signal_collection_runs")
    .insert({
      source,
      status: "running",
      signals_collected: 0,
      signals_deduplicated: 0,
      errors: [],
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("[signals/insertSignals] failed to start run:", error);
    throw new Error(`Failed to start collection run for ${source}`);
  }

  return data.id;
}

/**
 * Complete a collection run — updates the tracking row with final stats.
 */
export async function completeCollectionRun(
  runId: string,
  result: {
    status: "completed" | "failed";
    signalsCollected: number;
    signalsDeduplicated: number;
    errors: string[];
  }
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("fp_signal_collection_runs")
    .update({
      status: result.status,
      signals_collected: result.signalsCollected,
      signals_deduplicated: result.signalsDeduplicated,
      errors: result.errors,
      completed_at: new Date().toISOString(),
    })
    .eq("id", runId);

  if (error) {
    console.warn("[signals/insertSignals] failed to complete run:", error);
  }
}

// ─── Signal Insertion ───────────────────────────────────────

/**
 * Insert signals into fp_signals with deduplication on source + source_id.
 * Returns counts of inserted vs deduplicated signals.
 */
export async function insertSignals(
  signals: RawSignal[]
): Promise<{ inserted: number; deduplicated: number }> {
  if (signals.length === 0) return { inserted: 0, deduplicated: 0 };

  const supabase = createClient();
  let inserted = 0;
  let deduplicated = 0;

  // Insert one at a time to handle dedup gracefully via ON CONFLICT.
  // Volume is small per run (20–40 signals) so this is fine.
  for (const signal of signals) {
    const { error } = await supabase.from("fp_signals").insert({
      source: signal.source,
      source_id: signal.source_id,
      source_url: signal.source_url,
      title: signal.title,
      summary: signal.summary,
      engagement_score: signal.engagement_score,
      raw_data: signal.raw_data,
      processed: false,
    });

    if (error) {
      if (error.code === "23505") {
        // Unique constraint violation — already exists
        deduplicated++;
      } else {
        console.warn("[signals/insertSignals] insert failed:", error.message);
      }
    } else {
      inserted++;
    }
  }

  return { inserted, deduplicated };
}

// ─── Last Run Check ─────────────────────────────────────────

/**
 * Get the most recent completed run time for a source.
 * Returns null if no previous runs exist.
 */
export async function getLastRunTime(source: string): Promise<Date | null> {
  const supabase = createClient();
  const { data } = await supabase
    .from("fp_signal_collection_runs")
    .select("started_at")
    .eq("source", source)
    .in("status", ["completed", "running"])
    .order("started_at", { ascending: false })
    .limit(1)
    .single();

  if (!data) return null;
  return new Date(data.started_at);
}
