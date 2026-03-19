ALTER TABLE IF EXISTS public.fp_goals
  ADD COLUMN IF NOT EXISTS linked_path_id UUID REFERENCES public.fp_learning_paths(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS fp_goals_user_linked_path_idx
  ON public.fp_goals (user_id, linked_path_id);
