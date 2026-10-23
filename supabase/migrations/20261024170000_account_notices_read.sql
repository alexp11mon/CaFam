-- Spec 006, T20: a user closes their own notices (plan D10; RF-23).
--
-- Column privilege: only read_at can change, and only on the own rows. The
-- other columns stay written by the account functions alone.

grant update (read_at) on public.account_notices to authenticated;

create policy "account_notices_update_own" on public.account_notices
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
