import { describe, expect, it } from "vitest";
import { activeSection, NAV_ITEMS } from "@/lib/shell/nav";

// Spec 005, T4: destinations of the side rail and the bottom bar, and which
// one is current (RF-16, RF-18, RF-20; plan nav).
describe("NAV_ITEMS", () => {
  it("lists the destinations of the app in Spanish", () => {
    expect(NAV_ITEMS.map(({ label, href }) => [label, href])).toEqual([
      ["Calendario", "/dashboard/calendar"],
      ["Mis calendarios", "/dashboard/calendars"],
      ["Unirme con código", "/dashboard/join"],
      ["Importar calendario", "/dashboard/import"],
      ["Ajustes", "/dashboard/settings"],
    ]);
  });
});

describe("activeSection (RF-20)", () => {
  it.each([
    ["/dashboard/calendar", "calendar"],
    ["/dashboard/events/new", "calendar"],
    ["/dashboard/events/0f6c", "calendar"],
    ["/dashboard/calendars", "calendars"],
    ["/dashboard/calendars/new", "calendars"],
    ["/dashboard/calendars/0f6c/share", "calendars"],
    ["/dashboard/join", "join"],
    ["/dashboard/import", "import"],
    ["/dashboard/settings", "settings"],
    ["/dashboard", null],
    ["/dashboard/calendarx", null],
    ["/login", null],
  ])("%s → %s", (pathname, section) => {
    expect(activeSection(pathname)).toBe(section);
  });
});
