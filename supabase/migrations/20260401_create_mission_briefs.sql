-- Canonical mission brief artifacts.
-- Stores the full brief JSON plus queryable Tier 1 fields.

CREATE TABLE fp_mission_briefs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stable_key TEXT NOT NULL,
  source_packet_id UUID NOT NULL REFERENCES fp_source_packets(id),
  editorial_decision_id UUID NOT NULL REFERENCES fp_mission_editorial_decisions(id),
  topic_slug TEXT NOT NULL,
  topic_name TEXT NOT NULL,
  professional_function TEXT NOT NULL,
  fluency_level TEXT NOT NULL,
  mission_family TEXT NOT NULL,
  artifact_type TEXT NOT NULL,
  launch_domain TEXT NOT NULL,
  best_room_key TEXT NULL,
  schema_version TEXT NOT NULL DEFAULT 'mission_brief_v2',
  brief_version INT NOT NULL DEFAULT 1,
  status TEXT NOT NULL CHECK (status IN ('draft', 'active', 'rejected', 'superseded', 'archived')),
  cache_fingerprint TEXT NOT NULL,
  source_packet_hash TEXT NOT NULL,
  source_packet_readiness_state TEXT NOT NULL CHECK (source_packet_readiness_state IN ('tracking_only', 'watchlist_only', 'mission_ready')),
  family_template_version TEXT NOT NULL DEFAULT 'prototype_v1',
  benchmark_version TEXT NOT NULL DEFAULT 'benchmark_v1',
  title TEXT NOT NULL,
  short_title TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  why_this_matters_now TEXT NOT NULL,
  why_this_matters_for_marketing TEXT NOT NULL,
  marketer_use_case TEXT NOT NULL,
  output_description TEXT NOT NULL,
  audience TEXT NOT NULL,
  format TEXT NOT NULL,
  timebox_minutes INT NOT NULL,
  hard_cap_minutes INT NOT NULL,
  quality_score NUMERIC(5, 2) NOT NULL DEFAULT 0,
  gate_decision TEXT NOT NULL CHECK (gate_decision IN ('pass', 'fail')),
  reject_reasons TEXT[] NOT NULL DEFAULT '{}'::text[],
  brief JSONB NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  supersedes_mission_brief_id UUID NULL REFERENCES fp_mission_briefs(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE fp_mission_briefs ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX idx_mission_briefs_stable_version
  ON fp_mission_briefs(stable_key, brief_version);

CREATE UNIQUE INDEX idx_mission_briefs_active_stable
  ON fp_mission_briefs(stable_key)
  WHERE status = 'active';

CREATE INDEX idx_mission_briefs_cache_fingerprint
  ON fp_mission_briefs(cache_fingerprint);

CREATE INDEX idx_mission_briefs_topic_fn_fluency
  ON fp_mission_briefs(topic_slug, professional_function, fluency_level, status);

CREATE INDEX idx_mission_briefs_launch_domain
  ON fp_mission_briefs(launch_domain, status, quality_score DESC);

CREATE INDEX idx_mission_briefs_expiry
  ON fp_mission_briefs(expires_at);
