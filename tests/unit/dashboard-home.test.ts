// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { homeHref, isHome } from "@/lib/now/home";

// Spec 054 T7: /dashboard opens the account's home screen (RF-25, plan D5).
const profile = vi.hoisted(() => ({ home: "calendar" as string }));
const redirect = vi.hoisted(() =>
  vi.fn((href: string) => {
    throw new Error(`redirect:${href}`);
  }),
);
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("@/lib/calendar/queries", () => ({
  requireUser: async () => ({ supabase: {}, userId: "me" }),
  getCalendarProfile: async () => ({ home: profile.home }),
}));

const { HomeRedirect } = await import("@/app/dashboard/home-redirect");

beforeEach(() => {
  redirect.mockClear();
});

describe("homeHref", () => {
  it("goes to Ahora or to the calendar, which is the default", () => {
    expect(homeHref("now")).toBe("/dashboard/now");
    expect(homeHref("calendar")).toBe("/dashboard/calendar");
    expect(homeHref(undefined)).toBe("/dashboard/calendar");
    expect(homeHref("notes")).toBe("/dashboard/calendar");
    expect(isHome("now")).toBe(true);
    expect(isHome("notes")).toBe(false);
  });
});

describe("HomeRedirect", () => {
  it.each([
    ["now", "/dashboard/now"],
    ["calendar", "/dashboard/calendar"],
  ])("home %s → %s", async (home, href) => {
    profile.home = home;
    await expect(
      HomeRedirect({ searchParams: Promise.resolve({}) }),
    ).rejects.toThrow(`redirect:${href}`);
  });

  it("keeps the query, like the zone check of a new account", async () => {
    profile.home = "now";
    await expect(
      HomeRedirect({
        searchParams: Promise.resolve({ tzcheck: "Europe/Madrid" }),
      }),
    ).rejects.toThrow("redirect:/dashboard/now?tzcheck=Europe%2FMadrid");
  });
});
