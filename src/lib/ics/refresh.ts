import { syncWindow } from "@/lib/sync/window";
import type { EventRow } from "./convert-events";
import { getImportErrorMessage } from "./error-messages";
import type { FetchResult } from "./fetch-ics";
import { runImport } from "./import-calendar";
import { parseSourceUrl } from "./source-url";

// Keeps an imported calendar updated from its link (spec 044 RF-7, RF-10,
// RNF-1). Like run-sync.ts, every dependency is injected: the real ones
// (refresh-engine.ts) call the secret-protected functions without the secret key.

const BUDGET_MS = 50_000;

export interface DueSubscription {
  calendar_id: string;
  /** Zone of the profile of whoever made it: floating times use it. */
  time_zone: string;
  /** Last good read: what was changed in CaFam after it is kept (RF-8). */
  last_read_at: string | null;
}

export type RefreshFailure = "transient" | "gone";

export interface RefreshDeps {
  getUrl(calendarId: string): Promise<string | null>;
  fetchIcs(url: URL): Promise<FetchResult>;
  apply(input: {
    calendarId: string;
    events: EventRow[];
    readAt: string | null;
    from: Date;
    to: Date;
  }): Promise<unknown>;
  fail(
    calendarId: string,
    kind: RefreshFailure,
    message: string,
  ): Promise<void>;
  now(): Date;
}

const WRITE_FAILED = "No se han podido guardar los cambios del enlace.";

/** One subscription: download, convert the window and apply, or record why not. */
export async function refreshOne(
  sub: DueSubscription,
  deps: RefreshDeps,
): Promise<{ ok: true } | { ok: false; kind: RefreshFailure }> {
  const failed = async (kind: RefreshFailure, message: string) => {
    await deps.fail(sub.calendar_id, kind, message).catch(() => {});
    return { ok: false as const, kind };
  };

  const stored = await deps.getUrl(sub.calendar_id);
  // The anti-SSRF check of spec 004 runs again on every read (RF-12).
  const url = stored ? parseSourceUrl(stored) : null;
  if (!url?.ok) {
    return failed("transient", getImportErrorMessage({ kind: "invalid-url" }));
  }

  const now = deps.now();
  const window = syncWindow(now);
  const imported = await runImport(
    {
      source: { kind: "url", url: url.url },
      profileTimeZone: sub.time_zone,
      today: {
        year: now.getUTCFullYear(),
        month: now.getUTCMonth() + 1,
        day: now.getUTCDate(),
      },
      name: null,
      window,
    },
    { fetchIcs: deps.fetchIcs },
  );
  // An empty window is an answer too: the link no longer has those events.
  if (!imported.ok && imported.error.kind !== "no-events") {
    return failed(
      imported.error.kind === "gone" ? "gone" : "transient",
      getImportErrorMessage(imported.error),
    );
  }

  try {
    await deps.apply({
      calendarId: sub.calendar_id,
      events: imported.ok ? imported.events : [],
      readAt: sub.last_read_at,
      ...window,
    });
  } catch {
    return failed("transient", WRITE_FAILED);
  }
  return { ok: true };
}

/** Batches of due subscriptions for 50 s at most (RNF-1). */
export async function runRefresh(
  claimDue: () => Promise<DueSubscription[]>,
  deps: RefreshDeps,
): Promise<{ refreshed: number; failed: number }> {
  const start = deps.now().getTime();
  const totals = { refreshed: 0, failed: 0 };
  while (deps.now().getTime() - start < BUDGET_MS) {
    const batch = await claimDue();
    if (batch.length === 0) break;
    const results = await Promise.all(batch.map((s) => refreshOne(s, deps)));
    for (const result of results) totals[result.ok ? "refreshed" : "failed"]++;
  }
  return totals;
}
