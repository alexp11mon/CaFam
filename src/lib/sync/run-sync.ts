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
  return count;
}
