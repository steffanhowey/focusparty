ALTER TABLE fp_learning_paths
  ADD COLUMN IF NOT EXISTS is_discoverable BOOLEAN;

UPDATE fp_learning_paths
SET is_discoverable = CASE
  WHEN generation_engine = 'mission_projection' THEN false
  ELSE true
END
WHERE is_discoverable IS NULL;

ALTER TABLE fp_learning_paths
  ALTER COLUMN is_discoverable SET DEFAULT true;

ALTER TABLE fp_learning_paths
  ALTER COLUMN is_discoverable SET NOT NULL;

CREATE INDEX IF NOT EXISTS fp_learning_paths_cached_discoverable_view_idx
  ON fp_learning_paths (is_cached, is_discoverable, view_count DESC);
