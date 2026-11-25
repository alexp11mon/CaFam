// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/csp-report/route";
import { getRouteAccess } from "@/lib/auth/route-access";

// Spec 051, T3: the reports of the Report-Only policy only go to the logs
// (RF-8).
const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
afterEach(() => warn.mockClear());

const report = (body: string) =>
  POST(
    new Request("https://cafam.test/api/csp-report", {
      method: "POST",
      headers: { "Content-Type": "application/csp-report" },
      body,
    }),
  );

describe("POST /api/csp-report", () => {
  it("logs a summary without the query of the page, and answers 204", async () => {
    const response = await report(
      JSON.stringify({
        "csp-report": {
          "document-uri": "https://cafam.test/invite/secret-token?x=1",
          "violated-directive": "script-src-elem",
          "effective-directive": "script-src-elem",
          "blocked-uri": "inline",
          "script-sample": "self.__next_f.push",
        },
      }),
    );
    expect(response.status).toBe(204);
    expect(warn).toHaveBeenCalledOnce();
    const line = String(warn.mock.calls[0]![0]);
    expect(line).toContain("csp-report");
    expect(line).toContain("script-src-elem");
    expect(line).toContain("inline");
    expect(line).not.toContain("secret-token");
    expect(line).not.toContain("x=1");
  });

  it("ignores bodies over 8 KB or not JSON", async () => {
    expect((await report("x".repeat(9000))).status).toBe(204);
    expect((await report("nope")).status).toBe(204);
    expect(warn).not.toHaveBeenCalled();
  });

  it("is public (the browser sends it without a session)", () => {
    expect(getRouteAccess("/api/csp-report", false)).toEqual({
      type: "allow",
    });
  });
});
