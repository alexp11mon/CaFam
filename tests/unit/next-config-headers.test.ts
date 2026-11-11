// @vitest-environment node
import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config";

describe("next.config headers (plan D12)", () => {
  it("keeps the invite token out of the Referer and out of search engines", async () => {
    const rules = (await nextConfig.headers?.()) ?? [];
    const invite = rules.find((rule) => rule.source === "/invite/:path*");

    expect(invite).toBeDefined();
    const headers = Object.fromEntries(
      invite!.headers.map(({ key, value }) => [key, value]),
    );
    expect(headers["Referrer-Policy"]).toBe("no-referrer");
    expect(headers["X-Robots-Tag"]).toBe("noindex");
  });

  it("still serves the service worker without cache", async () => {
    const rules = (await nextConfig.headers?.()) ?? [];

    expect(rules.some((rule) => rule.source === "/sw.js")).toBe(true);
  });
});

describe("next.config security headers (spec 023 RF-4, RF-5)", () => {
  it("sends them on every route, before the more specific rules", async () => {
    const rules = (await nextConfig.headers?.()) ?? [];

    // The last matching rule wins, so the global one must come first.
    expect(rules[0].source).toBe("/:path*");
    const headers = Object.fromEntries(
      rules[0].headers.map(({ key, value }) => [key, value]),
    );
    expect(headers).toEqual({
      "Content-Security-Policy": "frame-ancestors 'none'",
      "X-Frame-Options": "DENY",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "X-Robots-Tag": "noindex, nofollow",
    });
  });
});

describe("next.config Server Actions body limit (plan D7)", () => {
  it("allows a 2 MB file plus the multipart overhead", () => {
    expect(nextConfig.experimental?.serverActions?.bodySizeLimit).toBe("3mb");
  });
});
