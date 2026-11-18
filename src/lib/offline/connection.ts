// Whether CaFam can reach the server (spec 034 plan D11): the browser's
// online/offline events, the failures and 10 s deadline of the actions and,
// while offline, a probe every 30 s. navigator.onLine alone says "online" on
// a wifi with no way out.
export const ACTION_DEADLINE_MS = 10_000;
export const PROBE_EVERY_MS = 30_000;
const PROBE_URL = "/manifest.webmanifest";

type Listener = () => void;

let online = true;
let started = false;
let probeTimer: ReturnType<typeof setInterval> | null = null;
const listeners = new Set<Listener>();

export function isOnline(): boolean {
  return online;
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function set(next: boolean) {
  if (next === online) return;
  online = next;
  if (online) stopProbing();
  else startProbing();
  for (const listener of listeners) listener();
}

/** One request to the server, fresh: true when it answered. */
export async function probe(): Promise<boolean> {
  try {
    const response = await fetch(PROBE_URL, { cache: "no-store" });
    set(response.ok);
  } catch {
    set(false);
  }
  return online;
}

function startProbing() {
  if (probeTimer || !started) return;
  probeTimer = setInterval(() => void probe(), PROBE_EVERY_MS);
}

function stopProbing() {
  if (probeTimer) clearInterval(probeTimer);
  probeTimer = null;
}

const goOffline = () => set(false);
const checkOnline = () => void probe();

/** Listens to the browser; the app calls it once (OfflineProvider). */
export function startWatching(): () => void {
  if (started) return () => {};
  started = true;
  window.addEventListener("offline", goOffline);
  window.addEventListener("online", checkOnline);
  if (!navigator.onLine) set(false);
  else if (!online) startProbing();
  return () => {
    started = false;
    window.removeEventListener("offline", goOffline);
    window.removeEventListener("online", checkOnline);
    stopProbing();
  };
}

/** The deadline of an action ran out (RF-18). */
export class ConnectionTimeout extends Error {
  constructor() {
    super("timeout");
    this.name = "ConnectionTimeout";
  }
}

/**
 * True for an error that means "no network": a fetch that could not leave
 * (TypeError), the 10 s deadline, or the browser saying it is offline.
 */
export function isNetworkError(error: unknown): boolean {
  return (
    error instanceof ConnectionTimeout ||
    error instanceof TypeError ||
    (typeof navigator !== "undefined" && !navigator.onLine)
  );
}

/**
 * Runs an action against the server. A network failure or 10 s with no
 * answer puts the app offline and rejects; an answer puts it online (RF-18).
 */
export async function withTimeout<T>(
  work: Promise<T>,
  ms = ACTION_DEADLINE_MS,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new ConnectionTimeout()), ms);
  });
  try {
    const result = await Promise.race([work, deadline]);
    set(true);
    return result;
  } catch (error) {
    if (isNetworkError(error)) set(false);
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

/** Back to the start, for tests. */
export function resetConnection() {
  stopProbing();
  online = true;
  started = false;
  listeners.clear();
}
