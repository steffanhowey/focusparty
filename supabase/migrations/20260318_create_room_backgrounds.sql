-- ============================================================
-- Room Background Generation System
-- Tables, indexes, RLS, and storage bucket for AI-generated
-- room environment backgrounds.
-- ============================================================

-- ─── Background asset status enum ───────────────────────────
CREATE TYPE fp_bg_asset_status AS ENUM (
  'generating',   -- OpenAI request in flight
  'candidate',    -- Generated, awaiting review
  'approved',     -- Passed review, eligible for activation
  'active',       -- Currently displayed in room
  'archived'      -- Retired
);

-- ─── Generation Jobs ────────────────────────────────────────
CREATE TABLE fp_room_background_jobs (
  id               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  world_key        text NOT NULL,
  prompt_text      text NOT NULL,
  prompt_hash      text NOT NULL,
  status           text NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'generating', 'completed', 'failed')),
  error_message    text,
  candidates_count int NOT NULL DEFAULT 0,
  created_at       timestamptz NOT NULL DEFAULT now(),
  completed_at     timestamptz
);

CREATE INDEX idx_fp_bg_jobs_world
  ON fp_room_background_jobs (world_key, created_at DESC);

-- ─── Background Assets ──────────────────────────────────────
CREATE TABLE fp_room_background_assets (
  id               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  world_key        text NOT NULL,
  job_id           uuid REFERENCES fp_room_background_jobs(id) ON DELETE SET NULL,
  storage_path     text NOT NULL,
  public_url       text NOT NULL,
  status           fp_bg_asset_status NOT NULL DEFAULT 'candidate',
  width            int,
  height           int,
  file_size_bytes  int,
  prompt_text      text,
  score_overall    float,
  review_notes     text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  reviewed_at      timestamptz,
  activated_at     timestamptz,
  archived_at      timestamptz
);

-- Enforces exactly one active background per world at DB level
CREATE UNIQUE INDEX idx_fp_bg_assets_active
  ON fp_room_background_assets (world_key)
  WHERE status = 'active';

-- List candidates for review
CREATE INDEX idx_fp_bg_assets_review
  ON fp_room_background_assets (world_key, status, created_at DESC);

-- ─── RLS Policies ───────────────────────────────────────────

ALTER TABLE fp_room_background_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read background jobs"
  ON fp_room_background_jobs FOR SELECT
  TO public
  USING (true);

ALTER TABLE fp_room_background_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read background assets"
  ON fp_room_background_assets FOR SELECT
  TO public
  USING (true);

-- ─── Storage Bucket ─────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public)
VALUES ('room-backgrounds', 'room-backgrounds', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Anyone can view room backgrounds"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'room-backgrounds');
