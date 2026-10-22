import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  NextEventCard,
  type NextEventItem,
} from "@/components/calendar/next-event-card";

// Spec 005, T9: the "Próximo evento" block (RF-45..RF-50; plan D12, D13).
const navigation = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: navigation.refresh }),
}));

const TZ = "Europe/Madrid";

function item(
  id: string,
  title: string,
  startsAt: string,
  calendarId = "home",
): NextEventItem {
  return {
    id,
    title,
    startsAt,
    endsAt: startsAt,
    allDay: false,
    calendarId,
    calendarName: calendarId === "home" ? "Casa" : "Trabajo",
  };
}

const EVENTS = [
  item("e1", "Dentista", "2026-11-02T10:30:00Z"),
  item("e2", "Clase de yoga", "2026-11-02T17:30:00Z", "work"),
];

function renderCard(
  events = EVENTS,
  visible = ["home", "work"],
  loadedAt = Date.parse("2026-11-02T10:00:00Z"),
) {
  render(
    <NextEventCard
      events={events}
      visibleCalendarIds={new Set(visible)}
      timeZone={TZ}
      loadedAt={loadedAt}
    />,
  );
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-02T10:00:00Z"));
  navigation.refresh.mockClear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("NextEventCard (RF-45, RF-46, RF-50)", () => {
  it("shows the next event with its time, calendar and countdown", () => {
    renderCard();

    const link = screen.getByRole("link", { name: /Próximo evento/ });
    expect(link).toHaveAttribute("href", "/dashboard/events/e1");
    expect(link).toHaveTextContent("Dentista");
    expect(link).toHaveTextContent("11:30");
    expect(link).toHaveTextContent("Casa");
    expect(link).toHaveTextContent("en 30 min");
  });

  it("ignores hidden calendars (RF-45)", () => {
    renderCard(EVENTS, ["work"]);

    expect(
      screen.getByRole("link", { name: /Próximo evento/ }),
    ).toHaveTextContent("Clase de yoga");
  });
});

describe("NextEventCard over time (RF-47, RF-48)", () => {
  it("counts down without reloading", () => {
    renderCard();

    act(() => {
      vi.advanceTimersByTime(10 * 60_000);
    });

    expect(
      screen.getByRole("link", { name: /Próximo evento/ }),
    ).toHaveTextContent("en 20 min");
  });

  it("moves to the following event when the first one starts", () => {
    renderCard();

    act(() => {
      vi.advanceTimersByTime(30 * 60_000 + 30_000);
    });

    const link = screen.getByRole("link", { name: /Próximo evento/ });
    expect(link).toHaveTextContent("Clase de yoga");
    expect(link).toHaveAttribute("href", "/dashboard/events/e2");
  });

  it("asks the server again when the page comes back after 12 hours (plan D12)", () => {
    renderCard();

    act(() => {
      vi.setSystemTime(new Date("2026-11-02T23:00:00Z"));
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(navigation.refresh).toHaveBeenCalledTimes(1);
  });

  it("does not ask the server again after a short absence", () => {
    renderCard();

    act(() => {
      vi.setSystemTime(new Date("2026-11-02T11:00:00Z"));
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(navigation.refresh).not.toHaveBeenCalled();
  });
});

describe("NextEventCard with nothing ahead (RF-49)", () => {
  it("says there is nothing in the next 24 hours", () => {
    renderCard([item("far", "Lejos", "2026-11-04T10:00:00Z")]);

    expect(
      screen.getByText("Nada en las próximas 24 horas"),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /Próximo evento/ }),
    ).not.toBeInTheDocument();
  });
});
