import { createClient } from "@supabase/supabase-js";
import { purgeObjects } from "@/lib/images/purge";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/supabase/env";
import type { Database } from "@/types/database";

export const maxDuration = 60;

/**
 * Woken up every hour by pg_cron through pg_net (spec 012, plan D7; RF-16 to
 * RF-18). No session and no service role key: the secret opens the purge.
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
    const removed = await purgeObjects(supabase, secret);
    return Response.json({ ok: true, removed });
  } catch {
    return Response.json({ ok: false }, { status: 500 });
  }
}
