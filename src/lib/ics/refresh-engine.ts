import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/supabase/env";
import type { Database, Json } from "@/types/database";
import { fetchIcs } from "./fetch-ics";
import {
  refreshOne,
  runRefresh,
  type DueSubscription,
  type RefreshDeps,
} from "./refresh";

// Server-only entry to the refresh engine (spec 044). No secret key: the
// secret opens the ics_* functions, like the sync of spec 007 (P4).

type Client = SupabaseClient<Database>;

function engineClient(): Client {
  return createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false },
  });
}

export function refreshDeps(supabase: Client, secret: string): RefreshDeps {
  return {
    async getUrl(calendarId) {
      const { data } = await supabase.rpc("ics_get_url", {
        p_secret: secret,
        p_calendar_id: calendarId,
      });
      return data ?? null;
    },
    fetchIcs,
    async apply({ calendarId, events, readAt, from, to }) {
      const { error } = await supabase.rpc("ics_apply_events", {
        p_secret: secret,
        p_calendar_id: calendarId,
        p_events: events as unknown as Json,
        p_read_at: readAt as string,
        p_from: from.toISOString(),
        p_to: to.toISOString(),
      });
      if (error) throw new Error(error.code);
    },
    async fail(calendarId, kind, message) {
      await supabase.rpc("ics_fail", {
        p_secret: secret,
        p_calendar_id: calendarId,
        p_kind: kind,
        p_message: message,
      });
    },
    now: () => new Date(),
  };
}

/** What pg_cron asks for: every due subscription, for 50 s at most. */
export function refreshDue(secret: string) {
  const supabase = engineClient();
  return runRefresh(
    async () => {
      const { data, error } = await supabase.rpc("ics_claim_due", {
        p_secret: secret,
      });
      if (error) throw new Error(error.code);
      return data ?? [];
    },
    refreshDeps(supabase, secret),
  );
}

export type RefreshNow =
  { status: "ok" } | { status: "failed" } | { status: "too_soon" };

/**
 * "Actualizar ahora" and "Reintentar" (RF-6, RF-10). The claim goes with the
 * user's session, so the database checks their role; the rest with the secret.
 */
export async function refreshNow(
  session: Client,
  calendarId: string,
): Promise<RefreshNow> {
  const secret = process.env.CRON_SECRET ?? "";
  const { data, error } = await session.rpc("ics_claim_one", {
    p_secret: secret,
    p_calendar_id: calendarId,
  });
  if (error) throw new Error(error.code);
  const claim = data as unknown as {
    status: "ok" | "too_soon";
  } & DueSubscription;
  if (claim.status === "too_soon") return claim;
  const result = await refreshOne(claim, refreshDeps(engineClient(), secret));
  return { status: result.ok ? "ok" : "failed" };
}
