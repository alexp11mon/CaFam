import { createClient } from "@supabase/supabase-js";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/supabase/env";
import type { Database } from "@/types/database";
import {
  listCalendars,
  revokeToken,
  type ProviderCalendar,
} from "./providers/google";
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

/**
 * Writes run with the user's session, so the database checks their role, plus
 * the secret, which proves Google was written first (spec 009 plan D3).
 */
export function writeEngineDeps(supabase: SyncDeps["supabase"]): SyncDeps {
  return { ...engineDeps(), supabase };
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

/**
 * The account's calendars, read from Google on every visit (RF-9, RF-12). Their
 * access is stored too, so a reconnected account writes at once (spec 009 RF-4).
 */
export async function providerCalendars(
  connectionId: string,
): Promise<ProviderCalendar[]> {
  const deps = engineDeps();
  const list = await listCalendars(
    await accessToken(deps, connectionId),
    deps.fetchFn,
  );
  await deps.supabase.rpc("sync_set_access", {
    p_secret: deps.secret,
    p_connection_id: connectionId,
    p_items: list.map((c) => ({ external_id: c.id, access: c.access })),
  });
  return list;
}

/** Withdraws CaFam's access in Google before disconnecting (RF-30). */
export async function revokeConnection(connectionId: string): Promise<void> {
  const deps = engineDeps();
  const { data } = await deps.supabase.rpc("sync_get_token", {
    p_secret: deps.secret,
    p_connection_id: connectionId,
  });
  if (typeof data === "string" && data) await revokeToken(data, deps.fetchFn);
}
