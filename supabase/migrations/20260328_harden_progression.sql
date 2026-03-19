-- ═══════════════════════════════════════════════════════════════
-- Harden Skill Progression Loop
-- 1. Unique constraint on achievements to prevent duplicates
-- ═══════════════════════════════════════════════════════════════

-- Prevent duplicate achievements per user per path.
-- The fire-and-forget insert and race conditions could create duplicates
-- without this constraint. Uses DO block for safety (if already exists).
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'unique_achievement_user_path'
  ) THEN
    ALTER TABLE fp_achievements
      ADD CONSTRAINT unique_achievement_user_path UNIQUE(user_id, path_id);
  END IF;
END $$;
