/**
 * Reports of the strict Report-Only policy (spec 051 RF-8): one summary line
 * in Vercel's logs, nothing stored. Only the path of the page is kept, never
 * its query (it may carry a token). Always 204.
 */
const MAX_BYTES = 8 * 1024;

export async function POST(request: Request) {
  const text = await request.text().catch(() => "");
  if (text.length <= MAX_BYTES) {
    try {
      const body = JSON.parse(text) as {
        "csp-report"?: Record<string, unknown>;
      };
      const report = body["csp-report"];
      if (report) {
        const field = (name: string) =>
          String(report[name] ?? "").slice(0, 200);
        let page = "";
        try {
          page = new URL(field("document-uri")).pathname.replace(
            /\/invite\/[^/]+/,
            "/invite/…",
          );
        } catch {}
        console.warn(
          `csp-report ${field("effective-directive") || field("violated-directive")} blocked=${field("blocked-uri")} page=${page}`,
        );
      }
    } catch {
      // Not JSON: nothing to log.
    }
  }
  return new Response(null, { status: 204 });
}
