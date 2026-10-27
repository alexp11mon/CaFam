import { createClient } from "@supabase/supabase-js";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/supabase/env";
import { runDue } from "@/lib/sync/run-sync";
import type { Database } from "@/types/database";

// One run handles at most 50 s of work (plan D19).
export const maxDuration = 60;

/**
 * Woken up every hour by pg_cron through pg_net (spec 007; plan D2, D4;
 * RF-22). No session and no service role key: the secret opens the sync
 * functions.
 */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
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
    });
    return Response.json({ ok: true, calendars });
  } catch {
    return Response.json({ ok: false }, { status: 500 });
  }
}
