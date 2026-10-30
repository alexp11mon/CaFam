import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TimeGrid } from "@/components/calendar/time-grid";
import type { CalendarEventItem } from "@/lib/calendar/layout";

const TZ = "Europe/Madrid";
const WEEK = [19, 20, 21, 22, 23, 24, 25].map((day) => `2026-10-${day}`);

function event(
  id: string,
  startsAt: string,
  endsAt: string,
  extra: Partial<CalendarEventItem> = {},
): CalendarEventItem {
  return {
    id,
    title: id,
    startsAt,
    endsAt,
    allDay: false,
    color: "#A0C4FF",
    calendarId: "cal",
    categoryId: null,
    ...extra,
  };
}

function renderGrid({
  days = WEEK,
  events = [] as CalendarEventItem[],
  today = "2026-10-21",
  onCreate = undefined as Parameters<typeof TimeGrid>[0]["onCreate"],
} = {}) {
  return render(
    <TimeGrid
      days={days}
      events={events}
      timeZone={TZ}
      today={today}
      linkDays
      onCreate={onCreate}
    />,
  );
}

afterEach(() => {
  vi.useRealTimers();
});

// Spec 016, T8: the week and the day as in Google (RF-38..RF-46).
describe("TimeGrid", () => {
  it("heads each day with its initial and a big number, today in a circle (RF-38, RF-39)", () => {
    renderGrid();

    const headers = screen.getAllByTestId("day-header");
    expect(headers).toHaveLength(7);
    expect(headers[0]).toHaveTextContent("L19");
    const today = within(headers[2]!).getByRole("link");
    expect(today).toHaveAttribute("aria-current", "date");
    expect(today).toHaveClass("bg-accent", "rounded-full", "text-2xl");
    expect(within(headers[2]!).getByText("X")).toHaveClass("text-accent-ink");
    expect(within(headers[3]!).getByText("J")).not.toHaveClass(
      "text-accent-ink",
    );
  });

  it("puts all-day and multi-day events in a strip as one-line blocks (RF-40)", () => {
    renderGrid({
      events: [
        event("Viaje", "2026-10-20T00:00:00Z", "2026-10-23T00:00:00Z", {
          allDay: true,
        }),
      ],
    });

    const strip = screen.getByTestId("banner-strip");
    const blocks = within(strip).getAllByRole("link", { name: /Viaje/ });
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toHaveClass("truncate");
    expect(blocks[0]).toHaveStyle({ gridColumn: "3 / span 3" });
  });

  it("fills a timed block with its color, the title in bold and the place under it (RF-41, RF-42)", () => {
    renderGrid({
      events: [
        event("Clase", "2026-10-21T07:15:00Z", "2026-10-21T09:15:00Z", {
          location: "Academia",
        }),
      ],
    });

    const block = screen.getByRole("link", { name: /Clase/ });
    expect(block).toHaveStyle({ backgroundColor: "#A0C4FF" });
    expect(block).toHaveClass("break-words", "overflow-hidden");
    expect(within(block).getByText("Clase")).toHaveClass("font-bold");
    expect(within(block).getByText("Academia")).toBeInTheDocument();
    expect(within(block).getByText("09:15,")).toHaveClass("sr-only");
  });

  it("labels the hours as 9:00 (RF-44)", () => {
    renderGrid();

    expect(screen.getByText("9:00")).toBeInTheDocument();
    expect(screen.getByText("23:00")).toBeInTheDocument();
    expect(screen.queryByText("09:00")).toBeNull();
  });

  it("draws the now line with its dot only on today (RF-43)", () => {
    renderGrid();

    const lines = screen.getAllByTestId("now-line");
    expect(lines).toHaveLength(1);
    expect(lines[0]!.querySelector("[data-now-dot]")).not.toBeNull();
    expect(lines[0]!.closest("[data-day]")).toHaveAttribute(
      "data-day",
      "2026-10-21",
    );
  });

  it("opens at the current hour less one when today is visible (RF-45)", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-21T10:30:00Z")); // 12:30 in Madrid
    renderGrid();

    expect(screen.getByTestId("time-grid").parentElement!.scrollTop).toBe(
      11.5 * 48,
    );
  });

  it("opens at 7:00 without today", () => {
    renderGrid({ today: "2026-11-30" });

    expect(screen.getByTestId("time-grid").parentElement!.scrollTop).toBe(
      7 * 48,
    );
  });

  it("fills the screen and fits the seven days at any width (plan time-grid)", () => {
    renderGrid();

    const scroller = screen.getByTestId("time-grid").parentElement!;
    expect(scroller).toHaveClass("overflow-y-auto", "flex-1");
    // The seven columns always fit: no minimum width (spec 016, T12 review).
    const inner = scroller.parentElement!;
    expect(inner.style.minWidth).toBe("");
    expect(inner.className).not.toMatch(/min-w-/);
  });

  it("keeps creating on the slots for whoever can create (RF-46)", () => {
    renderGrid({ onCreate: vi.fn() });
    expect(screen.getAllByTestId("slot-layer")).toHaveLength(7);
  });
});
