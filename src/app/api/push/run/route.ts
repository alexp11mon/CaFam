import { hasCronSecret } from "@/lib/auth/cron-secret";
import { pushClient, runPush, vapidFromEnv } from "@/lib/push/run";

export const maxDuration = 60;

/**
 * Woken up each minute by pg_cron through pg_net when there is something to
 * send (spec 040, RNF-2). No session and no service role key: the secret
 * opens the send functions.
 */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || !hasCronSecret(request)) {
    return Response.json({ ok: false }, { status: 401 });
  }
  const vapid = vapidFromEnv();
  if (!vapid) {
    console.warn("push: missing VAPID keys");
    return Response.json({ ok: false }, { status: 500 });
  }

  try {
    const sent = await runPush(pushClient(), secret, vapid);
    return Response.json({ ok: true, sent });
  } catch (error) {
    console.warn("push run failed", error);
    return Response.json({ ok: false }, { status: 500 });
  }
}
