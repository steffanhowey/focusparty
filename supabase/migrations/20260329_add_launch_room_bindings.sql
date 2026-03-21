-- Add launch-facing room bindings to fp_parties so visible room identity
-- can differ from the runtime compatibility profile used by legacy systems.
alter table public.fp_parties
  add column if not exists launch_room_key text,
  add column if not exists launch_visible boolean,
  add column if not exists runtime_profile_key text;

-- Preserve current runtime behavior for existing rooms unless explicitly remapped.
update public.fp_parties
set runtime_profile_key = world_key
where runtime_profile_key is null;

-- Backfill the five preserved launch rooms onto the existing core persistent rooms.
update public.fp_parties
set
  name = 'Messaging Lab',
  launch_room_key = 'messaging-lab',
  launch_visible = true,
  runtime_profile_key = 'writer-room'
where persistent = true
  and blueprint_id is null
  and world_key = 'writer-room';

update public.fp_parties
set
  name = 'Research Room',
  launch_room_key = 'research-room',
  launch_visible = true,
  runtime_profile_key = 'default'
where persistent = true
  and blueprint_id is null
  and world_key = 'default';

update public.fp_parties
set
  name = 'Campaign Sprint',
  launch_room_key = 'campaign-sprint',
  launch_visible = true,
  runtime_profile_key = 'yc-build'
where persistent = true
  and blueprint_id is null
  and world_key = 'yc-build';

update public.fp_parties
set
  name = 'Workflow Studio',
  launch_room_key = 'workflow-studio',
  launch_visible = true,
  runtime_profile_key = 'vibe-coding'
where persistent = true
  and blueprint_id is null
  and world_key = 'vibe-coding';

update public.fp_parties
set
  name = 'Open Studio',
  launch_room_key = 'open-studio',
  launch_visible = true,
  runtime_profile_key = 'gentle-start'
where persistent = true
  and blueprint_id is null
  and world_key = 'gentle-start';

-- Add the sixth launch room only if it does not already exist.
insert into public.fp_parties (
  creator_id,
  name,
  character,
  planned_duration_min,
  max_participants,
  status,
  invite_code,
  world_key,
  host_personality,
  persistent,
  launch_room_key,
  launch_visible,
  runtime_profile_key
)
select
  null,
  'Content Systems',
  'ember',
  45,
  10,
  'waiting',
  substring(md5(gen_random_uuid()::text), 1, 6),
  'content-systems',
  'writer-room',
  true,
  'content-systems',
  true,
  'writer-room'
where not exists (
  select 1
  from public.fp_parties
  where launch_room_key = 'content-systems'
     or world_key = 'content-systems'
);

notify pgrst, 'reload schema';
