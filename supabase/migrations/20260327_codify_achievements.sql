-- ═══════════════════════════════════════════════════════════════
-- Retroactive migration: codify fp_achievements
-- This table already exists at runtime (created pre-migration).
-- This migration documents the schema and adds skill_receipt column.
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS fp_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  path_id UUID NOT NULL,
  progress_id UUID DEFAULT NULL,
  path_title TEXT NOT NULL DEFAULT '',
  path_topics TEXT[] DEFAULT '{}',
  items_completed INT NOT NULL DEFAULT 0,
  time_invested_seconds INT NOT NULL DEFAULT 0,
  difficulty_level TEXT NOT NULL DEFAULT 'intermediate',
  share_slug TEXT UNIQUE NOT NULL,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_achievements_user') THEN
    CREATE INDEX idx_achievements_user ON fp_achievements(user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_achievements_slug') THEN
    CREATE INDEX idx_achievements_slug ON fp_achievements(share_slug);
  END IF;
END $$;

-- RLS: publicly readable (for share pages), user can insert own
ALTER TABLE fp_achievements ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'achievements_select' AND tablename = 'fp_achievements') THEN
    CREATE POLICY achievements_select ON fp_achievements FOR SELECT USING (true);
  END IF;
END $$;

-- ── Add skill_receipt JSONB column ───────────────────────────
-- Stores the exact skill receipt computed at path completion time.
-- This preserves the precise before/after snapshot that can't be
-- reconstructed later from fp_user_skills current state.
ALTER TABLE fp_achievements
  ADD COLUMN IF NOT EXISTS skill_receipt JSONB DEFAULT NULL;
