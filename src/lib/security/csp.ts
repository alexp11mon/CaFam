import { createHash } from "node:crypto";

// Spec 051 RF-6 to RF-8: the Content-Security-Policy, built for next.config.
// Next inserts inline scripts of its own (RSC data) that change on every
// request and cannot be hashed with Partial Prerendering, and a nonce would
// make every page dynamic (plan D3): the applied policy keeps
// 'unsafe-inline' for scripts; the Report-Only one (strict) tells whether it
// could be tightened.

/** The CSP source of an inline script: its SHA-256 in base64. */
export function scriptHash(script: string): string {
  return `'sha256-${createHash("sha256").update(script).digest("base64")}'`;
}

export function buildCsp({
  supabaseUrl,
  scriptHashes = [],
  strict = false,
  dev = false,
}: {
  supabaseUrl: string | undefined;
  scriptHashes?: string[];
  strict?: boolean;
  dev?: boolean;
}): string {
  const supabase = supabaseUrl ? new URL(supabaseUrl).origin : null;
  const realtime = supabase ? supabase.replace(/^http/, "ws") : null;
  const list = (...sources: (string | null | false)[]) =>
    sources.filter(Boolean).join(" ");

  const directives: [string, string][] = [
    ["default-src", "'self'"],
    [
      "script-src",
      list(
        "'self'",
        strict ? scriptHashes.join(" ") : "'unsafe-inline'",
        dev && "'unsafe-eval'",
      ),
    ],
    // React's style props and data colours are inline styles.
    ["style-src", "'self' 'unsafe-inline'"],
    ["img-src", list("'self' blob: data:", supabase)],
    ["font-src", "'self'"],
    ["connect-src", list("'self'", supabase, realtime, dev && "ws:")],
    ["object-src", "'none'"],
    ["base-uri", "'self'"],
    // Signing in with Google goes through Supabase and Google (050, 007).
    ["form-action", list("'self'", supabase, "https://accounts.google.com")],
    ["frame-ancestors", "'none'"],
    ["manifest-src", "'self'"],
    ["worker-src", "'self'"],
  ];
  if (strict) directives.push(["report-uri", "/api/csp-report"]);
  return directives.map(([name, value]) => `${name} ${value}`).join("; ");
}
