// Sending the queue when the network is back (spec 034 RF-38 to RF-49, RF-56,
// RF-63, plan "Flujo" 4): in order, one change at a time, with one sender
// per device (R4).
import type { Unauthenticated } from "@/app/dashboard/offline-actions";
import type { ApplyResult } from "@/app/dashboard/offline-writes";
import { isNetworkError, withTimeout } from "./connection";
import { OFFLINE_MESSAGES } from "./messages";
import { dependentsOf, type OfflineChange } from "./outbox";
import {
  addConflict,
  addRejected,
  getQueueState,
  setQueue,
} from "./queue-store";

export type SendResult = ApplyResult | Unauthenticated;
export type Send = (
  change: OfflineChange,
  options?: { force?: boolean },
) => Promise<SendResult>;

export interface FlushResult {
  applied: number;
  /** Why it stopped before the end, with the rest kept for later. */
  stopped: "retry" | "unauthenticated" | null;
}

let running: Promise<FlushResult> | null = null;

async function sendAll(send: Send): Promise<FlushResult> {
  let applied = 0;
  for (;;) {
    const queue = getQueueState().queue;
    const entry = queue[0];
    if (!entry) return { applied, stopped: null };

    let result: SendResult;
    try {
      result = await withTimeout(send(entry.change));
    } catch (error) {
      if (isNetworkError(error)) return { applied, stopped: "retry" };
      result = { status: "retry" };
    }
    if ("unauthenticated" in result) {
      return { applied, stopped: "unauthenticated" };
    }
    // shortcut: held stops like retry until spec 035 T9 skips its entity.
    if (result.status === "retry" || result.status === "held") {
      return { applied, stopped: "retry" };
    }

    let gone = [entry];
    if (result.status === "applied") applied += 1;
    if (result.status === "conflict") {
      await addConflict({
        changeId: entry.changeId,
        change: entry.change,
        server: result.server,
      });
    }
    if (result.status === "rejected") {
      // What depends on a refused change cannot go either (RF-49).
      gone = [entry, ...dependentsOf(queue, entry)];
      for (const failed of gone) {
        await addRejected({
          changeId: failed.changeId,
          change: failed.change,
          reason: result.reason,
        });
      }
    }
    const ids = new Set(gone.map((g) => g.changeId));
    await setQueue(
      getQueueState().queue.filter((queued) => !ids.has(queued.changeId)),
    );
  }
}

/**
 * Sends what waits. A second call while one runs gets the same run, and
 * another tab waits for the device's lock (R4). `notify` says how many went.
 */
export function flush(
  send: Send,
  notify: (text: string) => void = () => {},
): Promise<FlushResult> {
  running ??= (async () => {
    try {
      // shortcut: another tab keeps its own copy of the queue in memory and
      // may send a change again; the server answers "applied" (RF-41).
      const run = () => sendAll(send);
      const result = await (navigator.locks
        ? navigator.locks.request("cafam-offline-flush", run)
        : run());
      if (result.applied > 0) notify(OFFLINE_MESSAGES.synced(result.applied));
      return result;
    } finally {
      running = null;
    }
  })();
  return running;
}
