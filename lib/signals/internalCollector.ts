// ─── Internal Demand Signal Collector ────────────────────────
// Converts user behavior events (room joins, break engagement,
// goals) into demand signals. Reads from fp_internal_demand_events
// and writes to fp_signals.
//
// Note: The event instrumentation (writing to fp_internal_demand_events)
// is planned for Sprint 3. This collector is ready but will find 0
// events until then.

import { createClient } from "@/lib/supabase/admin";
import { SIGNAL_SOURCES } from "@/lib/signals/config";
import type { RawSignal, CollectionResult } from "@/lib/signals/types";
import {
  insertSignals,
  startCollectionRun,
  completeCollectionRun,
} from "@/lib/signals/insertSignals";

const SOURCE = "internal";

// ─── Event → Engagement Score Mapping ───────────────────────

const EVENT_ENGAGEMENT: Record<string, number> = {
  room_join: 0.3,
  break_completed: 0.6,
  break_extended: 0.8,
  goal_set: 0.4,
};

// ─── Collector ──────────────────────────────────────────────

/**
 * Collect internal user demand signals from fp_internal_demand_events.
 * Converts unprocessed events into fp_signals rows, then marks them processed.
 */
export async function collectInternalSignals(): Promise<CollectionResult> {
  const start = Date.now();
  const config = SIGNAL_SOURCES[SOURCE];
  const errors: string[] = [];

  const runId = await startCollectionRun(SOURCE);

  const supabase = createClient();

  try {
    // Fetch unprocessed events
    const { data: events, error: fetchErr } = await supabase
      .from("fp_internal_demand_events")
      .select("*")
      .eq("processed", false)
      .order("created_at", { ascending: true })
      .limit(config.maxSignalsPerRun);

    if (fetchErr) {
      throw new Error(`Failed to fetch events: ${fetchErr.message}`);
    }

    if (!events || events.length === 0) {
      await completeCollectionRun(runId, {
        status: "completed",
        signalsCollected: 0,
        signalsDeduplicated: 0,
        errors: [],
      });

      return {
        source: SOURCE,
        collected: 0,
        deduplicated: 0,
        inserted: 0,
        errors: [],
        durationMs: Date.now() - start,
      };
    }

    // Convert events to signals
    const signals: RawSignal[] = [];
    for (const event of events) {
      const engagement = EVENT_ENGAGEMENT[event.event_type] ?? 0.3;

      signals.push({
        source: SOURCE,
        source_id: `internal:${event.id}`,
        source_url: null,
        title: `${event.event_type}: ${event.topic_slug ?? event.world_key ?? "unknown"}`,
        summary: null,
        engagement_score: engagement,
        raw_data: {
          event_type: event.event_type,
          user_id: event.user_id,
          topic_slug: event.topic_slug,
          world_key: event.world_key,
          metadata: event.metadata,
          event_created_at: event.created_at,
        },
      });
    }

    const { inserted, deduplicated } = await insertSignals(signals);

    // Mark events as processed
    const eventIds = events.map((e) => e.id);
    const { error: updateErr } = await supabase
      .from("fp_internal_demand_events")
      .update({ processed: true })
      .in("id", eventIds);

    if (updateErr) {
      errors.push(`Failed to mark events processed: ${updateErr.message}`);
    }

    await completeCollectionRun(runId, {
      status: "completed",
      signalsCollected: signals.length,
      signalsDeduplicated: deduplicated,
      errors,
    });

    return {
      source: SOURCE,
      collected: signals.length,
      deduplicated,
      inserted,
      errors,
      durationMs: Date.now() - start,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(msg);

    await completeCollectionRun(runId, {
      status: "failed",
      signalsCollected: 0,
      signalsDeduplicated: 0,
      errors,
    });

    return {
      source: SOURCE,
      collected: 0,
      deduplicated: 0,
      inserted: 0,
      errors,
      durationMs: Date.now() - start,
    };
  }
}
