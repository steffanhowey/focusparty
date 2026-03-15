-- ============================================================
-- Migration: Add onboarding profile columns for function/fluency personalization
-- Used by: app/onboard/page.tsx (steps 1-3 write these, step 4 finalizes)
-- ============================================================

-- 1. Professional function + fluency columns
ALTER TABLE public.fp_profiles
  ADD COLUMN IF NOT EXISTS primary_function TEXT,
  ADD COLUMN IF NOT EXISTS secondary_functions JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS fluency_level TEXT;

-- 2. Constrain to valid enum values
ALTER TABLE public.fp_profiles
  ADD CONSTRAINT fp_profiles_primary_function_valid
  CHECK (
    primary_function IS NULL
    OR primary_function IN (
      'engineering', 'marketing', 'design', 'product',
      'data_analytics', 'sales_revenue', 'operations'
    )
  );

ALTER TABLE public.fp_profiles
  ADD CONSTRAINT fp_profiles_fluency_level_valid
  CHECK (
    fluency_level IS NULL
    OR fluency_level IN ('exploring', 'practicing', 'proficient', 'advanced')
  );

-- 3. Path recommendation from onboarding step 3
ALTER TABLE public.fp_profiles
  ADD COLUMN IF NOT EXISTS recommended_first_path_id TEXT;

-- 4. Indexes for common queries (room matching, path adaptation)
CREATE INDEX IF NOT EXISTS idx_fp_profiles_primary_function
  ON public.fp_profiles (primary_function)
  WHERE primary_function IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_fp_profiles_fluency_level
  ON public.fp_profiles (fluency_level)
  WHERE fluency_level IS NOT NULL;

-- 5. Notify PostgREST to pick up schema changes
NOTIFY pgrst, 'reload schema';
