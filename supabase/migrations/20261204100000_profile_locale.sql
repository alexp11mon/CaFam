-- Spec 053: language of each account (RF-1, RF-5, RF-7).

alter table public.profiles
  add column locale text not null default 'es'
  constraint profiles_locale_check check (locale in ('es', 'en'));

-- Sign-up sends the language picked in the browser; "Mi calendario" is
-- named in that language (RF-7). Same body as 20261201100000 otherwise.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text;
  v_locale text;
begin
  v_name := left(btrim(coalesce(
    nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''),
    nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(btrim(new.raw_user_meta_data ->> 'name'), ''),
    nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
    'CaFam'
  )), 50);
  v_locale := case
    when new.raw_user_meta_data ->> 'locale' = 'en' then 'en'
    else 'es'
  end;

  insert into public.profiles (id, display_name, time_zone, locale)
  values (new.id, btrim(v_name), new.raw_user_meta_data ->> 'time_zone', v_locale);

  insert into public.calendars (owner_id, name)
  values (
    new.id,
    case when v_locale = 'en' then 'My calendar' else 'Mi calendario' end
  );

  return new;
end;
$$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- Mail in the recipient's language (RF-3, plan "Correos"). The queueing
-- functions keep writing Spanish; this trigger rewrites the three known
-- messages for an English recipient, so none of them has to change.
alter table public.email_outbox
  add column locale text not null default 'es'
  constraint email_outbox_locale_check check (locale in ('es', 'en'));

create or replace function public.email_outbox_locale()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_parts text[];
begin
  select p.locale into new.locale
  from auth.users u
  join public.profiles p on p.id = u.id
  where lower(u.email) = lower(new.to_email);
  new.locale := coalesce(new.locale, 'es');
  if new.locale <> 'en' then
    return new;
  end if;

  if new.subject = 'Un calendario compartido se queda sin propietario' then
    v_parts := regexp_match(
      new.body,
      '^(.*) ha eliminado su cuenta de CaFam\. El calendario «(.*)» se queda sin propietario'
    );
    if v_parts is not null then
      new.subject := 'A shared calendar has no owner';
      new.body := format(
        '%s has deleted their CaFam account. The calendar “%s” has no owner now: you have 15 days to keep it or leave it. Open CaFam, in My calendars.',
        case when v_parts[1] = 'Una persona' then 'Someone' else v_parts[1] end,
        v_parts[2]
      );
    end if;
  elsif new.subject = 'Tienes tu copia del calendario' then
    v_parts := regexp_match(new.body, '^El calendario «(.*)» ya es tuyo');
    if v_parts is not null then
      new.subject := 'You have your copy of the calendar';
      new.body := format(
        'The calendar “%s” is yours now: you have a full copy in My calendars. The original has been deleted.',
        v_parts[1]
      );
    end if;
  elsif new.subject like 'Ahora eres el propietario de «%»' then
    v_parts := regexp_match(
      new.body,
      '^(.*) te ha traspasado el calendario «(.*)» en CaFam\.'
    );
    if v_parts is not null then
      new.subject := format('You are now the owner of “%s”', v_parts[2]);
      new.body := format(
        '%s has transferred the calendar “%s” to you in CaFam. You are its owner now: you can edit it, share it and decide who joins.',
        case when v_parts[1] = 'Su propietario' then 'Its owner' else v_parts[1] end,
        v_parts[2]
      );
    end if;
  end if;
  return new;
end;
$$;
revoke execute on function public.email_outbox_locale() from public, anon, authenticated;

create trigger email_outbox_locale
  before insert on public.email_outbox
  for each row execute function public.email_outbox_locale();
