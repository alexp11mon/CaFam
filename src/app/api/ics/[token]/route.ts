import { writeIcs, type IcsRow } from "@/lib/ics/write-ics";
import { createClient } from "@/lib/supabase/server";

// Spec 043 RF-9, RF-10, RNF-3: the secret subscription link. No session: the
// token is the only credential and ics_feed reads only its calendar.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const token = (await params).token.replace(/\.ics$/, "");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("ics_feed", { p_token: token });
  if (error) {
    const status =
      error.code === "CF404" ? 404 : error.code === "CF429" ? 429 : 503;
    return new Response(null, { status });
  }
  const feed = data as unknown as { name: string; rows: IcsRow[] };
  return new Response(
    writeIcs({ name: feed.name, rows: feed.rows, now: new Date() }),
    {
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Cache-Control": "private, max-age=900",
        "X-Robots-Tag": "noindex",
      },
    },
  );
}
