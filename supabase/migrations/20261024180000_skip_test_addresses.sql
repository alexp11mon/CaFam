-- Spec 006, T23: the mail queue never sends to the reserved .test domain
-- (RFC 2606). The integration tests delete accounts in dev, which queues notices
-- to their @calenderfam.test users, and the scheduled sender was mailing them to
-- Brevo. Such rows stay in the queue, never sent. Same function as T8 otherwise.

create or replace function public.send_pending_emails(
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
      and o.to_email not ilike '%.test'
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
