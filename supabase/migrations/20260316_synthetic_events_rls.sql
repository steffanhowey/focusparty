-- Allow all authenticated users to view synthetic activity events.
-- These are ambient events shown on room cards on the discovery page.
-- Without this, the existing "Party members can view party events" policy
-- blocks users from seeing synthetic presence in rooms they haven't joined.

create policy "Authenticated users can view synthetic events"
  on public.fp_activity_events for select
  using (
    actor_type = 'synthetic'
    and auth.role() = 'authenticated'
  );
