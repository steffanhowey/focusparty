-- Stage-level run log for benchmark, prototype, shadow, and production generation.

CREATE TABLE fp_mission_generation_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluation_mode TEXT NOT NULL CHECK (evaluation_mode IN ('benchmark', 'prototype', 'shadow', 'production')),
  topic_slug TEXT NOT NULL,
  source_packet_id UUID NULL REFERENCES fp_source_packets(id),
  editorial_decision_id UUID NULL REFERENCES fp_mission_editorial_decisions(id),
  mission_brief_id UUID NULL REFERENCES fp_mission_briefs(id),
  editorial_key TEXT NOT NULL,
  stable_key TEXT NULL,
  professional_function TEXT NOT NULL,
  fluency_level TEXT NOT NULL,
  current_stage TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('running', 'completed', 'rejected', 'failed', 'skipped')),
  input_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  stage_results JSONB NOT NULL DEFAULT '{}'::jsonb,
  output_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  reject_reasons TEXT[] NOT NULL DEFAULT '{}'::text[],
  error JSONB NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE fp_mission_generation_runs ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_mission_generation_runs_mode
  ON fp_mission_generation_runs(evaluation_mode, started_at DESC);

CREATE INDEX idx_mission_generation_runs_status_stage
  ON fp_mission_generation_runs(status, current_stage, started_at DESC);

CREATE INDEX idx_mission_generation_runs_editorial_key
  ON fp_mission_generation_runs(editorial_key, started_at DESC);

CREATE INDEX idx_mission_generation_runs_packet
  ON fp_mission_generation_runs(source_packet_id, started_at DESC);
