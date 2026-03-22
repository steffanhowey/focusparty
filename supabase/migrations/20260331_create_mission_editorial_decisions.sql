-- Explicit editorial decision layer between packet readiness
-- and mission generation.

CREATE TABLE fp_mission_editorial_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_packet_id UUID NOT NULL REFERENCES fp_source_packets(id),
  editorial_key TEXT NOT NULL,
  professional_function TEXT NOT NULL,
  fluency_level TEXT NOT NULL,
  decision TEXT NOT NULL CHECK (decision IN ('generate_now', 'hold', 'reject', 'supersede_existing', 'duplicate_active', 'not_priority_yet')),
  editorial_priority INT NOT NULL DEFAULT 0,
  recommended_launch_domains TEXT[] NOT NULL DEFAULT '{}'::text[],
  recommended_family_scope TEXT[] NOT NULL DEFAULT '{}'::text[],
  blocked_by_mission_brief_id UUID NULL,
  supersede_mission_brief_id UUID NULL,
  rationale TEXT NOT NULL,
  decision_context JSONB NOT NULL DEFAULT '{}'::jsonb,
  decided_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE fp_mission_editorial_decisions ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_mission_editorial_decisions_key
  ON fp_mission_editorial_decisions(editorial_key, decided_at DESC);

CREATE INDEX idx_mission_editorial_decisions_packet
  ON fp_mission_editorial_decisions(source_packet_id, decided_at DESC);

CREATE INDEX idx_mission_editorial_decisions_priority
  ON fp_mission_editorial_decisions(decision, editorial_priority DESC);
