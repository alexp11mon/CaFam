"use server";

import type { Snapshot } from "@/lib/offline/snapshot";
import { readSnapshot } from "./offline-reads";
import {
  applyWithSession,
  offlineSession,
  type Unauthenticated,
} from "./offline-session";
import type { ApplyResult } from "./offline-writes";

// The server side of the offline mode (spec 034 plan "Contratos e
// interfaces"). No session answers `unauthenticated` instead of redirecting:
// the browser keeps its changes until the same account is back (RF-63, D13).

export type { Unauthenticated };

/** The full copy of the user's data for offline use (RF-1 to RF-3). */
export async function loadOfflineSnapshot(): Promise<
  { snapshot: Snapshot } | { error: true } | Unauthenticated
> {
  const current = await offlineSession();
  if (!current) return { unauthenticated: true };
  try {
    return {
      snapshot: await readSnapshot(current.supabase, current.userId),
    };
  } catch {
    return { error: true };
  }
}

/**
 * One change made offline, replayed with the user's session (RF-38 to RF-58).
 * `force` writes over what is on the server, for "Conservar la mía" (RF-58).
 */
export async function applyOfflineChange(
  change: unknown,
  options: { force?: boolean } = {},
): Promise<ApplyResult | Unauthenticated> {
  return applyWithSession(change, options.force === true);
}
