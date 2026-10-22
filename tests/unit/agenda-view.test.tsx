import { render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AgendaView,
  type AgendaEvent,
} from "@/components/calendar/agenda-view";
import { getVisibleRange } from "@/lib/calendar/ranges";

// Spec 005, T8: the agenda view as the user sees it
// (RF-4, RF-5, RF-30, RF-32, RF-35, RF-37, RF-38, RF-39, RF-42; plan D15).
const TZ = "Europe/Madrid";
const TODAY = "2026-11-02";
const DAYS = getVisibleRange("agenda", TODAY, TZ).days;

function event(
  id: string,
  startsAt: string,
  endsAt: string,
  extra: Partial<AgendaEvent> = {},
): AgendaEvent {
  return {
    id,
    title: id,
    startsAt,
    endsAt,
    allDay: false,
    color: "#FFADAD",
    calendarId: "cal",
    categoryId: null,
    location: null,
    calendarName: "Casa",
    ...extra,
  };
}

function renderAgenda(events: AgendaEvent[] = [], canCreate = true) {
  render(
    <AgendaView
      days={DAYS}
      events={events}
      timeZone={TZ}
      today={TODAY}
      canCreate={canCreate}
    />,
  );
}

function day(label: RegExp) {
  return screen.getByRole("region", { name: label });
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-02T11:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("AgendaView days (RF-31, RF-32, RF-33)", () => {
  it("shows 14 days, each named by its full date", () => {
    renderAgenda();

    expect(screen.getAllByRole("region")).toHaveLength(14);
    expect(
      screen.getByRole("region", {
        name: "lunes, 2 de noviembre de 2026, hoy",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "domingo, 15 de noviembre de 2026" }),
    ).toBeInTheDocument();
  });

  it("draws the big day number and the weekday", () => {
    renderAgenda();

    const second = day(/^martes, 3 de noviembre/);
    expect(within(second).getByText("03")).toBeInTheDocument();
    expect(within(second).getByText("mar")).toBeInTheDocument();
  });

  it("marks today with a word, not only a color (RF-5)", () => {
    renderAgenda();

    expect(within(day(/, hoy$/)).getByText("Hoy")).toBeInTheDocument();
    expect(
      within(day(/^martes, 3 /)).queryByText("Hoy"),
    ).not.toBeInTheDocument();
  });
});

describe("AgendaView events (RF-35, RF-42, RF-4)", () => {
  it("shows start, end, title, place and calendar, linking to the detail", () => {
    renderAgenda([
      event("Dentista", "2026-11-03T08:00:00Z", "2026-11-03T09:30:00Z", {
        location: "Calle Mayor 3",
      }),
    ]);

    const link = within(day(/^martes, 3 /)).getByRole("link", {
      name: /Dentista/,
    });
    expect(link).toHaveAttribute("href", "/dashboard/events/Dentista");
    expect(link).toHaveTextContent("09:00");
    expect(link).toHaveTextContent("10:30");
    expect(link).toHaveTextContent("Calle Mayor 3");
    expect(link).toHaveAccessibleName(/Calendario Casa/);
  });

  it("keeps the title in ink and the calendar color as a bar", () => {
    renderAgenda([
      event("Dentista", "2026-11-03T08:00:00Z", "2026-11-03T09:30:00Z", {
        color: "#BDB2FF",
      }),
    ]);

    const link = screen.getByRole("link", { name: /Dentista/ });
    expect(link.querySelector("[data-color-bar]")).toHaveStyle({
      backgroundColor: "#BDB2FF",
    });
    expect(link).not.toHaveStyle({ backgroundColor: "#BDB2FF" });
  });

  it("says Todo el día for all-day events", () => {
    renderAgenda([
      event("Cumple", "2026-11-03T00:00:00Z", "2026-11-04T00:00:00Z", {
        allDay: true,
      }),
    ]);

    expect(screen.getByRole("link", { name: /Cumple/ })).toHaveTextContent(
      "Todo el día",
    );
  });

  it("cuts a long title without hiding the time (casos límite)", () => {
    const title = "Reunión ".repeat(20).trim();
    renderAgenda([
      event("long", "2026-11-03T08:00:00Z", "2026-11-03T09:00:00Z", { title }),
    ]);

    const link = screen.getByRole("link", { name: /Reunión/ });
    expect(within(link).getByText(title)).toHaveClass("line-clamp-2");
    expect(link).toHaveTextContent("09:00");
  });
});

describe("AgendaView empty days and creating (RF-37, RF-38)", () => {
  it("says Sin eventos on a day without events", () => {
    renderAgenda([
      event("Dentista", "2026-11-03T08:00:00Z", "2026-11-03T09:30:00Z"),
    ]);

    expect(
      within(day(/^lunes, 2/)).getByText("Sin eventos"),
    ).toBeInTheDocument();
    expect(
      within(day(/^martes, 3 /)).queryByText("Sin eventos"),
    ).not.toBeInTheDocument();
  });

  it("offers to create an event on each day", () => {
    renderAgenda();

    const links = screen.getAllByRole("link", { name: /^Crear evento el / });
    expect(links).toHaveLength(14);
    expect(
      within(day(/^martes, 3 /)).getByRole("link", {
        name: /^Crear evento el /,
      }),
    ).toHaveAttribute("href", "/dashboard/events/new?date=2026-11-03");
  });

  it("does not offer it without an editable calendar", () => {
    renderAgenda([], false);

    expect(
      screen.queryByRole("link", { name: /^Crear evento/ }),
    ).not.toBeInTheDocument();
  });
});

describe("AgendaView now line (RF-39)", () => {
  it("sits today between started and upcoming events", () => {
    renderAgenda([
      event("Antes", "2026-11-02T08:00:00Z", "2026-11-02T09:00:00Z"),
      event("Después", "2026-11-02T15:00:00Z", "2026-11-02T16:00:00Z"),
      event("Mañana", "2026-11-03T15:00:00Z", "2026-11-03T16:00:00Z"),
    ]);

    const today = day(/, hoy$/);
    const items = within(today).getAllByRole("listitem");
    expect(items.map((item) => item.textContent)).toEqual([
      expect.stringContaining("Antes"),
      expect.stringContaining("Hora actual"),
      expect.stringContaining("Después"),
    ]);
    expect(items[1]).toHaveTextContent("12:00");
    expect(within(day(/^martes, 3 /)).queryByText(/Hora actual/)).toBeNull();
  });
});
