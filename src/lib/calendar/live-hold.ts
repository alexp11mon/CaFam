/**
 * Holds of the live refresh (spec 019 plan D6, RF-43): a drag, the quick
 * window or an edit form keep someone else's change waiting until they end.
 * Module state, as the clipboard of spec 017: one calendar per tab.
 */
let holds = 0;
const listeners = new Set<() => void>();
/** A remote refresh is the cause of what renders within this time. */
const REMOTE_MS = 3000;
let remoteAt = -Infinity;

/** Starts a hold; the returned function ends it (only once). */
export function holdLive(): () => void {
  holds++;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    holds--;
    if (holds === 0) for (const listener of [...listeners]) listener();
  };
}

export function isLiveHeld(): boolean {
  return holds > 0;
}

/** Called when the last hold ends. */
export function onLiveRelease(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The next render comes from someone else's change (RF-44). */
export function markRemoteRefresh() {
  remoteAt = Date.now();
}

/** Whether the last refresh was someone else's; reading it clears it. */
export function takeRemoteRefresh(): boolean {
  const value = Date.now() - remoteAt < REMOTE_MS;
  remoteAt = -Infinity;
  return value;
}
