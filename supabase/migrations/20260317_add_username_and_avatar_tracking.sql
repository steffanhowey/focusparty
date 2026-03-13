-- ============================================================
-- Migration: Add username (@handle) system + avatar generation tracking
-- ============================================================

-- 1. Add username column to fp_profiles
ALTER TABLE public.fp_profiles
  ADD COLUMN IF NOT EXISTS username TEXT;

-- 2. Case-insensitive unique index
CREATE UNIQUE INDEX IF NOT EXISTS fp_profiles_username_unique
  ON public.fp_profiles (LOWER(username));

-- 3. Format constraint: starts with letter, 3-20 chars, lowercase alphanumeric + underscores
ALTER TABLE public.fp_profiles
  ADD CONSTRAINT fp_profiles_username_format
  CHECK (
    username IS NULL
    OR username ~ '^[a-z][a-z0-9_]{2,19}$'
  );

-- 4. Avatar generation tracking columns
ALTER TABLE public.fp_profiles
  ADD COLUMN IF NOT EXISTS avatar_seed TEXT,
  ADD COLUMN IF NOT EXISTS avatar_style_version INT DEFAULT 1;

-- 5. Reserved usernames table (synthetic handles + system names)
CREATE TABLE IF NOT EXISTS public.fp_reserved_usernames (
  username TEXT PRIMARY KEY
);

INSERT INTO public.fp_reserved_usernames (username)
VALUES
  -- Synthetic participant handles
  ('kai'), ('rio'), ('dev'), ('sage'), ('ellis'), ('wren'),
  ('ava'), ('noor'), ('quinn'), ('lux'), ('sol'), ('fern'),
  -- System / brand reserves
  ('admin'), ('focusparty'), ('skillgap'), ('system'), ('host'), ('support'),
  ('help'), ('null'), ('undefined'), ('anonymous'), ('guest'),
  ('moderator'), ('mod'), ('bot'), ('official'), ('staff')
ON CONFLICT DO NOTHING;

-- 6. RLS for reserved usernames (anyone authenticated can read)
ALTER TABLE public.fp_reserved_usernames ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read reserved usernames"
  ON public.fp_reserved_usernames FOR SELECT
  TO authenticated
  USING (true);

-- 7. Ensure fp_profiles RLS allows users to read all profiles (for @mention lookup)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'fp_profiles'
    AND policyname = 'Users can read all profiles'
  ) THEN
    CREATE POLICY "Users can read all profiles"
      ON public.fp_profiles FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END;
$$;

-- 8. Ensure fp_profiles RLS allows users to update own profile
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'fp_profiles'
    AND policyname = 'Users can update own profile'
  ) THEN
    CREATE POLICY "Users can update own profile"
      ON public.fp_profiles FOR UPDATE
      TO authenticated
      USING (id = auth.uid())
      WITH CHECK (id = auth.uid());
  END IF;
END;
$$;

NOTIFY pgrst, 'reload schema';
