-- Spec 050, T1: an account made with Google takes its name from Google
-- (`full_name` or `name`), cut to 50 characters, or from the address when
-- Google sends none (RF-4). The time zone comes from the browser on the first
-- visit (T4); until then, Europe/Madrid (validate_time_zone).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text;
begin
  v_name := left(btrim(coalesce(
    nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''),
    nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(btrim(new.raw_user_meta_data ->> 'name'), ''),
    nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
    'CaFam'
  )), 50);

  insert into public.profiles (id, display_name, time_zone)
  values (new.id, btrim(v_name), new.raw_user_meta_data ->> 'time_zone');

  insert into public.calendars (owner_id, name)
  values (new.id, 'Mi calendario');

  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
