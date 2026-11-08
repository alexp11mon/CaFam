import { newChannel, shouldRenew } from "./channel";
import { rpc, type SyncDeps } from "./deps";
import { FULL_READ_HOURS } from "./limits";
import { limitEvents } from "./limit-events";
import { openSession } from "./providers";
import {
  ProviderError,
  type FailureKind,
  type ProviderSession,
} from "./providers/types";
import type { UpdateSummary } from "./summary";
import { syncWindow } from "./window";

// The sync engine shared by the hourly run and "Actualizar ahora" (plan D1, D5,
// D7, D17, D19): open the connection, read, convert, cap and apply. The database
// writes go through the secret-protected functions of T4 (plan D4). Since spec
// 018 the provider (Google or iCloud) sits behind one interface (plan D1).

export { accessToken, type SyncDeps } from "./deps";

const CONCURRENCY = 4;
const BUDGET_MS = 50_000;

export interface ClaimedCalendar {
  calendar_id: string;
  connection_id: string;
  /** From sync_claim_*; Google when missing (calendars claimed before spec 018). */
  provider?: string;
  external_id: string;
  /** From sync_claim_due since spec 020; missing in a manual claim, which reads everything. */
  remote_version?: string | null;
  full_read_at?: string | null;
  push_pending_at?: string | null;
  /** Null without a channel; missing in a manual claim, which leaves channels alone. */
  channel_expires_at?: string | null;
}

interface QueuedStop {
  channel_id: string;
  resource_id: string;
  connection_id: string;
  provider: string;
}

/**
 * Whether the events must be read again, or the version shows nothing changed
 * (spec 020 plan D9; RF-27, RF-28). A notice or 6 h without a full read always
 * read (R3).
 */
export function needsFullRead(input: {
  version: string | null;
  stored: string | null;
  pushPending: boolean;
  fullReadAt: string | null;
  now: Date;
}): boolean {
  const { version, stored, pushPending, fullReadAt, now } = input;
  if (version === null || version !== stored || pushPending) return true;
  if (!fullReadAt) return true;
  return now.getTime() - Date.parse(fullReadAt) > FULL_READ_HOURS * 3_600_000;
}

const UNCHANGED: UpdateSummary = { added: 0, changed: 0, removed: 0 };

/**
 * Makes the Google channel of a calendar when it has none or it is about to
 * expire (spec 020 D8, RF-20). A failure only waits for the next pass: the
 * calendar is still checked every 15 minutes. The token is never logged.
 */
async function renewChannel(
  deps: SyncDeps,
  calendar: ClaimedCalendar,
  provider: ProviderSession,
  now: Date,
) {
  if (!deps.pushUrl || !provider.watchCalendar) return;
  if (calendar.channel_expires_at === undefined) return;
  if (!shouldRenew(calendar.channel_expires_at, now)) return;
  const channel = newChannel();
  try {
    const { resourceId, expiresAt } = await provider.watchCalendar(
      calendar.external_id,
      channel,
      deps.pushUrl,
    );
    await rpc(deps, "sync_store_channel", {
      p_secret: deps.secret,
      p_calendar_id: calendar.calendar_id,
      p_channel_id: channel.id,
      p_resource_id: resourceId,
      p_token: channel.token,
      p_expires_at: expiresAt,
    });
  } catch {
    // Retried in the next pass (D8).
  }
}

export type SyncResult =
  | { calendarId: string; summary: UpdateSummary }
  | { calendarId: string; error: FailureKind };

async function syncOne(
  deps: SyncDeps,
  calendar: ClaimedCalendar,
  session: Promise<ProviderSession>,
): Promise<SyncResult> {
  // Taken before reading: CaFam changes after it win (spec 009 RF-27, plan D5).
  const now = deps.now?.() ?? new Date();
  try {
    const provider = await session;
    await renewChannel(deps, calendar, provider, now);
    // Asked before reading, so a change while reading shows next time (D9).
    const version = await provider.calendarVersion(calendar.external_id);
    const full = needsFullRead({
      version,
      stored: calendar.remote_version ?? null,
      pushPending: Boolean(calendar.push_pending_at),
      fullReadAt: calendar.full_read_at ?? null,
      now,
    });
    if (!full) {
      await rpc(deps, "sync_mark_checked", {
        p_secret: deps.secret,
        p_calendar_id: calendar.calendar_id,
        p_version: version,
        p_full: false,
      });
      return { calendarId: calendar.calendar_id, summary: UNCHANGED };
    }

    const read = await provider.listEvents(
      calendar.external_id,
      syncWindow(now),
    );
    const { events, omitted } = limitEvents(read.events, now);
    const summary = (await rpc(deps, "sync_apply_events", {
      p_secret: deps.secret,
      p_calendar_id: calendar.calendar_id,
      p_events: events,
      p_skipped: read.skipped,
      p_omitted: omitted,
      p_read_at: now.toISOString(),
      p_access: read.access,
    })) as UpdateSummary;
    await rpc(deps, "sync_mark_checked", {
      p_secret: deps.secret,
      p_calendar_id: calendar.calendar_id,
      p_version: version,
      p_full: true,
    });
    return { calendarId: calendar.calendar_id, summary };
  } catch (error) {
    // Anything unexpected is retried in the next run (RF-33).
    const raw = error instanceof ProviderError ? error.kind : "transient";
    // A refused read is retried like a transient one (spec 009).
    const kind = raw === "rejected" ? "transient" : raw;
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
  const sessions = new Map<string, Promise<ProviderSession>>();
  const sessionFor = ({ connection_id, provider }: ClaimedCalendar) => {
    let session = sessions.get(connection_id);
    if (!session) {
      session = openSession(deps, provider ?? "google", connection_id);
      // Handled per calendar in syncOne; this only avoids an unhandled rejection.
      session.catch(() => undefined);
      sessions.set(connection_id, session);
    }
    return session;
  };

  const results: SyncResult[] = [];
  const queue = [...calendars];
  const worker = async () => {
    for (let next = queue.shift(); next; next = queue.shift()) {
      results.push(await syncOne(deps, next, sessionFor(next)));
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
  await stopQueued(deps).catch(() => undefined);
  return count;
}

/**
 * Stops the channels of calendars no longer synced (spec 020 D11, RF-22).
 * Each one leaves the queue even if stop fails: Google ends it within 7 days
 * anyway, and its notices find no channel (R4).
 */
async function stopQueued(deps: SyncDeps) {
  const stops = ((await rpc(deps, "sync_claim_stops", {
    p_secret: deps.secret,
    p_limit: 20,
  })) ?? []) as QueuedStop[];
  const sessions = new Map<string, Promise<ProviderSession>>();
  for (const stop of stops) {
    try {
      let session = sessions.get(stop.connection_id);
      if (!session) {
        session = openSession(deps, stop.provider, stop.connection_id);
        sessions.set(stop.connection_id, session);
      }
      await (await session).stopChannel?.(stop.channel_id, stop.resource_id);
    } catch {
      // Left to expire (R4).
    }
    await rpc(deps, "sync_done_stop", {
      p_secret: deps.secret,
      p_channel_id: stop.channel_id,
    });
  }
}
