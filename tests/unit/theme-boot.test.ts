// @vitest-environment node
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { THEME_COLOR, THEME_COOKIE } from "@/lib/theme/theme";

// Spec 011, T6: the theme cookie follows the account (RF-4, RF-8, RF-11; plan
// theme-boot, "Modelo de datos").
const state = vi.hoisted(() => ({
  theme: "dark" as string | null,
  claims: null as object | null,
  set: vi.fn(),
  delete: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({ set: state.set, delete: state.delete }),
}));

vi.mock("next/font/google", () => ({
  Inter_Tight: () => ({ variable: "font" }),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      signInWithPassword: async () => ({
        data: { user: { id: "user-1" } },
        error: null,
      }),
      signUp: async () => ({ data: { session: {} }, error: null }),
      signOut: async () => ({ error: null }),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: state.theme === null ? null : { theme: state.theme },
          }),
        }),
      }),
    }),
  }),
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: { getClaims: async () => ({ data: { claims: state.claims } }) },
  }),
}));

vi.mock("@/lib/supabase/env", () => ({
  SUPABASE_URL: "http://localhost:54321",
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
}));

const { signIn, signOut, signUp } = await import("@/app/(auth)/actions");
const { updateSession } = await import("@/lib/supabase/proxy");
const { viewport } = await import("@/app/layout");

function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.append(key, value);
  return data;
}

const SIGN_IN = { email: "ana@example.com", password: "12345678" };

beforeEach(() => {
  state.set.mockClear();
  state.delete.mockClear();
});

describe("signIn writes the theme of the profile (RF-4)", () => {
  it.each(["light", "dark", "system"])("with %s", async (theme) => {
    state.theme = theme;
    await expect(
      signIn({ values: { email: "" } }, form(SIGN_IN)),
    ).rejects.toThrow("REDIRECT:");

    expect(state.set).toHaveBeenCalledWith(
      THEME_COOKIE,
      theme,
      expect.objectContaining({
        path: "/",
        maxAge: 60 * 60 * 24 * 365,
        sameSite: "lax",
        httpOnly: false,
      }),
    );
  });

  it("falls back to the system theme without a profile row", async () => {
    state.theme = null;
    await expect(
      signIn({ values: { email: "" } }, form(SIGN_IN)),
    ).rejects.toThrow("REDIRECT:");
    expect(state.set).toHaveBeenCalledWith(
      THEME_COOKIE,
      "system",
      expect.anything(),
    );
  });
});

describe("signUp and signOut forget the device theme (RF-2, RF-8)", () => {
  it("signUp deletes the cookie", async () => {
    await expect(
      signUp(
        { values: { displayName: "", email: "" } },
        form({ ...SIGN_IN, displayName: "Ana", timeZone: "Europe/Madrid" }),
      ),
    ).rejects.toThrow("REDIRECT:");
    expect(state.delete).toHaveBeenCalledWith(THEME_COOKIE);
  });

  it("signOut deletes the cookie", async () => {
    await expect(signOut()).rejects.toThrow("REDIRECT:/login");
    expect(state.delete).toHaveBeenCalledWith(THEME_COOKIE);
  });
});

describe("the proxy (RF-8)", () => {
  function request(path: string) {
    return new NextRequest(`http://localhost${path}`, {
      headers: { cookie: `${THEME_COOKIE}=dark` },
    });
  }

  it.each(["/login", "/dashboard/calendar"])(
    "deletes the cookie on %s without a session",
    async (path) => {
      state.claims = null;
      const response = await updateSession(request(path));
      expect(response.cookies.get(THEME_COOKIE)?.value).toBe("");
      expect(response.headers.get("set-cookie")).toMatch(
        new RegExp(`${THEME_COOKIE}=;.*Path=/`, "i"),
      );
    },
  );

  it("leaves it alone with a session", async () => {
    state.claims = { sub: "user-1" };
    const response = await updateSession(request("/dashboard/calendar"));
    expect(response.cookies.get(THEME_COOKIE)).toBeUndefined();
  });
});

describe("viewport.themeColor (RF-11, plan D12)", () => {
  it("has one color per scheme", () => {
    expect(viewport.themeColor).toEqual([
      { media: "(prefers-color-scheme: light)", color: THEME_COLOR.light },
      { media: "(prefers-color-scheme: dark)", color: THEME_COLOR.dark },
    ]);
  });
});
