// @vitest-environment node
import { describe, expect, it } from "vitest";
import { newChannel, shouldRenew } from "@/lib/sync/channel";

// Spec 020, T10: Google notification channels (plan D8, D10; RF-20).
describe("newChannel", () => {
  it("makes a uuid id and a long random token, different each time", () => {
    const a = newChannel();
    const b = newChannel();
    expect(a.id).toMatch(/^[0-9a-f-]{36}$/);
    // Google accepts up to 256 characters in the token.
    expect(a.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(a.id).not.toBe(b.id);
    expect(a.token).not.toBe(b.token);
  });
});

describe("shouldRenew", () => {
  const now = new Date("2026-11-08T12:00:00Z");

  it.each([
    ["no channel", null, true],
    ["expires in 23 h", "2026-11-09T11:00:00Z", true],
    ["already expired", "2026-11-08T11:00:00Z", true],
    ["expires in 25 h", "2026-11-09T13:00:00Z", false],
    ["expires in 6 days", "2026-11-14T12:00:00Z", false],
  ])("%s → %s", (_, expiresAt, renew) => {
    expect(shouldRenew(expiresAt, now)).toBe(renew);
  });
});
