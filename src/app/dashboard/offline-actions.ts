"use server";

import type { Snapshot } from "@/lib/offline/snapshot";
import { createClient } from "@/lib/supabase/server";
import { readSnapshot } from "./offline-reads";

// The server side of the offline mode (spec 034 plan "Contratos e
// interfaces"). No session answers `unauthenticated` instead of redirecting:
// the browser keeps its changes until the same account is back (RF-63, D13).

export type Unauthenticated = { unauthenticated: true };

async function session() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims.sub;
  return userId ? { supabase, userId } : null;
}

/** The full copy of the user's data for offline use (RF-1 to RF-3). */
export async function loadOfflineSnapshot(): Promise<
  { snapshot: Snapshot } | { error: true } | Unauthenticated
> {
  const current = await session();
  if (!current) return { unauthenticated: true };
  try {
    return {
      snapshot: await readSnapshot(current.supabase, current.userId),
    };
  } catch {
    return { error: true };
  }
}
