// Sending the queue when the network is back (spec 034 RF-38 to RF-49,
// RF-56, RF-63, plan "Flujo" 4): in order, one change at a time, with one sender
// per device (R4). Spec 035: a held account is skipped (RF-7) and images go up
// by their own route (RF-39). public/sw.js repeats this loop (plan D4): a
// change here goes there too, and tests/unit/offline-flush-cases.ts checks both.
import type { Unauthenticated } from "@/app/dashboard/offline-actions";
import type { ApplyResult } from "@/app/dashboard/offline-writes";
import { requestBackgroundSync } from "./background";
import { isNetworkError, withTimeout } from "./connection";
import { deletePendingImages, getPendingImage } from "./db";
import {
  appUploadDeps,
  uploadPendingImage,
  type UploadDeps,
} from "./image-upload";
import { OFFLINE_MESSAGES } from "./messages";
import { dependentsOf, type OfflineChange, type OutboxEntry } from "./outbox";
import {
  addConflict,
  addRejected,
  getQueueState,
  loadQueue,
  setHeld,
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

/** An image added offline: its bytes wait in "pending-images" (RF-39). */
async function sendImage(
  entry: OutboxEntry,
  upload: UploadDeps,
): Promise<SendResult> {
  if (entry.change.type !== "image.add") return { status: "retry" };
  const image = await getPendingImage(entry.change.localId);
  // Removed meanwhile: nothing left to send.
  if (!image) return { status: "applied" };
  // shortcut: one image at a time here; uploadPendingImage sends its two
  // objects at once. Upgrade if 20 pending images prove slow (RNF-2).
  const result = await uploadPendingImage(image, upload);
  if ("status" in result && result.status === "applied") {
    await deletePendingImages([image.localId]);
  }
  return result;
}

async function sendAll(send: Send, upload: UploadDeps): Promise<FlushResult> {
  // The service worker or another tab may have sent part of it (RF-45).
  await loadQueue();
  let applied = 0;
  /** Changes left for a held account, by changeId (RF-7, D8). */
  const held = new Map<string, string>();
  const done = async (stopped: FlushResult["stopped"]) => {
    setHeld(
      [...held].map(([changeId, connectionId]) => ({ changeId, connectionId })),
    );
    if (getQueueState().queue.length > 0) void requestBackgroundSync();
    return { applied, stopped };
  };
  for (;;) {
    const queue = getQueueState().queue;
    const entry = queue.find((queued) => !held.has(queued.changeId));
    if (!entry) return done(null);

    let result: SendResult;
    try {
      result =
        entry.change.type === "image.add"
          ? await sendImage(entry, upload)
          : await withTimeout(send(entry.change));
    } catch (error) {
      if (isNetworkError(error)) return done("retry");
      result = { status: "retry" };
    }
    if ("unauthenticated" in result) return done("unauthenticated");
    if (result.status === "retry") return done("retry");
    if (result.status === "held") {
      // It and what goes with it wait for the account; the rest goes on.
      for (const kept of [entry, ...dependentsOf(queue, entry)]) {
        held.set(kept.changeId, result.connectionId);
      }
      continue;
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
  upload: UploadDeps = appUploadDeps,
): Promise<FlushResult> {
  running ??= (async () => {
    try {
      const run = () => sendAll(send, upload);
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
