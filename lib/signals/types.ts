// ─── Signal Collection Types ────────────────────────────────
// Shared types for multi-source signal collectors.

// ─── Raw Signal ─────────────────────────────────────────────

/** A signal ready for insertion into fp_signals. */
export interface RawSignal {
  source: string;
  source_id: string;
  source_url: string | null;
  title: string;
  summary: string | null;
  engagement_score: number; // 0–1 normalized
  raw_data: Record<string, unknown>;
}

// ─── Collection Result ──────────────────────────────────────

/** Summary returned by each collector after a run. */
export interface CollectionResult {
  source: string;
  collected: number;
  deduplicated: number;
  inserted: number;
  errors: string[];
  durationMs: number;
}
