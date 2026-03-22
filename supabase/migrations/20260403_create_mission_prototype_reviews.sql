-- Mandatory persisted artifact after the narrow prototype slice.

CREATE TABLE fp_mission_prototype_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prototype_key TEXT NOT NULL UNIQUE,
  audience_function TEXT NOT NULL,
  fluency_level TEXT NOT NULL,
  topic_slugs TEXT[] NOT NULL DEFAULT '{}'::text[],
  family_scope TEXT[] NOT NULL DEFAULT '{}'::text[],
  benchmark_version TEXT NOT NULL,
  reviewed_brief_ids UUID[] NOT NULL DEFAULT '{}'::uuid[],
  run_refs JSONB NOT NULL DEFAULT '[]'::jsonb,
  source_packet_count INT NOT NULL DEFAULT 0,
  mission_ready_packet_count INT NOT NULL DEFAULT 0,
  editorial_generate_now_count INT NOT NULL DEFAULT 0,
  brief_generated_count INT NOT NULL DEFAULT 0,
  brief_pass_count INT NOT NULL DEFAULT 0,
  brief_fail_count INT NOT NULL DEFAULT 0,
  essential_fields TEXT[] NOT NULL DEFAULT '{}'::text[],
  dead_weight_fields TEXT[] NOT NULL DEFAULT '{}'::text[],
  promote_to_tier1_fields TEXT[] NOT NULL DEFAULT '{}'::text[],
  unstable_family_decisions JSONB NOT NULL DEFAULT '[]'::jsonb,
  reject_reason_frequency JSONB NOT NULL DEFAULT '{}'::jsonb,
  generic_brief_findings JSONB NOT NULL DEFAULT '[]'::jsonb,
  required_changes JSONB NOT NULL DEFAULT '[]'::jsonb,
  report JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE fp_mission_prototype_reviews ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_mission_prototype_reviews_created
  ON fp_mission_prototype_reviews(created_at DESC);
