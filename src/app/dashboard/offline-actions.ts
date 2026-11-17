"use server";

import { revalidatePath } from "next/cache";
import { getProfileTimeZone } from "@/lib/calendar/queries";
import { offlineChangeSchema } from "@/lib/offline/schemas";
import type { Snapshot } from "@/lib/offline/snapshot";
import { createClient } from "@/lib/supabase/server";
import { readSnapshot } from "./offline-reads";
import { applyChange, type ApplyResult } from "./offline-writes";

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

const INVALID = "No se ha podido enviar este cambio: no es válido.";

/**
 * One change made offline, replayed with the user's session (RF-38 to RF-58).
 * `force` writes over what is on the server, for "Conservar la mía" (RF-58).
 */
export async function applyOfflineChange(
  change: unknown,
  options: { force?: boolean } = {},
): Promise<ApplyResult | Unauthenticated> {
  const parsed = offlineChangeSchema.safeParse(change);
  if (!parsed.success) return { status: "rejected", reason: INVALID };
  const current = await session();
  if (!current) return { unauthenticated: true };
  let timeZone: string;
  try {
    timeZone = await getProfileTimeZone(current.supabase, current.userId);
  } catch {
    return { status: "retry" };
  }
  const result = await applyChange(
    current.supabase,
    current.userId,
    timeZone,
    parsed.data,
    options.force === true,
  );
  if (result.status === "applied") revalidatePath("/dashboard", "layout");
  return result;
}
