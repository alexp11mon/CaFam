// A write that waits in the queue when there is no network (spec 034 RF-19,
// RF-27, RF-30, plan D7): offline, or with older changes still waiting, the
// change is queued and the screen gets a success with its "Deshacer".
import { isNetworkError, isOnline, withTimeout } from "./connection";
import type { OfflineChange } from "./outbox";
import { addChange, getQueueState } from "./queue-store";

export type Queued = {
  offline: true;
  undo: { kind: "offline"; changeId: string; change: OfflineChange };
};

export function isQueued(value: unknown): value is Queued {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { offline?: unknown }).offline === true
  );
}

async function queued(change: OfflineChange): Promise<Queued> {
  return {
    offline: true,
    undo: { kind: "offline", changeId: await addChange(change), change },
  };
}

/**
 * Runs `write` against the server, or queues `change`. A null `change` is a
 * write that needs the network: it runs, and fails, as always.
 */
export async function withOutbox<R>(
  write: () => Promise<R>,
  change: OfflineChange | null,
): Promise<R | Queued> {
  // Behind older changes it waits too, so they reach the server in order (RF-40).
  if (change && (!isOnline() || getQueueState().queue.length > 0)) {
    return queued(change);
  }
  try {
    return await withTimeout(write());
  } catch (error) {
    // A write the server applied but whose answer was lost is sent again:
    // the server sees it is already there (RF-41).
    if (change && isNetworkError(error)) return queued(change);
    throw error;
  }
}
