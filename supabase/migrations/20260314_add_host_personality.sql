-- Add host personality column to fp_parties.
-- Drives which AI host personality is used for the room.
-- Values: 'default', 'vibe-coding', 'writer-room', 'yc-build', 'gentle-start'
alter table public.fp_parties
  add column host_personality text not null default 'default';
