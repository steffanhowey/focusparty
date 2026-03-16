-- ═══════════════════════════════════════════════════════════════
-- User Skills — the skill graph data store
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE fp_user_skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  skill_id UUID NOT NULL REFERENCES fp_skills(id),
  fluency_level TEXT NOT NULL DEFAULT 'exploring'
    CHECK (fluency_level IN ('exploring', 'practicing', 'proficient', 'advanced')),
  paths_completed INT NOT NULL DEFAULT 0,
  missions_completed INT NOT NULL DEFAULT 0,
  avg_score NUMERIC(5,2) DEFAULT NULL,
  total_scored_missions INT NOT NULL DEFAULT 0,
  first_demonstrated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_demonstrated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, skill_id)
);

CREATE INDEX idx_user_skills_user ON fp_user_skills(user_id);
CREATE INDEX idx_user_skills_skill ON fp_user_skills(skill_id);
CREATE INDEX idx_user_skills_fluency ON fp_user_skills(user_id, fluency_level);

-- RLS: users can read their own; server writes via admin client
ALTER TABLE fp_user_skills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_skills_select" ON fp_user_skills
  FOR SELECT USING (auth.uid() = user_id);
