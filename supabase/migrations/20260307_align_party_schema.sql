-- Rename created_by → creator_id to match app code
ALTER TABLE public.fp_parties RENAME COLUMN created_by TO creator_id;

-- Add missing columns to fp_parties
ALTER TABLE public.fp_parties
  ADD COLUMN IF NOT EXISTS character TEXT NOT NULL DEFAULT 'ember',
  ADD COLUMN IF NOT EXISTS planned_duration_min INTEGER NOT NULL DEFAULT 25,
  ADD COLUMN IF NOT EXISTS max_participants INTEGER NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'waiting';

-- Add missing column to fp_party_participants
ALTER TABLE public.fp_party_participants
  ADD COLUMN IF NOT EXISTS left_at TIMESTAMPTZ DEFAULT NULL;

-- Update RLS policies that reference old column name
DROP POLICY IF EXISTS "Authenticated users can create parties" ON public.fp_parties;
CREATE POLICY "Authenticated users can create parties"
  ON public.fp_parties FOR INSERT
  WITH CHECK (auth.uid() = creator_id);

DROP POLICY IF EXISTS "Party creator can delete" ON public.fp_parties;
CREATE POLICY "Party creator can delete"
  ON public.fp_parties FOR DELETE
  USING (auth.uid() = creator_id);

DROP POLICY IF EXISTS "Party creator can update" ON public.fp_parties;
CREATE POLICY "Party creator can update"
  ON public.fp_parties FOR UPDATE
  USING (auth.uid() = creator_id);

-- Notify PostgREST
NOTIFY pgrst, 'reload schema';
