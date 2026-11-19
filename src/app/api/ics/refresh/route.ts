import { hasCronSecret } from "@/lib/auth/cron-secret";
import { refreshDue } from "@/lib/ics/refresh-engine";

// One run handles at most 50 s of work (spec 044 RNF-1).
export const maxDuration = 60;

/** Woken up by pg_cron (ics_trigger) when an imported link is due (RF-7). */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || !hasCronSecret(request)) {
    return Response.json({ ok: false }, { status: 401 });
  }
  try {
    return Response.json({ ok: true, ...(await refreshDue(secret)) });
  } catch {
    return Response.json({ ok: false }, { status: 500 });
  }
}
