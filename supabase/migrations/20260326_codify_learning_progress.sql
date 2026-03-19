-- ═══════════════════════════════════════════════════════════════
-- Retroactive migration: codify fp_learning_progress
-- This table already exists at runtime (created pre-migration).
-- This migration documents the schema as code.
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS fp_learning_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  path_id UUID NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ DEFAULT NULL,
  current_item_index INT NOT NULL DEFAULT 0,
  items_completed INT NOT NULL DEFAULT 0,
  items_total INT NOT NULL DEFAULT 0,
  time_invested_seconds INT NOT NULL DEFAULT 0,
  item_states JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'in_progress'
    CHECK (status IN ('in_progress', 'completed', 'abandoned')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes (IF NOT EXISTS not supported for indexes, so wrap in DO block)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_learning_progress_user') THEN
    CREATE INDEX idx_learning_progress_user ON fp_learning_progress(user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_learning_progress_path') THEN
    CREATE INDEX idx_learning_progress_path ON fp_learning_progress(path_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_learning_progress_user_path') THEN
    CREATE UNIQUE INDEX idx_learning_progress_user_path ON fp_learning_progress(user_id, path_id);
  END IF;
END $$;

-- RLS
ALTER TABLE fp_learning_progress ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'learning_progress_select' AND tablename = 'fp_learning_progress') THEN
    CREATE POLICY learning_progress_select ON fp_learning_progress
      FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;
