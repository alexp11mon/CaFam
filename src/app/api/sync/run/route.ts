import { createClient } from "@supabase/supabase-js";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/supabase/env";
import { runDue } from "@/lib/sync/run-sync";
import type { Database } from "@/types/database";
import { hasCronSecret } from "@/lib/auth/cron-secret";

// One run handles at most 50 s of work (plan D19).
export const maxDuration = 60;

/**
 * Woken up by pg_cron through pg_net when there is work, every minute since
 * spec 020 (spec 007 plan D2, D4; RF-22). No session and no service role key: the secret opens the sync
 * functions.
 */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || !hasCronSecret(request)) {
    return Response.json({ ok: false }, { status: 401 });
  }

  const supabase = createClient<Database>(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY,
    { auth: { persistSession: false } },
  );
  try {
    const calendars = await runDue({
      supabase,
      secret,
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      // Without it no Google channels are made (spec 020 D8).
      pushUrl: process.env.SYNC_PUSH_URL || undefined,
    });
    return Response.json({ ok: true, calendars });
  } catch {
    return Response.json({ ok: false }, { status: 500 });
  }
}
