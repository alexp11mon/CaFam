import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { BusyGridItem } from "@/components/calendar/busy-block";
import { DayView } from "@/components/calendar/day-view";
import { WeekView } from "@/components/calendar/week-view";
import type { CalendarEventItem } from "@/lib/calendar/layout";
import { getVisibleRange } from "@/lib/calendar/ranges";

// Spec 020, T7: busy blocks in the week and day grid (RF-8, RF-9, RF-11, RF-14,
// RF-15, RF-16; plan D6).
const TZ = "Europe/Madrid";
const TODAY = "2026-11-08";
const DAYS = getVisibleRange("week", "2026-11-10", TZ).days;
const ANA_TINT = "#EDC7C0";

const busy = (extra: Partial<BusyGridItem> = {}): BusyGridItem => ({
  id: "busy:ana:1",
  personId: "ana",
  name: "Ana García",
  tint: ANA_TINT,
  // 9:00–11:00 in Madrid (UTC+1 in November).
  startsAt: "2026-11-10T08:00:00.000Z",
  endsAt: "2026-11-10T10:00:00.000Z",
  allDay: false,
  ...extra,
});

const event: CalendarEventItem = {
  id: "e1",
  title: "Reunión",
  startsAt: "2026-11-10T08:00:00Z",
  endsAt: "2026-11-10T09:00:00Z",
  allDay: false,
  color: "#A0C4FF",
  calendarId: "cal",
  categoryId: null,
};

describe("busy blocks in the grid", () => {
  it("draws 'Ocupado · name' at its hours in the viewer's zone, with the person's tint and no pastel fill (RF-8, RF-9)", () => {
    render(
      <WeekView
        days={DAYS}
        events={[event]}
        busy={[busy()]}
        timeZone={TZ}
        today={TODAY}
      />,
    );
    const block = screen.getByRole("button", { name: /Ocupado · Ana García/ });
    expect(block).toHaveTextContent("09:00 – 11:00");
    // Placed by its wrapper, which also holds the note.
    const place = block.parentElement!;
    expect(place.style.top).toBe("432px"); // 9 h * 48 px
    expect(block).toHaveStyle({ borderLeftColor: ANA_TINT });
    expect(block.style.backgroundColor).toBe("");
    expect(block.className).toContain("bg-busy-hatch");
    // Shares the column with the event it overlaps.
    expect(place.style.width).toBe("50%");
  });

  it("is not an event: no link, no id, no drag, no menu (RF-15)", () => {
    render(
      <WeekView
        days={DAYS}
        events={[]}
        busy={[busy()]}
        timeZone={TZ}
        today={TODAY}
      />,
    );
    const block = screen.getByRole("button", { name: /Ocupado/ });
    expect(block.closest("[data-event-id]")).toBeNull();
    expect(block.closest("a")).toBeNull();
    fireEvent.contextMenu(block);
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("opens a note with the name and the hours only, and Escape closes it (RF-14)", async () => {
    render(
      <DayView
        day="2026-11-10"
        events={[]}
        busy={[busy()]}
        timeZone={TZ}
        today={TODAY}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: /Ocupado/ }));
    const note = screen.getByRole("dialog", { name: /Ana García/ });
    expect(note).toHaveTextContent("Ana García");
    expect(note).toHaveTextContent("Ocupado de 09:00 a 11:00");
    expect(within(note).queryByRole("link")).toBeNull();
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("puts all-day busy days in the all-day strip (RF-11)", () => {
    render(
      <WeekView
        days={DAYS}
        events={[]}
        busy={[
          busy({
            allDay: true,
            startsAt: "2026-11-13T00:00:00Z",
            endsAt: "2026-11-15T00:00:00Z",
          }),
        ]}
        timeZone={TZ}
        today={TODAY}
      />,
    );
    const strip = screen.getByTestId("banner-strip");
    expect(
      within(strip).getByRole("button", { name: /Ocupado · Ana García/ }),
    ).toHaveTextContent("Todo el día");
    expect(
      within(screen.getByTestId("time-grid")).queryByRole("button", {
        name: /Ocupado/,
      }),
    ).toBeNull();
  });
});
