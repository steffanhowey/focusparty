-- Add sign-up / onboarding columns to fp_profiles
ALTER TABLE public.fp_profiles
  ADD COLUMN IF NOT EXISTS first_name TEXT,
  ADD COLUMN IF NOT EXISTS last_name TEXT,
  ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN NOT NULL DEFAULT false;

-- Create (or replace) the trigger function that auto-creates a profile
-- when a new user signs up via Supabase Auth.
CREATE OR REPLACE FUNCTION public.handle_fp_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.fp_profiles (id, email, display_name, first_name, last_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data ->> 'display_name',
      NULLIF(TRIM(CONCAT(
        COALESCE(NEW.raw_user_meta_data ->> 'first_name', ''),
        ' ',
        COALESCE(NEW.raw_user_meta_data ->> 'last_name', '')
      )), ''),
      split_part(NEW.email, '@', 1)
    ),
    NEW.raw_user_meta_data ->> 'first_name',
    NEW.raw_user_meta_data ->> 'last_name'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger (skip if it already exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'on_auth_user_created_fp'
  ) THEN
    CREATE TRIGGER on_auth_user_created_fp
      AFTER INSERT ON auth.users
      FOR EACH ROW
      EXECUTE FUNCTION public.handle_fp_new_user();
  END IF;
END;
$$;

-- Backfill: create profiles for any existing auth users that don't have one
INSERT INTO public.fp_profiles (id, email, display_name, first_name, last_name)
SELECT
  u.id,
  u.email,
  COALESCE(
    u.raw_user_meta_data ->> 'display_name',
    NULLIF(TRIM(CONCAT(
      COALESCE(u.raw_user_meta_data ->> 'first_name', ''),
      ' ',
      COALESCE(u.raw_user_meta_data ->> 'last_name', '')
    )), ''),
    split_part(u.email, '@', 1)
  ),
  u.raw_user_meta_data ->> 'first_name',
  u.raw_user_meta_data ->> 'last_name'
FROM auth.users u
LEFT JOIN public.fp_profiles p ON p.id = u.id
WHERE p.id IS NULL;

-- Notify PostgREST to pick up schema changes
NOTIFY pgrst, 'reload schema';
