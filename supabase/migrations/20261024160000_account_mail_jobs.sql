-- Spec 006, T8: scheduled account jobs and the mail sender (plan D3, D4;
-- RF-23, RF-26, RF-29).
--
-- pg_net is asynchronous: the send returns a request id, and the response shows
-- up later in net._http_response. So a mail is marked sent only when a later run
-- reads a 2xx response; a failed response makes it eligible again, up to 5
-- attempts (shortcut: a request whose response never arrives stays pending
-- forever; a timeout check would fix it, when it shows up).
--
-- Brevo keys are read from Vault: brevo_api_key and brevo_sender_email. The
-- dry run only lists the rows that would be sent (used by the tests).

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

alter table public.email_outbox add column request_id bigint;

create function public.send_pending_emails(
  p_dry_run boolean default false,
  p_limit integer default 50
)
returns setof bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_key text;
  v_sender text;
  v_row record;
begin
  if not p_dry_run then
    select ds.decrypted_secret into v_key
    from vault.decrypted_secrets ds
    where ds.name = 'brevo_api_key';

    select ds.decrypted_secret into v_sender
    from vault.decrypted_secrets ds
    where ds.name = 'brevo_sender_email';

    if v_key is null or v_sender is null then
      raise exception 'Brevo is not configured in Vault' using errcode = 'P0001';
    end if;

    -- Requests answered with 2xx are sent; the others are retried later.
    update public.email_outbox o
    set sent_at = now()
    from net._http_response r
    where o.request_id = r.id
      and o.sent_at is null
      and coalesce(r.status_code, 0) between 200 and 299;

    update public.email_outbox o
    set request_id = null
    from net._http_response r
    where o.request_id = r.id
      and o.sent_at is null
      and coalesce(r.status_code, 0) not between 200 and 299;
  end if;

  for v_row in
    select o.id, o.to_email, o.subject, o.body
    from public.email_outbox o
    where o.sent_at is null
      and o.request_id is null
      and o.attempts < 5
    order by o.created_at, o.id
    limit p_limit
  loop
    if not p_dry_run then
      update public.email_outbox
      set attempts = attempts + 1,
          request_id = net.http_post(
            url := 'https://api.brevo.com/v3/smtp/email',
            headers := jsonb_build_object(
              'api-key', v_key,
              'accept', 'application/json',
              'content-type', 'application/json'
            ),
            body := jsonb_build_object(
              'sender', jsonb_build_object('name', 'CalenderFam', 'email', v_sender),
              'to', jsonb_build_array(jsonb_build_object('email', v_row.to_email)),
              'subject', v_row.subject,
              'textContent', v_row.body
            )
          )
      where id = v_row.id;
    end if;

    return next v_row.id;
  end loop;

  return;
end;
$$;

-- Test helper: lists the account jobs for the service role only.
create function public.account_scheduled_jobs()
returns table (jobname text, schedule text)
language sql
security definer
set search_path = ''
as $$
  select j.jobname::text, j.schedule::text
  from cron.job j
  where j.jobname like 'account-%';
$$;

-- Schedules (plan D3). Each job runs as postgres, the owner of the migration.
select cron.schedule('account-apply-orphans', '0 3 * * *', $$select public.apply_orphan_decisions()$$);
select cron.schedule('account-send-emails', '*/15 * * * *', $$select public.send_pending_emails()$$);
select cron.schedule(
  'account-purge-recovery',
  '0 4 * * *',
  $$delete from public.auth_email_requests where created_at < now() - interval '1 day'$$
);

revoke execute on function public.send_pending_emails(boolean, integer)
  from public, anon, authenticated;
grant execute on function public.send_pending_emails(boolean, integer) to service_role;

revoke execute on function public.account_scheduled_jobs() from public, anon, authenticated;
grant execute on function public.account_scheduled_jobs() to service_role;
