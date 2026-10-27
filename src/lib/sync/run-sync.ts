import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { convertGoogleEvents } from "./google-events";
import { limitEvents } from "./limit-events";
import {
  listEvents,
  ProviderError,
  refreshAccessToken,
  type FailureKind,
} from "./providers/google";
import type { UpdateSummary } from "./summary";
import { syncWindow } from "./window";

// The sync engine shared by the hourly run and "Actualizar ahora" (plan D1, D5,
// D7, D17, D19): renew the token, read, convert, cap and apply. The database
// writes go through the secret-protected functions of T4 (plan D4).

const CONCURRENCY = 4;
const BUDGET_MS = 50_000;

export interface SyncDeps {
  supabase: SupabaseClient<Database>;
  secret: string;
  clientId: string;
  clientSecret: string;
  fetchFn?: typeof fetch;
  now?: () => Date;
  /** Time spent so far; the run stops claiming after 50 s (plan D19). */
  elapsedMs?: () => number;
}

export interface ClaimedCalendar {
  calendar_id: string;
  connection_id: string;
  external_id: string;
}

export type SyncResult =
  | { calendarId: string; summary: UpdateSummary }
  | { calendarId: string; error: FailureKind };

async function rpc(
  deps: SyncDeps,
  fn: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  // One untyped helper for every sync function; each caller casts its result.
  const { data, error } = await (
    deps.supabase.rpc as unknown as (
      fn: string,
      args: Record<string, unknown>,
    ) => Promise<{ data: unknown; error: { message: string } | null }>
  )(fn, args);
  if (error) throw new Error(error.message);
  return data;
}

/** One access token per connection; a rotated refresh token is stored first (R3). */
export async function accessToken(deps: SyncDeps, connectionId: string) {
  const refreshToken = (await rpc(deps, "sync_get_token", {
    p_secret: deps.secret,
    p_connection_id: connectionId,
  })) as string | null;
  if (!refreshToken) throw new ProviderError("revoked", "No token stored");

  const renewed = await refreshAccessToken(
    {
      clientId: deps.clientId,
      clientSecret: deps.clientSecret,
      refreshToken,
    },
    deps.fetchFn,
  );
  if (renewed.refreshToken) {
    await rpc(deps, "sync_store_token", {
      p_secret: deps.secret,
      p_connection_id: connectionId,
      p_token: renewed.refreshToken,
    });
  }
  return renewed.accessToken;
}

async function syncOne(
  deps: SyncDeps,
  calendar: ClaimedCalendar,
  token: Promise<string>,
): Promise<SyncResult> {
  const now = deps.now?.() ?? new Date();
  try {
    const items = await listEvents(
      await token,
      calendar.external_id,
      syncWindow(now),
      deps.fetchFn,
    );
    const converted = convertGoogleEvents(items);
    const { events, omitted } = limitEvents(converted.events, now);
    const summary = (await rpc(deps, "sync_apply_events", {
      p_secret: deps.secret,
      p_calendar_id: calendar.calendar_id,
      p_events: events,
      p_skipped: converted.skipped,
      p_omitted: omitted,
    })) as UpdateSummary;
    return { calendarId: calendar.calendar_id, summary };
  } catch (error) {
    // Anything unexpected is retried in the next run (RF-33).
    const kind = error instanceof ProviderError ? error.kind : "transient";
    await rpc(deps, "sync_fail", {
      p_secret: deps.secret,
      p_calendar_id: calendar.calendar_id,
      p_kind: kind,
    }).catch(() => undefined);
    return { calendarId: calendar.calendar_id, error: kind };
  }
}

/** Updates already claimed calendars, at most 4 at a time (plan D19). */
export async function syncCalendars(
  calendars: ClaimedCalendar[],
  deps: SyncDeps,
): Promise<SyncResult[]> {
  const tokens = new Map<string, Promise<string>>();
  const tokenFor = (connectionId: string) => {
    let token = tokens.get(connectionId);
    if (!token) {
      token = accessToken(deps, connectionId);
      // Handled per calendar in syncOne; this only avoids an unhandled rejection.
      token.catch(() => undefined);
      tokens.set(connectionId, token);
    }
    return token;
  };

  const results: SyncResult[] = [];
  const queue = [...calendars];
  const worker = async () => {
    for (let next = queue.shift(); next; next = queue.shift()) {
      results.push(await syncOne(deps, next, tokenFor(next.connection_id)));
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  return results;
}

/**
 * The hourly run: claims 4 due calendars at a time while there is time left,
 * so what does not fit stays unclaimed for the next run (RF-22, plan D19).
 */
export async function runDue(deps: SyncDeps): Promise<number> {
  const started = Date.now();
  const elapsed = deps.elapsedMs ?? (() => Date.now() - started);
  let count = 0;
  while (elapsed() < BUDGET_MS) {
    const batch = (await rpc(deps, "sync_claim_due", {
      p_secret: deps.secret,
      p_limit: CONCURRENCY,
    })) as ClaimedCalendar[] | null;
    if (!batch?.length) break;
    await syncCalendars(batch, deps);
    count += batch.length;
  }
  return count;
}
