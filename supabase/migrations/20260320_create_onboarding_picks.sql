-- Editorial onboarding picks: pre-curated path recommendations
-- displayed during onboarding Step 3 ("Here's where you start").
-- 7 functions × 4 fluency levels = 28 hero picks, plus optional "also for you" picks.

CREATE TABLE fp_onboarding_picks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  function TEXT NOT NULL CHECK (function IN (
    'engineering', 'marketing', 'design', 'product',
    'data_analytics', 'sales_revenue', 'operations'
  )),
  fluency_level TEXT NOT NULL CHECK (fluency_level IN (
    'exploring', 'practicing', 'proficient', 'advanced'
  )),
  path_topic TEXT NOT NULL,
  display_title TEXT NOT NULL,
  display_description TEXT NOT NULL,
  time_estimate_min INTEGER NOT NULL DEFAULT 35,
  module_count INTEGER NOT NULL DEFAULT 4,
  tool_names TEXT[] DEFAULT '{}',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(function, fluency_level, sort_order)
);

-- Enable RLS
ALTER TABLE fp_onboarding_picks ENABLE ROW LEVEL SECURITY;

-- Publicly readable (unauthenticated users see picks during onboarding)
CREATE POLICY "Onboarding picks are publicly readable"
  ON fp_onboarding_picks FOR SELECT
  USING (true);

-- Index for the primary lookup pattern
CREATE INDEX idx_onboarding_picks_lookup
  ON fp_onboarding_picks(function, fluency_level, sort_order);
