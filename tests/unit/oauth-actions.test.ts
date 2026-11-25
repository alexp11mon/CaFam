// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

// Spec 050, T2: the action asks Supabase for Google's URL with PKCE and only
// the sign-in scopes, back to /auth/callback with a safe next (RF-2, RNF-1).
const TOKEN = "abcDEF123-_abcDEF123-_abcDEF123-_abcDEF123-_";
const signInWithOAuth = vi.hoisted(() => vi.fn());
const origin = vi.hoisted(() => ({
  value: "https://cafam.test" as string | null,
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));
vi.mock("next/headers", () => ({
  headers: async () =>
    new Headers(origin.value ? { origin: origin.value } : {}),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { signInWithOAuth } }),
}));

const { signInWithGoogle } = await import("@/app/(auth)/oauth-actions");

const form = (next: string) => {
  const data = new FormData();
  data.append("next", next);
  return data;
};

beforeEach(() => {
  origin.value = "https://cafam.test";
  signInWithOAuth.mockReset();
  signInWithOAuth.mockResolvedValue({
    data: { url: "https://accounts.google.com/o/oauth2/auth?x" },
    error: null,
  });
});

describe("signInWithGoogle", () => {
  it("goes to Google, keeping an invite as next", async () => {
    await expect(signInWithGoogle(form(`/invite/${TOKEN}`))).rejects.toThrow(
      "REDIRECT:https://accounts.google.com/o/oauth2/auth?x",
    );
    expect(signInWithOAuth).toHaveBeenCalledWith({
      provider: "google",
      options: {
        redirectTo: `https://cafam.test/auth/callback?next=${encodeURIComponent(`/invite/${TOKEN}`)}`,
        scopes: "openid email profile",
        skipBrowserRedirect: true,
      },
    });
  });

  it("never carries another next", async () => {
    await expect(signInWithGoogle(form("https://evil.test"))).rejects.toThrow();
    expect(signInWithOAuth.mock.calls[0]![0].options.redirectTo).toBe(
      "https://cafam.test/auth/callback?next=%2Fdashboard%2Fcalendar",
    );
  });

  it("goes back to login when Supabase refuses", async () => {
    signInWithOAuth.mockResolvedValue({
      data: { url: null },
      error: { code: "x" },
    });
    await expect(signInWithGoogle(form(""))).rejects.toThrow(
      "REDIRECT:/login?google=error",
    );
  });
});
