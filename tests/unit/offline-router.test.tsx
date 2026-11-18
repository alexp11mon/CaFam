import { act, render } from "@testing-library/react";
import Link from "next/link";
import { afterEach, describe, expect, it } from "vitest";
import {
  matchRoute,
  navigateOffline,
  OfflineRouter,
  safeFrom,
  useOfflineLocation,
} from "@/components/offline/offline-router";

// Spec 034 T9: the screens of the offline app and their addresses (RF-8,
// RF-16, RF-17, plan D16).
describe("matchRoute", () => {
  it("knows the screens that work offline", () => {
    expect(matchRoute("/dashboard")).toEqual({ kind: "calendar" });
    expect(matchRoute("/dashboard/calendar")).toEqual({ kind: "calendar" });
    expect(matchRoute("/dashboard/events/new")).toEqual({ kind: "newEvent" });
    expect(matchRoute("/dashboard/events/abc_20261102T080000Z")).toEqual({
      kind: "event",
      id: "abc_20261102T080000Z",
    });
    expect(matchRoute("/dashboard/notes")).toEqual({ kind: "notes" });
    // Spec 039 RF-10.
    expect(matchRoute("/dashboard/search")).toEqual({ kind: "search" });
    expect(matchRoute("/dashboard/notes/new")).toEqual({ kind: "newNote" });
    expect(matchRoute("/dashboard/notes/n1")).toEqual({
      kind: "note",
      id: "n1",
    });
  });

  it("says the rest of the panel needs a connection, and leaves other pages", () => {
    expect(matchRoute("/dashboard/settings")).toEqual({ kind: "needsNetwork" });
    expect(matchRoute("/dashboard/calendars/1/share")).toEqual({
      kind: "needsNetwork",
    });
    expect(matchRoute("/privacy")).toBeNull();
    expect(matchRoute("/login")).toBeNull();
  });
});

describe("safeFrom", () => {
  it("keeps a path of the panel with its query", () => {
    expect(
      safeFrom(
        "?from=%2Fdashboard%2Fcalendar%3Fview%3Dmonth%26date%3D2026-11-02",
      ),
    ).toBe("/dashboard/calendar?view=month&date=2026-11-02");
    expect(safeFrom("?from=%2Fdashboard")).toBe("/dashboard");
  });

  it("never goes to another site or outside the panel", () => {
    for (const from of [
      "",
      "?from=https%3A%2F%2Fevil.test",
      "?from=%2F%2Fevil.test%2Fdashboard",
      "?from=%2Fdashboardx",
      "?from=%2Flogin",
    ]) {
      expect(safeFrom(from)).toBe("/dashboard/calendar");
    }
  });
});

function Where() {
  return <p data-testid="where">{useOfflineLocation()}</p>;
}

describe("OfflineRouter", () => {
  afterEach(() => window.history.replaceState(null, "", "/"));

  it("turns a click on a panel link into a change of address, with no load", () => {
    const { getByTestId, getByText } = render(
      <>
        <OfflineRouter />
        <Where />
        <Link href="/dashboard/notes">Notas</Link>
        <a href="/privacy">Privacidad</a>
      </>,
    );
    act(() => getByText("Notas").click());
    expect(getByTestId("where")).toHaveTextContent("/dashboard/notes");

    act(() => navigateOffline("/dashboard/calendar?view=week"));
    expect(getByTestId("where")).toHaveTextContent(
      "/dashboard/calendar?view=week",
    );
    act(() => window.history.back());
  });
});
