import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useContext } from "react";
import { CalendarClient } from "@/components/calendar/calendar-client";
import { CalendarNavContext } from "@/components/calendar/calendar-nav";
import type { AgendaEvent } from "@/components/calendar/agenda-view";

// Spec 024, T4: the view and the date live in the browser (RF-2, RF-4, RF-5).
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/components/calendar/calendar-heading", () => ({
  CalendarHeading: () => null,
}));
vi.mock("@/components/calendar/view-toolbar", () => ({
  ViewToolbar: ({ view, date }: { view: string; date: string }) => (
    <p data-testid="toolbar">{`${view} ${date}`}</p>
  ),
}));
vi.mock("@/components/calendar/calendar-workspace", () => ({
  CalendarWorkspace: ({
    view,
    date,
    days,
    events,
    busyIntervals,
    monthMarks,
  }: {
    view: string;
    date: string;
    days: string[];
    events: AgendaEvent[];
    busyIntervals: unknown[];
    monthMarks: Record<string, string[]>;
  }) => {
    const go = useContext(CalendarNavContext)!;
    return (
      <div>
        <p data-testid="where">{`${view} ${date} ${days[0]}..${days.at(-1)}`}</p>
        <p data-testid="events">{events.map((e) => e.id).join(",")}</p>
        <p data-testid="busy">{busyIntervals.length}</p>
        <p data-testid="marks">{Object.keys(monthMarks).join(",")}</p>
        <button onClick={() => go("month", "2026-12-01", ["cal-next"])}>
          diciembre
        </button>
        <button onClick={() => go("week", "2026-11-15")}>semana</button>
        <button onClick={() => go("month", "2027-06-15")}>lejos</button>
      </div>
    );
  },
}));

const ev = (id: string, day: string): AgendaEvent => ({
  id,
  title: id,
  startsAt: `${day}T10:00:00Z`,
  endsAt: `${day}T11:00:00Z`,
  allDay: false,
  calendarId: "c1",
  categoryId: null,
  color: "#A0C4FF",
});

const serverWindow = () => ({
  range: { from: "2026-09-28", to: "2027-01-03" },
  events: [ev("dec", "2026-12-10"), ev("nov", "2026-11-10")],
});

const base = {
  today: "2026-11-15",
  timeZone: "Europe/Madrid",
  groups: [],
  categories: [],
  setCalendarVisibility: async () => ({}),
  setPersonVisibility: async () => ({}),
  saveOrder: async () => ({}),
};

function client(
  over: Partial<Parameters<typeof CalendarClient>[0]> = {},
  window = serverWindow(),
) {
  return (
    <CalendarClient
      {...base}
      initialView="month"
      initialDate="2026-11-15"
      window={window}
      initialBusy={[]}
      {...over}
    />
  );
}

beforeEach(() => {
  history.replaceState(
    null,
    "",
    "/dashboard/calendar?view=month&date=2026-11-15",
  );
});
afterEach(() => vi.restoreAllMocks());

describe("CalendarClient", () => {
  it("shows the events of the visible period only, in order", () => {
    render(client());
    expect(screen.getByTestId("where")).toHaveTextContent(
      "month 2026-11-15 2026-10-26..2026-12-06",
    );
    expect(screen.getByTestId("events")).toHaveTextContent(/^nov$/);
    expect(screen.getByTestId("marks")).toHaveTextContent("2026-11-10");
    expect(screen.getByTestId("toolbar")).toHaveTextContent("month 2026-11-15");
  });

  it("changes period with no request and writes the address (RF-2)", async () => {
    const loadWindow = vi.fn(async () => ({ events: [] }));
    const pushState = vi.spyOn(history, "pushState");
    render(client({ loadWindow }));

    await userEvent.click(screen.getByRole("button", { name: "diciembre" }));

    expect(screen.getByTestId("where")).toHaveTextContent(
      "month 2026-12-01 2026-11-30..2027-01-03",
    );
    expect(screen.getByTestId("events")).toHaveTextContent(/^dec$/);
    expect(pushState).toHaveBeenCalledExactlyOnceWith(
      null,
      "",
      "/dashboard/calendar?view=month&date=2026-12-01",
    );
    expect(loadWindow).not.toHaveBeenCalled();
    expect(location.search).toBe("?view=month&date=2026-12-01");
  });

  it("drops the weekends of week and month when they are hidden", async () => {
    render(client({ showWeekends: false }));
    await userEvent.click(screen.getByRole("button", { name: "semana" }));
    expect(screen.getByTestId("where")).toHaveTextContent(
      "week 2026-11-15 2026-11-09..2026-11-13",
    );
  });

  it("follows back and forward (RF-2)", async () => {
    render(client());
    await userEvent.click(screen.getByRole("button", { name: "diciembre" }));

    history.replaceState(
      null,
      "",
      "/dashboard/calendar?view=week&date=2026-11-03",
    );
    act(() => void window.dispatchEvent(new PopStateEvent("popstate")));

    expect(screen.getByTestId("where")).toHaveTextContent(
      "week 2026-11-03 2026-11-02..2026-11-08",
    );
  });

  it("ignores back and forward on another screen (Activity, plan R2)", () => {
    render(client());
    history.replaceState(null, "", "/dashboard/settings");
    act(() => void window.dispatchEvent(new PopStateEvent("popstate")));
    expect(screen.getByTestId("where")).toHaveTextContent("month 2026-11-15");
  });

  it("marks a period that is not loaded and fills it in (RF-4)", async () => {
    let answer: (value: { events: AgendaEvent[] }) => void = () => {};
    const loadWindow = vi.fn(
      () =>
        new Promise<{ events: AgendaEvent[] }>((resolve) => (answer = resolve)),
    );
    const { container } = render(client({ loadWindow }));

    await userEvent.click(screen.getByRole("button", { name: "lejos" }));

    // The view is already there, empty and busy.
    expect(screen.getByTestId("where")).toHaveTextContent("month 2027-06-15");
    expect(container.querySelector("[aria-busy=true]")).not.toBeNull();
    expect(screen.getByRole("status")).toHaveTextContent("Cargando eventos…");
    await vi.waitFor(() => expect(loadWindow).toHaveBeenCalledOnce());

    await act(async () => answer({ events: [ev("jun", "2027-06-20")] }));
    expect(screen.getByTestId("events")).toHaveTextContent(/^jun$/);
    expect(container.querySelector("[aria-busy=true]")).toBeNull();
  });

  it("says so when the period cannot be read", async () => {
    const loadWindow = vi.fn(async () => ({ error: "x" }));
    render(client({ loadWindow }));
    await userEvent.click(screen.getByRole("button", { name: "lejos" }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("No se han podido cargar los eventos");
    // Spec 026 RF-8: asking again is one tap.
    expect(loadWindow).toHaveBeenCalledOnce();
    await userEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    await vi.waitFor(() => expect(loadWindow).toHaveBeenCalledTimes(2));
  });

  it("takes a server refresh as the new start, at the address shown (RF-5)", async () => {
    const { rerender } = render(client());
    await userEvent.click(screen.getByRole("button", { name: "diciembre" }));

    // The refresh was rendered for December: the window is a new object.
    rerender(
      client(
        { initialDate: "2026-12-01" },
        {
          range: { from: "2026-10-26", to: "2027-01-31" },
          events: [ev("fresh", "2026-12-24")],
        },
      ),
    );
    expect(screen.getByTestId("where")).toHaveTextContent("month 2026-12-01");
    expect(screen.getByTestId("events")).toHaveTextContent(/^fresh$/);
  });

  it("asks for the busy times of another week only with someone marked (RF-9)", async () => {
    const busy = [
      {
        personId: "ana",
        startsAt: "2026-11-10T10:00:00Z",
        endsAt: "2026-11-10T11:00:00Z",
        allDay: false,
      },
    ];
    const loadBusy = vi.fn(async () => ({ busy }));
    const people = [{ id: "ana", name: "Ana", shown: false }];
    const { unmount } = render(client({ loadBusy, busyPeople: people }));
    await userEvent.click(screen.getByRole("button", { name: "semana" }));
    expect(loadBusy).not.toHaveBeenCalled();
    unmount();

    render(client({ loadBusy, busyPeople: [{ ...people[0]!, shown: true }] }));
    await userEvent.click(screen.getByRole("button", { name: "semana" }));
    await vi.waitFor(() =>
      expect(screen.getByTestId("busy")).toHaveTextContent("1"),
    );
    expect(loadBusy).toHaveBeenCalledExactlyOnceWith(
      "2026-11-09",
      "2026-11-15",
    );
  });
});

// Spec 042 T5: the year and the 4 days in the browser (RF-12, RF-13).
describe("CalendarClient with the new views", () => {
  it("draws the whole year without reading its events (RF-5, RF-12)", () => {
    const loadWindow = vi.fn(async () => ({ events: [] }));
    render(client({ initialView: "year", loadWindow }));
    expect(screen.getByTestId("where")).toHaveTextContent(
      "year 2026-11-15 2026-01-01..2026-12-31",
    );
    expect(loadWindow).not.toHaveBeenCalled();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("reads no events when moving to a year out of the window (RNF-1)", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const loadWindow = vi.fn(async () => ({ events: [] }));
    render(
      client({ initialView: "year", initialDate: "2030-05-01", loadWindow }),
    );
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    expect(loadWindow).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("draws 4 days, weekends included even when hidden (RF-6)", () => {
    render(client({ initialView: "4days", showWeekends: false }));
    expect(screen.getByTestId("where")).toHaveTextContent(
      "4days 2026-11-15 2026-11-15..2026-11-18",
    );
  });

  it("offline, the year has no alert of its own: its months say it (RF-13)", () => {
    render(
      client({
        initialView: "year",
        availableRange: { from: "2026-10-15", to: "2027-02-15" },
      }),
    );
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("offline, 4 days out of the copy say they are not available (RF-13)", () => {
    render(
      client({
        initialView: "4days",
        initialDate: "2027-06-01",
        availableRange: { from: "2026-10-15", to: "2027-02-15" },
      }),
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "no están disponibles sin conexión",
    );
  });
});
