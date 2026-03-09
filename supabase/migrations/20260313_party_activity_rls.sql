-- Phase 2: Party-scoped activity event visibility.
-- Allows party members to see events from ALL participants in the same party.
-- Additive: works alongside existing "Users can view own events" policy (OR'd).

create policy "Party members can view party events"
  on public.fp_activity_events for select
  using (
    party_id is not null
    and exists (
      select 1
      from public.fp_party_participants pp
      where pp.party_id = fp_activity_events.party_id
        and pp.user_id = auth.uid()
        and pp.left_at is null
    )
  );
