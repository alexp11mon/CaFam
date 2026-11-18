// Sending with the app closed (spec 035 RF-42, RF-46, plan D4): the service
// worker gets a "sync" with this tag when the network is back. Browsers
// without Background Sync (Safari) send on the next opening instead.

export const SYNC_TAG = "cafam-offline";

interface SyncRegistration {
  sync?: { register(tag: string): Promise<void> };
}

/** True when the browser will send later by itself. */
export async function requestBackgroundSync(): Promise<boolean> {
  try {
    if (typeof navigator === "undefined" || !navigator.serviceWorker) {
      return false;
    }
    // getRegistration, not ready: ready never resolves without a worker (dev).
    const registration = (await navigator.serviceWorker.getRegistration()) as
      SyncRegistration | undefined;
    if (!registration?.sync) return false;
    await registration.sync.register(SYNC_TAG);
    return true;
  } catch {
    // Refused (permission, private window): the app sends on opening.
    return false;
  }
}
