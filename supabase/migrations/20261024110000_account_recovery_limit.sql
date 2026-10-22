-- Spec 006, T3: recovery requests limited per account (plan D6; RF-5, RF-1).
--
-- Anyone may call it, before signing in, so it stores only the SHA-256 of the
-- normalized address and returns a boolean. The screen shows the same message
-- whatever it returns (RF-1, NF-1). Supabase Auth limits mail per hour for the
-- whole project, not per account, which is why this exists.

create function public.request_recovery(p_email text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hash bytea;
  v_recent integer;
begin
  if p_email is null or btrim(p_email) = '' then
    raise exception 'The address is required' using errcode = '22023';
  end if;

  v_hash := extensions.digest(lower(btrim(p_email)), 'sha256');

  select count(*) into v_recent
  from public.auth_email_requests
  where email_hash = v_hash
    and created_at > now() - interval '15 minutes';

  -- Counted before inserting, so the fourth request is the first refused.
  insert into public.auth_email_requests (email_hash) values (v_hash);

  return v_recent < 3;
end;
$$;

revoke execute on function public.request_recovery(text) from public;
grant execute on function public.request_recovery(text) to anon, authenticated;
