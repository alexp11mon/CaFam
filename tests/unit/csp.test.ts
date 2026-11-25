// @vitest-environment node
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { buildCsp, scriptHash } from "@/lib/security/csp";

// Spec 051, T3: the Content-Security-Policy (RF-6 to RF-8, plan D3).
const SUPABASE = "https://abc.supabase.co";

function directives(policy: string): Record<string, string> {
  return Object.fromEntries(
    policy.split(";").map((part) => {
      const [name, ...values] = part.trim().split(/\s+/);
      return [name, values.join(" ")];
    }),
  );
}

describe("buildCsp", () => {
  it("allows only the app and Supabase (RF-6)", () => {
    const csp = directives(buildCsp({ supabaseUrl: SUPABASE }));
    expect(csp).toMatchObject({
      "default-src": "'self'",
      "connect-src": `'self' ${SUPABASE} wss://abc.supabase.co`,
      "img-src": `'self' blob: data: ${SUPABASE}`,
      "object-src": "'none'",
      "base-uri": "'self'",
      "form-action": `'self' ${SUPABASE} https://accounts.google.com`,
      "frame-ancestors": "'none'",
      "manifest-src": "'self'",
      "worker-src": "'self'",
    });
  });

  it("applies 'unsafe-inline' scripts and reports the strict hash (RF-7, RF-8, D3)", () => {
    const hash = scriptHash("alert(1)");
    expect(hash).toBe(
      `'sha256-${createHash("sha256").update("alert(1)").digest("base64")}'`,
    );
    const applied = directives(
      buildCsp({ supabaseUrl: SUPABASE, scriptHashes: [hash] }),
    );
    expect(applied["script-src"]).toBe("'self' 'unsafe-inline'");
    expect(applied["report-uri"]).toBeUndefined();

    const strict = directives(
      buildCsp({ supabaseUrl: SUPABASE, scriptHashes: [hash], strict: true }),
    );
    expect(strict["script-src"]).toBe(`'self' ${hash}`);
    expect(strict["report-uri"]).toBe("/api/csp-report");
  });

  it("lets the dev server evaluate and reload (only in development)", () => {
    const dev = directives(buildCsp({ supabaseUrl: SUPABASE, dev: true }));
    expect(dev["script-src"]).toContain("'unsafe-eval'");
    expect(dev["connect-src"]).toContain("ws:");
    const prod = buildCsp({ supabaseUrl: SUPABASE });
    expect(prod).not.toContain("unsafe-eval");
    expect(prod).not.toMatch(/ ws: /);
  });

  it("still works without a Supabase URL", () => {
    const csp = directives(buildCsp({ supabaseUrl: undefined }));
    expect(csp["connect-src"]).toBe("'self'");
  });
});
