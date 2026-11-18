import { revalidatePath } from "next/cache";
import { getProfileTimeZone } from "@/lib/calendar/queries";
import { offlineChangeSchema } from "@/lib/offline/schemas";
import { createClient } from "@/lib/supabase/server";
import { applyChange, type ApplyResult } from "./offline-writes";

// Shared by the Server Action and the service worker's route (spec 035 plan
// D5). Not a "use server" file: its exports must not become endpoints.

export type Unauthenticated = { unauthenticated: true };

export async function offlineSession() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims.sub;
  return userId ? { supabase, userId } : null;
}

const INVALID = "No se ha podido enviar este cambio: no es válido.";

/**
 * One change made offline, replayed with the user's session (spec 034
 * RF-38 to RF-58). `force` writes over what is on the server (RF-58).
 */
export async function applyWithSession(
  change: unknown,
  force: boolean,
): Promise<ApplyResult | Unauthenticated> {
  const parsed = offlineChangeSchema.safeParse(change);
  if (!parsed.success) return { status: "rejected", reason: INVALID };
  const current = await offlineSession();
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
    force,
  );
  if (result.status === "applied") revalidatePath("/dashboard", "layout");
  return result;
}
