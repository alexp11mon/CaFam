import { createClient } from "@supabase/supabase-js";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/supabase/env";
import { pushHeaders } from "@/lib/sync/channel";
import type { Database } from "@/types/database";

/**
 * Google's notices of changes (spec 020 plan D10, "Contratos"; RF-19, RF-21,
 * RF-24). Public: it only marks the calendar as pending, and sync_push ignores
 * an unknown channel or a wrong token. Always 200 without a body, so nothing
 * tells a valid notice from a false one; the body is never read.
 */
export async function POST(request: Request) {
  const notice = pushHeaders(request.headers);
  const secret = process.env.CRON_SECRET;
  if (notice && secret) {
    const supabase = createClient<Database>(
      SUPABASE_URL,
      SUPABASE_PUBLISHABLE_KEY,
      { auth: { persistSession: false } },
    );
    await Promise.resolve(
      supabase.rpc("sync_push", {
        p_secret: secret,
        p_channel_id: notice.channelId,
        p_token: notice.token,
        p_state: notice.state ?? "",
      }),
    ).catch(() => undefined);
  }
  return new Response(null, { status: 200 });
}
