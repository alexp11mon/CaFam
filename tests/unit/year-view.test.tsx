import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CalendarNavContext } from "@/components/calendar/calendar-nav";
import { YearView } from "@/components/calendar/year-view";
import { mergeMarks, yearMonths } from "@/lib/calendar/year";

// Spec 042 T4: the year view (RF-1 to RF-5).
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

function setup(
  load = vi.fn(async () => ({
    marks: {
      "2026-03-05": ["a", "b"],
      "2026-03-06": ["hidden"],
    },
  })),
) {
  const go = vi.fn();
  render(
    <CalendarNavContext value={go}>
      <YearView
        date="2026-11-19"
        today="2026-11-19"
        colors={{ a: "#A0C4FF", b: "#FFADAD", hidden: "#CAFFBF" }}
        visibleCalendarIds={new Set(["a", "b"])}
        loadYearMarks={load}
      />
    </CalendarNavContext>,
  );
  return { go, load };
}

describe("year helpers", () => {
  it("lists the 12 months of the year", () => {
    expect(yearMonths("2026-11-19")).toEqual([
      "2026-01",
      "2026-02",
      "2026-03",
      "2026-04",
      "2026-05",
      "2026-06",
      "2026-07",
      "2026-08",
      "2026-09",
      "2026-10",
      "2026-11",
      "2026-12",
    ]);
  });

  it("merges the database's rows with the series, each calendar once", () => {
    expect(
      mergeMarks(
        [
          { day: "2026-01-02", calendar_id: "a" },
          { day: "2026-01-02", calendar_id: "b" },
        ],
        { "2026-01-02": ["a", "c"], "2026-01-09": ["c"] },
      ),
    ).toEqual({ "2026-01-02": ["a", "b", "c"], "2026-01-09": ["c"] });
  });
});

describe("YearView", () => {
  it("draws the 12 months, Monday first, in columns by width", async () => {
    setup();
    const months = [...document.querySelectorAll("section")];
    expect(months).toHaveLength(12);
    expect(months[0]).toHaveAccessibleName("enero");
    expect(
      within(months[0]!)
        .getAllByRole("columnheader")
        .map((h) => h.textContent),
    ).toEqual(["L", "M", "X", "J", "V", "S", "D"]);
    // 1 column on a phone, 2 from 769 px, 3 from 1024 and 4 from 1280 (RF-1).
    expect(screen.getByTestId("year-grid")).toHaveClass(
      "grid-cols-1",
      "tab:grid-cols-2",
      "lg:grid-cols-3",
      "xl:grid-cols-4",
    );
    // Only the days of each month: 365 links in 2026.
    expect(document.querySelectorAll('a[href*="view=day"]')).toHaveLength(365);
    await screen.findByLabelText(/5 de marzo.*con eventos/);
  });

  it("marks today and the visible calendars' days with dots", async () => {
    setup();
    const day = await screen.findByLabelText(/5 de marzo.*con eventos/);
    expect(day.querySelectorAll("[data-dot]")).toHaveLength(2);
    // A hidden calendar leaves no mark.
    expect(
      screen.getByLabelText(/^viernes, 6 de marzo de 2026$/),
    ).toBeInTheDocument();
    const today = screen.getByLabelText(/19 de noviembre.*hoy/);
    expect(today).toHaveAttribute("aria-current", "date");
    expect(today).toHaveClass("bg-accent");
  });

  it("opens the day view from a day and the month view from a name (RF-3)", () => {
    const { go } = setup();
    fireEvent.click(screen.getByLabelText(/^jueves, 5 de marzo/));
    expect(go).toHaveBeenLastCalledWith("day", "2026-03-05", undefined);
    fireEvent.click(screen.getByText("marzo"));
    expect(go).toHaveBeenLastCalledWith("month", "2026-03-01", undefined);
  });

  it("offers to retry when the marks cannot be read", async () => {
    const load = vi
      .fn()
      .mockResolvedValueOnce({ error: "x" })
      .mockResolvedValue({ marks: {} });
    setup(load);
    await userEvent.click(
      await screen.findByRole("button", { name: "Reintentar" }),
    );
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
    expect(load).toHaveBeenCalledWith(2026);
  });
});
