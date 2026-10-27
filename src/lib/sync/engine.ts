import { createClient } from "@supabase/supabase-js";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/supabase/env";
import type { Database } from "@/types/database";
import { listCalendars, type ProviderCalendar } from "./providers/google";
import {
  accessToken,
  syncCalendars,
  type ClaimedCalendar,
  type SyncDeps,
  type SyncResult,
} from "./run-sync";

// Server-only entry to the engine for Server Actions and pages. The caller
// checks first, with the user's session, that the connection is theirs (RLS,
// plan D5); then the secret opens the sync functions (plan D4).

export function engineDeps(): SyncDeps {
  return {
    supabase: createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: { persistSession: false },
    }),
    secret: process.env.CRON_SECRET ?? "",
    clientId: process.env.GOOGLE_CLIENT_ID ?? "",
    clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
  };
}

export type ConnectionSync =
  | { status: "ok"; results: SyncResult[] }
  | { status: "too_soon"; nextAt: string }
  | { status: "needs_reauth" };

/** Updates every calendar of a connection; `manual` applies the 5-minute wait (RF-23, RF-24). */
export async function syncConnection(
  connectionId: string,
  manual: boolean,
): Promise<ConnectionSync> {
  const deps = engineDeps();
  const { data, error } = await deps.supabase.rpc("sync_claim_connection", {
    p_secret: deps.secret,
    p_connection_id: connectionId,
    p_manual: manual,
  });
  if (error) throw new Error(error.message);

  const claim = data as unknown as {
    status: "ok" | "too_soon" | "needs_reauth";
    next_at?: string;
    calendars?: ClaimedCalendar[];
  };
  if (claim.status === "too_soon") {
    return { status: "too_soon", nextAt: claim.next_at ?? "" };
  }
  if (claim.status === "needs_reauth") return { status: "needs_reauth" };
  return {
    status: "ok",
    results: await syncCalendars(claim.calendars ?? [], deps),
  };
}

/** The account's calendars, read from Google on every visit (RF-9, RF-12). */
export async function providerCalendars(
  connectionId: string,
): Promise<ProviderCalendar[]> {
  const deps = engineDeps();
  return listCalendars(await accessToken(deps, connectionId), deps.fetchFn);
}
