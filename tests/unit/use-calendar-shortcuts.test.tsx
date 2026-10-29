import { fireEvent, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useCalendarShortcuts } from "@/lib/hooks/use-calendar-shortcuts";

// Spec 008, T12: what each shortcut does (RF-31, RF-46).
const router = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

const saveLastView = vi.fn(async () => ({}));

function Calendar({ canCreate = true }: { canCreate?: boolean }) {
  useCalendarShortcuts({
    view: "week",
    date: "2026-10-21",
    today: "2026-10-23",
    canCreate,
    saveLastView,
  });
  return <input type="text" aria-label="Buscar" />;
}

beforeEach(() => {
  router.push.mockClear();
  saveLastView.mockClear();
});

describe("useCalendarShortcuts", () => {
  it("N opens a new event on the shown date", () => {
    render(<Calendar />);
    fireEvent.keyDown(document.body, { key: "n" });
    expect(router.push).toHaveBeenCalledWith(
      "/dashboard/events/new?date=2026-10-21",
    );
  });

  it("T goes to today and the arrows move one period", () => {
    render(<Calendar />);
    fireEvent.keyDown(document.body, { key: "t" });
    fireEvent.keyDown(document.body, { key: "ArrowLeft" });
    fireEvent.keyDown(document.body, { key: "ArrowRight" });
    expect(router.push.mock.calls.map(([url]) => url)).toEqual([
      "/dashboard/calendar?view=week&date=2026-10-23",
      "/dashboard/calendar?view=week&date=2026-10-14",
      "/dashboard/calendar?view=week&date=2026-10-28",
    ]);
  });

  it("A, M, S and D change the view keeping the date and remember it", () => {
    render(<Calendar />);
    fireEvent.keyDown(document.body, { key: "m" });
    expect(router.push).toHaveBeenCalledWith(
      "/dashboard/calendar?view=month&date=2026-10-21",
      { transitionTypes: ["cal-view"] },
    );
    expect(saveLastView).toHaveBeenCalledWith("month");
  });

  it("leaves the keys alone while typing", () => {
    const { getByLabelText } = render(<Calendar />);
    fireEvent.keyDown(getByLabelText("Buscar"), { key: "m" });
    expect(router.push).not.toHaveBeenCalled();
  });

  it("has no N for a reader (RF-36)", () => {
    render(<Calendar canCreate={false} />);
    fireEvent.keyDown(document.body, { key: "n" });
    expect(router.push).not.toHaveBeenCalled();
  });
});

// Spec 011, T11: the shortcuts animate like the toolbar (RF-17, RF-18).
describe("useCalendarShortcuts transitions", () => {
  it("passes the transition type of each move to router.push", () => {
    render(<Calendar />);
    fireEvent.keyDown(document.body, { key: "t" });
    fireEvent.keyDown(document.body, { key: "ArrowLeft" });
    fireEvent.keyDown(document.body, { key: "ArrowRight" });
    fireEvent.keyDown(document.body, { key: "m" });
    expect(router.push.mock.calls.map(([, options]) => options)).toEqual([
      { transitionTypes: ["cal-next"] },
      { transitionTypes: ["cal-prev"] },
      { transitionTypes: ["cal-next"] },
      { transitionTypes: ["cal-view"] },
    ]);
  });
});
