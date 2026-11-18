-- Spec 039, T2: event search by title, place, description and comments, with
-- no case or accents (RF-3, RF-4, RF-11, RNF-1; plan "Modelo de datos", D1).

create extension if not exists pg_trgm with schema extensions;
create extension if not exists unaccent with schema extensions;

-- Lower case without accents, keeping ñ (lib/search/normalize.ts does the
-- same). unaccent is not immutable by itself: with the dictionary named it
-- can be, so it can be indexed (plan "Riesgos").
create function public.search_text(t text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select replace(
    extensions.unaccent(
      'extensions.unaccent'::regdictionary,
      replace(lower(coalesce(t, '')), 'ñ', chr(1))
    ),
    chr(1),
    'ñ'
  );
$$;

create index events_search_idx on public.events using gin (
  public.search_text(
    coalesce(title, '') || ' ' || coalesce(location, '') || ' ' || coalesce(description, '')
  ) extensions.gin_trgm_ops
);

create index event_comments_search_idx on public.event_comments using gin (
  public.search_text(body) extensions.gin_trgm_ops
);

-- Events of the caller's calendars whose text (or one comment) has every word
-- of the query (AND, as part or prefix: D1). SECURITY INVOKER: RLS decides;
-- the calendar filter only helps the planner (Diferido of 023). Loose events
-- and exceptions must overlap the period; series only need to be able to
-- (the app expands them, RF-5). matched_comment is the newest comment that
-- matches, for the excerpt (RF-7).
create function public.search_events(
  p_query text,
  p_from timestamptz,
  p_to timestamptz,
  p_limit integer default 300
)
returns table (event_id uuid, matched_comment text)
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_terms text[];
  v_patterns text[];
  v_first text;
begin
  select array_agg(term order by length(term) desc)
  into v_terms
  from unnest(regexp_split_to_array(trim(public.search_text(p_query)), '\s+')) as term
  where term <> '';

  if v_terms is null then
    return;
  end if;

  select array_agg('%' || replace(replace(replace(term, '\', '\'), '%', '\%'), '_', '\_') || '%')
  into v_patterns
  from unnest(v_terms) as term;
  -- The longest word goes through the index; the rest are checked after.
  v_first := v_patterns[1];

  return query
  with mine as (
    select m.calendar_id from public.calendar_members m where m.user_id = auth.uid()
  ),
  in_period as (
    select e.id
    from public.events e
    where e.calendar_id in (select calendar_id from mine)
      and (
        (e.recurrence is null and e.starts_at < p_to and e.ends_at > p_from)
        or (
          e.recurrence is not null and e.starts_at < p_to
          and (e.recurrence_until is null or e.recurrence_until > p_from)
        )
      )
  ),
  by_text as (
    select e.id
    from public.events e
    where e.id in (select id from in_period)
      and public.search_text(
        coalesce(e.title, '') || ' ' || coalesce(e.location, '') || ' ' || coalesce(e.description, '')
      ) like v_first
      and public.search_text(
        coalesce(e.title, '') || ' ' || coalesce(e.location, '') || ' ' || coalesce(e.description, '')
      ) like all (v_patterns)
  ),
  by_comment as (
    select distinct on (c.event_id) c.event_id, c.body
    from public.event_comments c
    where c.event_id in (select id from in_period)
      and public.search_text(c.body) like v_first
      and public.search_text(c.body) like all (v_patterns)
    order by c.event_id, c.created_at desc
  )
  select coalesce(t.id, c.event_id), c.body
  from by_text t
  full join by_comment c on c.event_id = t.id
  limit greatest(1, least(coalesce(p_limit, 300), 1000));
end;
$$;

revoke execute on function public.search_events(text, timestamptz, timestamptz, integer) from public, anon;
grant execute on function public.search_events(text, timestamptz, timestamptz, integer) to authenticated;
