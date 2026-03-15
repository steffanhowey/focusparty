-- Tracks background learning path generation status.
-- Replaces the unreliable in-memory Map that breaks across
-- serverless instances (Vercel Lambda cold starts).

CREATE TABLE fp_generation_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  query TEXT NOT NULL,
  adapted_for_function TEXT,
  adapted_for_fluency TEXT,
  status TEXT NOT NULL DEFAULT 'generating' CHECK (status IN ('generating', 'complete', 'failed')),
  path_id UUID REFERENCES fp_learning_paths(id),
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS — only admin/service role writes; no public reads needed
-- (API routes use admin client)
ALTER TABLE fp_generation_status ENABLE ROW LEVEL SECURITY;

-- Auto-cleanup: rows older than 10 minutes are stale
-- (handled by app logic, not a DB trigger, to stay serverless-friendly)

-- Index for polling by ID (primary access pattern)
CREATE INDEX idx_generation_status_created
  ON fp_generation_status(created_at DESC);
