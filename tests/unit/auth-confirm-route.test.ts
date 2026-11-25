// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PENDING_COOKIE } from "@/lib/auth/pending";

// Spec 049, T2: the signup link enters the calendar with a notice, or the
// invite that started it (RF-2, RF-5).
const TOKEN = "abcDEF123-_abcDEF123-_abcDEF123-_abcDEF123-_";
const verifyOtp = vi.hoisted(() => vi.fn());
const jar = new Map<string, string>();

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      jar.has(name) ? { value: jar.get(name) } : undefined,
    delete: (name: string) => jar.delete(name),
  }),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { verifyOtp } }),
}));

const { GET } = await import("@/app/auth/confirm/route");

async function land(query: string): Promise<string> {
  const response = await GET(
    new Request(`https://cafam.test/auth/confirm?${query}`),
  );
  const url = new URL(response.headers.get("location")!);
  return url.pathname + url.search;
}

beforeEach(() => {
  jar.clear();
  verifyOtp.mockReset();
  verifyOtp.mockResolvedValue({ error: null });
});

describe("/auth/confirm for a sign-up (RF-2, RF-5)", () => {
  it.each(["signup", "email"])(
    "type=%s verifies and enters the calendar with the notice",
    async (type) => {
      expect(await land(`type=${type}&token_hash=abc`)).toBe(
        "/dashboard/calendar?confirmed=1",
      );
      expect(verifyOtp).toHaveBeenCalledWith({ type, token_hash: "abc" });
    },
  );

  it("goes on to the invite kept on this device and forgets it", async () => {
    jar.set(
      PENDING_COOKIE,
      JSON.stringify({ email: "a@b.es", next: `/invite/${TOKEN}` }),
    );
    expect(await land("type=signup&token_hash=abc")).toBe(`/invite/${TOKEN}`);
    expect(jar.has(PENDING_COOKIE)).toBe(false);
  });

  it("a dead link offers a new one", async () => {
    verifyOtp.mockResolvedValue({ error: { code: "otp_expired" } });
    expect(await land("type=signup&token_hash=abc")).toBe(
      "/signup/check-email?expired=1",
    );
  });
});
