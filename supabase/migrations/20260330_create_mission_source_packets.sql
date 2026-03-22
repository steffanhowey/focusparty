-- Canonical evidence packets for mission generation.
-- Topic-scoped, reusable across audiences, and versioned by packet_hash.

CREATE TABLE fp_source_packets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id UUID NULL REFERENCES fp_topic_taxonomy(id),
  cluster_id UUID NULL REFERENCES fp_topic_clusters(id),
  topic_slug TEXT NOT NULL,
  topic_name TEXT NOT NULL,
  topic_category TEXT NOT NULL CHECK (topic_category IN ('tool', 'technique', 'concept', 'role', 'platform')),
  schema_version TEXT NOT NULL DEFAULT 'source_packet_v1',
  packet_hash TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('assembled', 'validated', 'rejected', 'superseded')),
  readiness_state TEXT NOT NULL CHECK (readiness_state IN ('tracking_only', 'watchlist_only', 'mission_ready')),
  timeliness_class TEXT NOT NULL CHECK (timeliness_class IN ('breaking-update', 'emerging-practice', 'current-standard', 'evergreen-foundation')),
  heat_score_snapshot NUMERIC(8, 3),
  freshness_score NUMERIC(5, 2) NOT NULL DEFAULT 0,
  credibility_score NUMERIC(5, 2) NOT NULL DEFAULT 0,
  completeness_score NUMERIC(5, 2) NOT NULL DEFAULT 0,
  why_now_summary TEXT,
  readiness_rationale TEXT NOT NULL DEFAULT '',
  blockers JSONB NOT NULL DEFAULT '[]'::jsonb,
  packet JSONB NOT NULL,
  assembled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  superseded_by UUID NULL REFERENCES fp_source_packets(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE fp_source_packets ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX idx_source_packets_topic_hash
  ON fp_source_packets(topic_slug, packet_hash);

CREATE INDEX idx_source_packets_topic_readiness
  ON fp_source_packets(topic_slug, readiness_state, assembled_at DESC);

CREATE INDEX idx_source_packets_cluster
  ON fp_source_packets(cluster_id, assembled_at DESC);

CREATE INDEX idx_source_packets_status_expiry
  ON fp_source_packets(status, expires_at);
