// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getRouteAccess } from "@/lib/auth/route-access";

// Spec 006, T10: Auth links land on /auth/confirm with a token_hash, which is
// verified on the server (plan D8; RF-2, RF-3, RF-11, RF-12).
const { verifyOtp } = vi.hoisted(() => ({ verifyOtp: vi.fn() }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { verifyOtp } }),
}));

import { GET } from "@/app/auth/confirm/route";

function confirm(query: string) {
  return GET(new Request(`https://cafam.test/auth/confirm?${query}`));
}

function location(response: Response): string {
  return (
    new URL(response.headers.get("location") ?? "", "https://cafam.test")
      .pathname +
    new URL(response.headers.get("location") ?? "", "https://cafam.test").search
  );
}

beforeEach(() => {
  verifyOtp.mockReset();
  verifyOtp.mockResolvedValue({ error: null });
});

describe("/auth/confirm (RF-2, RF-11)", () => {
  it("a valid recovery link verifies the token and goes to reset-password (RF-2)", async () => {
    const response = await confirm("type=recovery&token_hash=abc123");

    expect(verifyOtp).toHaveBeenCalledWith({
      type: "recovery",
      token_hash: "abc123",
    });
    expect(response.status).toBe(303);
    expect(location(response)).toBe("/reset-password");
  });

  it("a valid email change link goes to settings (RF-11)", async () => {
    const response = await confirm("type=email_change&token_hash=xyz789");

    expect(verifyOtp).toHaveBeenCalledWith({
      type: "email_change",
      token_hash: "xyz789",
    });
    expect(location(response)).toBe("/dashboard/settings");
  });

  it("ignores any next parameter, so it cannot redirect elsewhere", async () => {
    const response = await confirm(
      "type=recovery&token_hash=abc123&next=https://evil.example",
    );

    expect(location(response)).toBe("/reset-password");
  });
});

describe("/auth/confirm failures (RF-3, RF-12)", () => {
  it("an expired or used recovery link goes to forgot-password with a notice (RF-3)", async () => {
    verifyOtp.mockResolvedValue({ error: { code: "otp_expired" } });

    const response = await confirm("type=recovery&token_hash=old");

    expect(location(response)).toBe("/forgot-password?expired=1");
  });

  it("an invalid email change link changes nothing and says so in settings (RF-12)", async () => {
    verifyOtp.mockResolvedValue({ error: { code: "otp_expired" } });

    const response = await confirm("type=email_change&token_hash=old");

    expect(location(response)).toBe("/dashboard/settings?confirm=invalid");
  });

  it("a missing token never reaches Auth", async () => {
    const response = await confirm("type=recovery");

    expect(verifyOtp).not.toHaveBeenCalled();
    expect(location(response)).toBe("/forgot-password?expired=1");
  });

  it("an unknown type never reaches Auth and goes to login", async () => {
    const response = await confirm("type=signup&token_hash=abc123");

    expect(verifyOtp).not.toHaveBeenCalled();
    expect(location(response)).toBe("/login");
  });
});

describe("/auth/confirm is public (plan D8)", () => {
  it("is reachable with and without a session", () => {
    expect(getRouteAccess("/auth/confirm", false)).toEqual({ type: "allow" });
    expect(getRouteAccess("/auth/confirm", true)).toEqual({ type: "allow" });
  });
});
