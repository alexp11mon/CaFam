import { describe, expect, it } from "vitest";
import { buildInviteUrl } from "@/lib/sharing/invite-url";

const TOKEN = "abcDEF123-_abcDEF123-_abcDEF123-_abcDEF123-_";

function headers(values: Record<string, string>) {
  return new Headers(values);
}

describe("buildInviteUrl (RF-1, RF-2, plan D11)", () => {
  it("uses the forwarded host and protocol", () => {
    const url = buildInviteUrl(
      headers({
        "x-forwarded-host": "calendario-familia-five.vercel.app",
        "x-forwarded-proto": "https",
        host: "internal:3000",
      }),
      TOKEN,
    );
    expect(url).toBe(
      `https://calendario-familia-five.vercel.app/invite/${TOKEN}`,
    );
  });

  it("falls back to the host header, https by default", () => {
    expect(buildInviteUrl(headers({ host: "example.com" }), TOKEN)).toBe(
      `https://example.com/invite/${TOKEN}`,
    );
  });

  it("uses http for localhost", () => {
    expect(buildInviteUrl(headers({ host: "localhost:3000" }), TOKEN)).toBe(
      `http://localhost:3000/invite/${TOKEN}`,
    );
  });

  it("takes the first value of a comma separated forwarded list", () => {
    const url = buildInviteUrl(
      headers({
        "x-forwarded-host": "a.example.com, proxy.internal",
        "x-forwarded-proto": "https, http",
      }),
      TOKEN,
    );
    expect(url).toBe(`https://a.example.com/invite/${TOKEN}`);
  });

  it("encodes the token", () => {
    expect(buildInviteUrl(headers({ host: "example.com" }), "a b/c")).toBe(
      "https://example.com/invite/a%20b%2Fc",
    );
  });

  it("falls back to a relative path without any host", () => {
    expect(buildInviteUrl(headers({}), TOKEN)).toBe(`/invite/${TOKEN}`);
  });
});
