import { exportIcs } from "@/lib/ics/export-queries";
import { createClient } from "@/lib/supabase/server";

// Spec 043 RF-1, RF-2: downloads a calendar (`?calendar=<id>`) or the visible
// ones (`?visible=1`) as .ics, read with the session (RLS decides what is seen).
export async function GET(request: Request) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return new Response(null, { status: 401 });

  const params = new URL(request.url).searchParams;
  const calendarId = params.get("calendar");
  const target = calendarId
    ? { calendarId }
    : params.get("visible") === "1"
      ? ({ visible: true } as const)
      : null;
  const result = target
    ? await exportIcs(supabase, userId, target, new Date())
    : null;
  if (!result) return new Response(null, { status: 404 });

  // An ASCII fallback for old clients, the real name in filename* (RFC 6266).
  const ascii = result.filename.replace(/[^\x20-\x7e]|["\\]/g, "_");
  return new Response(result.text, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(result.filename)}`,
      "Cache-Control": "private, no-store",
    },
  });
}
