-- ═══════════════════════════════════════════════════════════
-- FocusParty Task System — Complete Migration
-- ═══════════════════════════════════════════════════════════

-- 1. Enums
CREATE TYPE fp_task_status AS ENUM ('todo', 'in_progress', 'done');
CREATE TYPE fp_task_priority AS ENUM ('none', 'p4', 'p3', 'p2', 'p1');

-- 2. Projects table
CREATE TABLE fp_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#7c5cfc',
  emoji text NOT NULL DEFAULT '📁',
  is_default boolean NOT NULL DEFAULT false,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX fp_projects_user_default_idx ON fp_projects (user_id) WHERE (is_default = true);
CREATE INDEX fp_projects_user_id_idx ON fp_projects (user_id);

ALTER TABLE fp_projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own projects" ON fp_projects FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own projects" ON fp_projects FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own projects" ON fp_projects FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own projects" ON fp_projects FOR DELETE USING (auth.uid() = user_id);

-- 3. Labels table
CREATE TABLE fp_labels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#7c5cfc',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX fp_labels_user_name_idx ON fp_labels (user_id, lower(name));
CREATE INDEX fp_labels_user_id_idx ON fp_labels (user_id);

ALTER TABLE fp_labels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own labels" ON fp_labels FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own labels" ON fp_labels FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own labels" ON fp_labels FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own labels" ON fp_labels FOR DELETE USING (auth.uid() = user_id);

-- 4. Tasks table
CREATE TABLE fp_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id uuid REFERENCES fp_projects(id) ON DELETE SET NULL,
  title text NOT NULL,
  status fp_task_status NOT NULL DEFAULT 'todo',
  priority fp_task_priority NOT NULL DEFAULT 'none',
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX fp_tasks_user_status_pos_idx ON fp_tasks (user_id, status, position);
CREATE INDEX fp_tasks_project_id_idx ON fp_tasks (project_id);

ALTER TABLE fp_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own tasks" ON fp_tasks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own tasks" ON fp_tasks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own tasks" ON fp_tasks FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own tasks" ON fp_tasks FOR DELETE USING (auth.uid() = user_id);

-- 5. Task-labels junction table
CREATE TABLE fp_task_labels (
  task_id uuid NOT NULL REFERENCES fp_tasks(id) ON DELETE CASCADE,
  label_id uuid NOT NULL REFERENCES fp_labels(id) ON DELETE CASCADE,
  PRIMARY KEY (task_id, label_id)
);

ALTER TABLE fp_task_labels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own task labels" ON fp_task_labels FOR SELECT
  USING (EXISTS (SELECT 1 FROM fp_tasks WHERE fp_tasks.id = task_id AND fp_tasks.user_id = auth.uid()));
CREATE POLICY "Users can insert own task labels" ON fp_task_labels FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM fp_tasks WHERE fp_tasks.id = task_id AND fp_tasks.user_id = auth.uid()));
CREATE POLICY "Users can delete own task labels" ON fp_task_labels FOR DELETE
  USING (EXISTS (SELECT 1 FROM fp_tasks WHERE fp_tasks.id = task_id AND fp_tasks.user_id = auth.uid()));

-- 6. Default project trigger
CREATE OR REPLACE FUNCTION public.fp_ensure_default_project()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.project_id IS NULL THEN
    SELECT id INTO NEW.project_id
    FROM fp_projects
    WHERE user_id = NEW.user_id AND is_default = true
    LIMIT 1;

    IF NEW.project_id IS NULL THEN
      INSERT INTO fp_projects (user_id, name, emoji, is_default)
      VALUES (NEW.user_id, 'Inbox', '📥', true)
      ON CONFLICT (user_id) WHERE (is_default = true) DO NOTHING;

      SELECT id INTO NEW.project_id
      FROM fp_projects
      WHERE user_id = NEW.user_id AND is_default = true
      LIMIT 1;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER fp_tasks_ensure_default_project
  BEFORE INSERT ON fp_tasks
  FOR EACH ROW EXECUTE FUNCTION fp_ensure_default_project();

-- 7. Enable realtime for tasks
ALTER PUBLICATION supabase_realtime ADD TABLE fp_tasks;
