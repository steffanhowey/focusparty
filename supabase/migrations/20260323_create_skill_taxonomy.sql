-- ═══════════════════════════════════════════════════════════════
-- Skill Taxonomy Tables
-- Three-axis model: Skills × Functions × Fluency
-- ═══════════════════════════════════════════════════════════════

-- Skill Domains: 8 high-level categories of capability
CREATE TABLE fp_skill_domains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT 'star',
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Skills: 40-60 discrete, assessable capabilities within domains
CREATE TABLE fp_skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain_id UUID NOT NULL REFERENCES fp_skill_domains(id),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  relevant_functions TEXT[] DEFAULT '{}',
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_skills_domain ON fp_skills(domain_id);
CREATE INDEX idx_skills_slug ON fp_skills(slug);

-- Skill tags on learning paths: which skills a path develops
CREATE TABLE fp_skill_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  path_id UUID NOT NULL,
  skill_id UUID NOT NULL REFERENCES fp_skills(id),
  relevance TEXT NOT NULL DEFAULT 'primary'
    CHECK (relevance IN ('primary', 'secondary')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(path_id, skill_id)
);

CREATE INDEX idx_skill_tags_path ON fp_skill_tags(path_id);
CREATE INDEX idx_skill_tags_skill ON fp_skill_tags(skill_id);

-- RLS: all three are publicly readable reference data
ALTER TABLE fp_skill_domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE fp_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE fp_skill_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "skill_domains_read" ON fp_skill_domains
  FOR SELECT USING (true);

CREATE POLICY "skills_read" ON fp_skills
  FOR SELECT USING (true);

CREATE POLICY "skill_tags_read" ON fp_skill_tags
  FOR SELECT USING (true);
