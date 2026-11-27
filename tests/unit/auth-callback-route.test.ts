// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getRouteAccess } from "@/lib/auth/route-access";

// Spec 050, T2: /auth/callback turns Google's code into the session (RF-2,
// RF-9, RNF-2).
const TOKEN = "abcDEF123-_abcDEF123-_abcDEF123-_abcDEF123-_";
const exchangeCodeForSession = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { exchangeCodeForSession },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: { time_zone: "Europe/Madrid" } }),
        }),
      }),
    }),
  }),
}));

const { GET } = await import("@/app/auth/callback/route");

async function land(query: string): Promise<string> {
  const response = await GET(
    new Request(`https://cafam.test/auth/callback?${query}`),
  );
  expect(response.status).toBe(303);
  const url = new URL(response.headers.get("location")!);
  return url.pathname + url.search;
}

beforeEach(() => {
  exchangeCodeForSession.mockReset();
  exchangeCodeForSession.mockResolvedValue({ error: null });
});

describe("/auth/callback", () => {
  it("enters the calendar, or the invite of next", async () => {
    expect(await land("code=abc")).toBe("/dashboard");
    expect(exchangeCodeForSession).toHaveBeenCalledWith("abc");
    expect(await land(`code=abc&next=%2Finvite%2F${TOKEN}`)).toBe(
      `/invite/${TOKEN}`,
    );
    expect(await land("code=abc&next=https%3A%2F%2Fevil.test")).toBe(
      "/dashboard",
    );
  });

  it("tells a cancel from an error (RF-9)", async () => {
    expect(await land("error=access_denied")).toBe("/login?google=cancelled");
    expect(await land("error=server_error")).toBe("/login?google=error");
    exchangeCodeForSession.mockResolvedValue({ error: { code: "bad_code" } });
    expect(await land("code=abc")).toBe("/login?google=error");
    expect(exchangeCodeForSession).toHaveBeenCalledOnce();
  });

  it("is reachable with and without a session (RNF-2)", () => {
    expect(getRouteAccess("/auth/callback", false)).toEqual({ type: "allow" });
    expect(getRouteAccess("/auth/callback", true)).toEqual({ type: "allow" });
  });

  it("a new account made with Google checks its zone (RF-4)", async () => {
    exchangeCodeForSession.mockResolvedValue({
      data: {
        user: {
          id: "u1",
          created_at: new Date().toISOString(),
          user_metadata: { full_name: "Ana" },
        },
      },
      error: null,
    });
    expect(await land("code=abc")).toBe("/dashboard?tzcheck=Europe%2FMadrid");
    exchangeCodeForSession.mockResolvedValue({
      data: {
        user: {
          id: "u1",
          created_at: "2026-01-01T00:00:00Z",
          user_metadata: {},
        },
      },
      error: null,
    });
    expect(await land("code=abc")).toBe("/dashboard");
  });
});
