-- Spec 003, T2: invite-link functions (plan "Funciones SQL", D1, D2, D8, D13;
-- RF-1, RF-3..RF-6, RF-8..RF-10, RF-12, RF-13, RF-29).
--
-- SECURITY DEFINER with an empty search_path: they write calendar_members and
-- read the hashed token, which clients cannot do. Each one checks the caller
-- itself. The token has 256 bits of entropy, so a plain SHA-256 is enough (D2).
-- CF404 is the custom SQLSTATE for "invite not valid" (one message for every
-- reason, D13).

create function public.create_invite(
  p_calendar_id uuid,
  p_role public.calendar_role,
  p_max_uses integer
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token text;
begin
  if public.calendar_role_for(p_calendar_id) is distinct from 'owner' then
    raise exception 'Only the owner can create invites' using errcode = '42501';
  end if;
  if p_role not in ('editor', 'viewer') then
    raise exception 'Invites can only grant editor or viewer'
      using errcode = '22023';
  end if;
  if p_max_uses is null or p_max_uses not between 1 and 20 then
    raise exception 'Uses must be between 1 and 20' using errcode = '22023';
  end if;

  -- base64url without padding: 32 bytes -> 43 characters.
  v_token := translate(
    rtrim(encode(extensions.gen_random_bytes(32), 'base64'), '='),
    '+/',
    '-_'
  );

  insert into public.calendar_invites (
    calendar_id, token_hash, role, max_uses, created_by, expires_at
  )
  values (
    p_calendar_id,
    sha256(convert_to(v_token, 'UTF8')),
    p_role,
    p_max_uses,
    (select auth.uid()),
    now() + interval '7 days'
  );

  return v_token;
end;
$$;

create function public.revoke_invite(p_invite_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_calendar_id uuid;
begin
  select calendar_id
  into v_calendar_id
  from public.calendar_invites
  where id = p_invite_id;

  if v_calendar_id is null
    or public.calendar_role_for(v_calendar_id) is distinct from 'owner' then
    raise exception 'Only the owner can revoke invites' using errcode = '42501';
  end if;

  update public.calendar_invites
  set revoked_at = coalesce(revoked_at, now())
  where id = p_invite_id;
end;
$$;

-- Read-only preview (D8): previews by messaging apps must not spend uses.
create function public.get_invite_preview(p_token text)
returns table (
  calendar_name text,
  owner_name text,
  role public.calendar_role,
  already_member boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    c.name,
    p.display_name,
    i.role,
    public.is_calendar_member(i.calendar_id)
  from public.calendar_invites i
  join public.calendars c on c.id = i.calendar_id
  join public.profiles p on p.id = c.owner_id
  where i.token_hash = sha256(convert_to(p_token, 'UTF8'))
    and i.revoked_at is null
    and i.expires_at > now()
    and i.use_count < i.max_uses;
$$;

-- The row lock serializes people racing for the last use (RF-13).
create function public.accept_invite(p_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invite public.calendar_invites;
  v_user uuid := (select auth.uid());
begin
  select *
  into v_invite
  from public.calendar_invites
  where token_hash = sha256(convert_to(p_token, 'UTF8'))
  for update;

  if not found
    or v_invite.revoked_at is not null
    or v_invite.expires_at <= now()
    or v_invite.use_count >= v_invite.max_uses then
    raise exception 'Invite not valid' using errcode = 'CF404';
  end if;

  -- Members keep their role and do not spend a use (RF-9).
  if exists (
    select 1
    from public.calendar_members
    where calendar_id = v_invite.calendar_id and user_id = v_user
  ) then
    return v_invite.calendar_id;
  end if;

  update public.calendar_invites
  set use_count = use_count + 1
  where id = v_invite.id;

  insert into public.calendar_members (calendar_id, user_id, role)
  values (v_invite.calendar_id, v_user, v_invite.role);

  return v_invite.calendar_id;
end;
$$;

revoke execute on function
  public.create_invite(uuid, public.calendar_role, integer),
  public.revoke_invite(uuid),
  public.get_invite_preview(text),
  public.accept_invite(text)
from public, anon;

grant execute on function
  public.create_invite(uuid, public.calendar_role, integer),
  public.revoke_invite(uuid),
  public.get_invite_preview(text),
  public.accept_invite(text)
to authenticated;
