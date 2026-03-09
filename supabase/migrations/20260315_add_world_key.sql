-- Add world_key column to fp_parties.
-- References a world config defined in code (lib/worlds.ts).
-- Existing parties default to 'default' world.
alter table public.fp_parties
  add column world_key text not null default 'default';
