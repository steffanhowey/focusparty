-- Compatibility linkage for canonical mission brief shadow projections.

ALTER TABLE fp_learning_paths
  ADD COLUMN IF NOT EXISTS source_mission_brief_id UUID NULL REFERENCES fp_mission_briefs(id),
  ADD COLUMN IF NOT EXISTS generation_engine TEXT NULL CHECK (generation_engine IN ('legacy_curriculum', 'mission_projection')),
  ADD COLUMN IF NOT EXISTS canonical_stable_key TEXT NULL;

CREATE INDEX IF NOT EXISTS fp_learning_paths_source_mission_brief_id_idx
  ON fp_learning_paths(source_mission_brief_id);
