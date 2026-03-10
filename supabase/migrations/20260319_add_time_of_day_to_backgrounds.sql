-- ─── Add time-of-day states to room backgrounds ─────────────
-- Each room can now have one active background PER time state
-- (morning, afternoon, evening, late_night) instead of just one overall.
-- Existing assets default to 'afternoon' (all were generated for bright daylight).

-- 1. Create the enum
CREATE TYPE fp_time_of_day_state AS ENUM ('morning','afternoon','evening','late_night');

-- 2. Add column with backward-compatible default
ALTER TABLE fp_room_background_assets
  ADD COLUMN time_of_day_state fp_time_of_day_state NOT NULL DEFAULT 'afternoon';

-- 3. Replace unique index: one active per (world, time state)
DROP INDEX IF EXISTS idx_fp_bg_assets_active;
CREATE UNIQUE INDEX idx_fp_bg_assets_active
  ON fp_room_background_assets (world_key, time_of_day_state)
  WHERE status = 'active';

-- 4. Replace review index to include time state
DROP INDEX IF EXISTS idx_fp_bg_assets_review;
CREATE INDEX idx_fp_bg_assets_review
  ON fp_room_background_assets (world_key, time_of_day_state, status, created_at DESC);
