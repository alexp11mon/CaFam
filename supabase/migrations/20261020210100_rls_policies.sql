-- Spec 001, T5: access policies (plan "Políticas RLS", RF-15..RF-20).
-- Only `authenticated` gets policies; `anon` has none, so it sees nothing.

-- Permission functions -------------------------------------------------------
-- SECURITY DEFINER so policies on calendar_members can use them without
-- recursing into themselves (plan R2). They only read rows of auth.uid().

create function public.is_calendar_member(p_calendar_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.calendar_members
    where calendar_id = p_calendar_id
      and user_id = (select auth.uid())
  );
$$;

create function public.calendar_role_for(p_calendar_id uuid)
returns public.calendar_role
language sql
stable
security definer
set search_path = ''
as $$
  select role
  from public.calendar_members
  where calendar_id = p_calendar_id
    and user_id = (select auth.uid());
$$;

revoke execute on function
  public.is_calendar_member(uuid),
  public.calendar_role_for(uuid)
from public, anon;

grant execute on function
  public.is_calendar_member(uuid),
  public.calendar_role_for(uuid)
to authenticated;

-- profiles -------------------------------------------------------------------
-- No INSERT (handle_new_user does it) and no DELETE (cascade from auth.users).

create policy "profiles_select_own" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()));

create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- calendars ------------------------------------------------------------------
-- The owner_id clause in SELECT lets `insert ... returning` see the new row
-- before the owner membership is visible to the statement's snapshot.

create policy "calendars_select_member" on public.calendars
  for select to authenticated
  using (owner_id = (select auth.uid()) or public.is_calendar_member(id));

create policy "calendars_insert_own" on public.calendars
  for insert to authenticated
  with check (owner_id = (select auth.uid()));

create policy "calendars_update_owner" on public.calendars
  for update to authenticated
  using (public.calendar_role_for(id) = 'owner')
  with check (public.calendar_role_for(id) = 'owner');

create policy "calendars_delete_owner" on public.calendars
  for delete to authenticated
  using (public.calendar_role_for(id) = 'owner');

-- calendar_members -----------------------------------------------------------
-- Read-only for everyone (RF-19); spec 003 adds controlled functions.

create policy "calendar_members_select_member" on public.calendar_members
  for select to authenticated
  using (public.is_calendar_member(calendar_id));

-- events ---------------------------------------------------------------------

create policy "events_select_member" on public.events
  for select to authenticated
  using (public.is_calendar_member(calendar_id));

create policy "events_insert_editor" on public.events
  for insert to authenticated
  with check (public.calendar_role_for(calendar_id) in ('owner', 'editor'));

create policy "events_update_editor" on public.events
  for update to authenticated
  using (public.calendar_role_for(calendar_id) in ('owner', 'editor'))
  with check (public.calendar_role_for(calendar_id) in ('owner', 'editor'));

create policy "events_delete_editor" on public.events
  for delete to authenticated
  using (public.calendar_role_for(calendar_id) in ('owner', 'editor'));

-- Test support (P3) ----------------------------------------------------------
-- Lets `npm run test:db` assert that no public table has RLS disabled.
-- Only the secret key (service_role) may call it.

create function public.list_tables_without_rls()
returns setof text
language sql
stable
set search_path = ''
as $$
  select tablename::text
  from pg_catalog.pg_tables
  where schemaname = 'public'
    and not rowsecurity
  order by tablename;
$$;

revoke execute on function public.list_tables_without_rls()
from public, anon, authenticated;

grant execute on function public.list_tables_without_rls() to service_role;
