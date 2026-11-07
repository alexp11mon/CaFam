import { isLiveHeld } from "@/lib/calendar/live-hold";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  EventInteractionsProvider,
  useEventInteractionsState,
} from "@/components/calendar/event-interactions";
import { TimeGrid } from "@/components/calendar/time-grid";
import { ToastProvider } from "@/components/ui/toast";
import type { CalendarEventItem } from "@/lib/calendar/layout";
import { captureReturn, markPulse } from "@/lib/motion/marks";
import { flightKeyframes } from "@/lib/motion/flight";
import { EASE_IN_OUT } from "@/lib/motion/play";

// Spec 017, T7: moving and resizing with the mouse in the week and the day
// (RF-2, RF-5, RF-7, RF-8, RF-9, RF-10, RF-12, RF-19, RF-20, RF-21, RF-23).
const h = vi.hoisted(() => ({
  quickChange: vi.fn(),
  refresh: vi.fn(),
  pulse: vi.fn(),
  play: vi.fn(),
}));

vi.mock("@/lib/motion/play", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/motion/play")>()),
  pulse: h.pulse,
  play: h.play,
}));

vi.mock("@/app/dashboard/events/quick-actions", () => ({
  quickChange: h.quickChange,
  deleteForUndo: vi.fn(),
  undoAction: vi.fn(),
}));
vi.mock("@/app/dashboard/events/card-actions", () => ({
  loadEventCard: vi.fn(() => new Promise(() => undefined)),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: h.refresh }),
}));

const TZ = "Europe/Madrid";
const DAYS = ["2026-11-03", "2026-11-04"];
const HOUR = 48;
const COLUMN = { left: 100, width: 100 };

// 10:00–11:00 in Madrid (UTC+1 in November).
const MINE: CalendarEventItem = {
  id: "e1",
  title: "Cena",
  startsAt: "2026-11-03T09:00:00.000Z",
  endsAt: "2026-11-03T10:00:00.000Z",
  allDay: false,
  calendarId: "mine",
  categoryId: null,
  color: "#FFADAD",
};
const THEIRS: CalendarEventItem = {
  ...MINE,
  id: "e2",
  title: "Ajeno",
  calendarId: "theirs",
  startsAt: "2026-11-04T09:00:00.000Z",
  endsAt: "2026-11-04T10:00:00.000Z",
};

const FAIR: CalendarEventItem = {
  ...MINE,
  id: "e3",
  title: "Feria",
  allDay: true,
  startsAt: "2026-11-04T00:00:00.000Z",
  endsAt: "2026-11-05T00:00:00.000Z",
};
const TRIP: CalendarEventItem = {
  ...FAIR,
  id: "e4",
  title: "Viaje",
  startsAt: "2026-11-03T00:00:00.000Z",
  endsAt: "2026-11-05T00:00:00.000Z",
};
const EVENTS = [MINE, THEIRS];
const WITH_ALL_DAY = [MINE, FAIR, TRIP];
// Stable per test: a new array on each render would reset the overrides.
let shownEvents = EVENTS;
const EDITABLE = new Set(["mine"]);
const COLORS = new Map<string, string>();

function Harness() {
  const state = useEventInteractionsState({
    events: shownEvents,
    editableCalendarIds: EDITABLE,
    calendarColors: COLORS,
    timeZone: TZ,
  });
  return (
    <EventInteractionsProvider value={state.api}>
      <TimeGrid
        days={DAYS}
        events={state.events}
        timeZone={TZ}
        today="2026-11-01"
        linkDays
      />
      {state.dialog}
    </EventInteractionsProvider>
  );
}

function rect(left: number, top: number, width: number, height: number) {
  return {
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    x: left,
    y: top,
    toJSON: () => ({}),
  };
}

let columns: HTMLElement[] = [];
let scroller: HTMLElement;

function setup(events = EVENTS) {
  shownEvents = events;
  render(
    <ToastProvider>
      <Harness />
    </ToastProvider>,
  );
  columns = DAYS.map((day) =>
    document.querySelector<HTMLElement>(`[data-time-col][data-day="${day}"]`)!,
  );
  // jsdom has no layout: each column is 1152 px tall, side by side.
  columns.forEach((column, index) =>
    vi
      .spyOn(column, "getBoundingClientRect")
      .mockReturnValue(
        rect(COLUMN.left + index * COLUMN.width, 0, COLUMN.width, 24 * HOUR),
      ),
  );
  scroller = document.querySelector<HTMLElement>("[data-grid-scroll]")!;
  vi.spyOn(scroller, "getBoundingClientRect").mockReturnValue(
    rect(0, 0, 400, 1000),
  );
  // Above the grid (y < 0) is the all-day strip, whose cells appear while dragging.
  document.elementsFromPoint = (x: number, y: number) => {
    const index = Math.floor((x - COLUMN.left) / COLUMN.width);
    const day = DAYS[index];
    if (!day) return [];
    if (y >= 0) return [columns[index]!];
    const cell = document.querySelector(`[data-allday-day="${day}"]`);
    return cell ? [cell] : [];
  };
}

const at = (hours: number) => hours * HOUR;
const block = (title: string) =>
  screen.getByRole("link", { name: new RegExp(title) });

function down(target: Element, hours: number, x = 150) {
  fireEvent.pointerDown(target, {
    clientX: x,
    clientY: at(hours),
    button: 0,
    pointerId: 1,
    pointerType: "mouse",
  });
}
function move(hours: number, x = 150) {
  fireEvent.pointerMove(window, {
    clientX: x,
    clientY: at(hours),
    pointerId: 1,
  });
}
function up(hours: number, x = 150) {
  fireEvent.pointerUp(window, { clientX: x, clientY: at(hours), pointerId: 1 });
}

beforeEach(() => {
  h.quickChange.mockReset();
  h.quickChange.mockResolvedValue({ ok: true, id: "e1" });
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("DraggableEvent", () => {
  it("pulses once when its save was confirmed (spec 021 RF-48)", () => {
    h.pulse.mockReset();
    markPulse("e1");
    setup();
    expect(h.pulse).toHaveBeenCalledTimes(1);
    expect(h.pulse).toHaveBeenCalledWith(block("Cena"));
  });

  it("flies back in an arc from where it was (spec 021 RF-20, RF-21)", () => {
    h.play.mockReset();
    // Measured before going back: 200 px to the right of where it is drawn.
    const ghost = document.createElement("a");
    ghost.dataset.eventId = "e1";
    ghost.getBoundingClientRect = () => rect(300, 480, 90, 48) as DOMRect;
    document.body.append(ghost);
    captureReturn("e1");
    ghost.remove();

    setup();
    const el = block("Cena");
    expect(h.play).toHaveBeenCalledTimes(1);
    const [target, frames, options] = h.play.mock.calls[0]!;
    expect(target).toBe(el);
    expect(frames).toEqual(
      flightKeyframes(
        { left: 300, top: 480, width: 90, height: 48 },
        {
          left: el.getBoundingClientRect().left,
          top: el.getBoundingClientRect().top,
          width: el.getBoundingClientRect().width,
          height: el.getBoundingClientRect().height,
        },
      ),
    );
    expect(options).toMatchObject({ easing: EASE_IN_OUT });
  });

  it("does not pulse without a mark", () => {
    h.pulse.mockReset();
    setup();
    expect(h.pulse).not.toHaveBeenCalled();
  });

  it("lifts after 4 px, shows its new hours and saves where it is dropped (RF-5, RF-8, RF-18)", async () => {
    setup();
    down(block("Cena"), 10.25);
    move(10.3);
    expect(block("Cena")).not.toHaveClass("ring-2");

    move(12.25);
    expect(block("Cena")).toHaveClass("ring-2");
    expect(block("Cena")).toHaveTextContent("12:00 – 13:00");
    expect(screen.getByText(/12:00–13:00/)).toHaveClass("sr-only");

    await act(async () => up(12.25));
    expect(h.quickChange).toHaveBeenCalledWith(
      "e1",
      {
        kind: "times",
        startsAt: "2026-11-03T11:00:00.000Z",
        endsAt: "2026-11-03T12:00:00.000Z",
        allDay: false,
      },
      {},
    );
    expect(await screen.findByText("Evento movido")).toBeVisible();
  });

  it("holds others' changes while dragging (spec 019 RF-43)", async () => {
    setup();
    down(block("Cena"), 10.25);
    move(12.25);
    expect(isLiveHeld()).toBe(true);
    await act(async () => up(12.25));
    expect(isLiveHeld()).toBe(false);
  });

  it("goes to another day of the week (RF-7)", async () => {
    setup();
    down(block("Cena"), 10.25);
    move(10.25, 250);
    await act(async () => up(10.25, 250));
    expect(h.quickChange).toHaveBeenCalledWith(
      "e1",
      expect.objectContaining({
        startsAt: "2026-11-04T09:00:00.000Z",
        endsAt: "2026-11-04T10:00:00.000Z",
      }),
      {},
    );
  });

  it("dropped where it was, or outside the grid, saves nothing (RF-19)", async () => {
    setup();
    down(block("Cena"), 10.25);
    move(11);
    await act(async () => up(10.3));
    expect(h.quickChange).not.toHaveBeenCalled();

    down(block("Cena"), 10.25);
    move(12, 900);
    await act(async () => up(12, 900));
    expect(h.quickChange).not.toHaveBeenCalled();
    expect(block("Cena")).not.toHaveClass("ring-2");
  });

  it("Escape puts it back (RF-20)", async () => {
    setup();
    down(block("Cena"), 10.25);
    move(14);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(block("Cena")).not.toHaveClass("ring-2");
    await act(async () => up(14));
    expect(h.quickChange).not.toHaveBeenCalled();
  });

  it("the bottom edge changes the end, never under 15 minutes (RF-10, RF-12)", async () => {
    setup();
    const handle = block("Cena").querySelector("[data-resize]")!;
    down(handle, 11);
    move(12.5);
    await act(async () => up(12.5));
    expect(h.quickChange).toHaveBeenCalledWith(
      "e1",
      expect.objectContaining({
        startsAt: "2026-11-03T09:00:00.000Z",
        endsAt: "2026-11-03T11:30:00.000Z",
      }),
      {},
    );
    expect(await screen.findByText("Duración cambiada")).toBeVisible();
  });

  // Spec 021, T18: under 15 minutes the edge follows with a rubber band and
  // comes back with scaleY (RF-32, RF-33, RF-67, plan D12).
  it("bands the edge under 15 minutes and springs back with scaleY", async () => {
    setup();
    const cena = block("Cena");
    down(cena.querySelector("[data-resize]")!, 11);
    move(9);
    const squeezed = Number(cena.style.scale.split(" ")[1]);
    expect(squeezed).toBeLessThan(1);
    expect(squeezed).toBeGreaterThanOrEqual(0.5);
    await act(async () => up(9));
    expect(h.quickChange).toHaveBeenCalledWith(
      "e1",
      expect.objectContaining({ endsAt: "2026-11-03T09:15:00.000Z" }),
      {},
    );
    const back = h.play.mock.calls.find(([, frames]) =>
      String(frames[0].scale).startsWith("1 0."),
    );
    expect(back?.[0]).toBe(cena);
    expect(back?.[1].at(-1)).toMatchObject({ scale: "1 1" });
  });

  it("stops the edge dead at 15 minutes with reduced motion (RF-67)", () => {
    window.matchMedia = ((query: string) => ({
      matches: query.includes("reduce"),
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    })) as unknown as typeof window.matchMedia;
    setup();
    const cena = block("Cena");
    down(cena.querySelector("[data-resize]")!, 11);
    move(9);
    expect(cena.style.scale).toBe("");
    // @ts-expect-error jsdom has none.
    delete window.matchMedia;
  });

  it("the click after a drag does not open the event (RF-23)", async () => {
    setup();
    down(block("Cena"), 10.25);
    move(12);
    await act(async () => up(12));
    expect(fireEvent.click(block("Cena"))).toBe(false);
    expect(screen.queryByRole("dialog")).toBeNull();
    // The next click opens it: the detail card from 769 px (spec 019 RF-1).
    fireEvent.click(block("Cena"));
    expect(screen.getByRole("dialog", { name: "Cena" })).toBeVisible();
  });

  it("an event the user cannot write to is a plain link (RF-2)", async () => {
    setup();
    const theirs = block("Ajeno");
    expect(theirs.querySelector("[data-resize]")).toBeNull();
    down(theirs, 10.25, 250);
    move(13, 250);
    await act(async () => up(13, 250));
    expect(theirs).not.toHaveClass("ring-2");
    expect(h.quickChange).not.toHaveBeenCalled();
  });

  it("a timed event dropped on the strip turns all day (RF-13)", async () => {
    setup();
    down(block("Cena"), 10.25);
    move(-0.5, 250);
    expect(
      document.querySelector('[data-allday-day="2026-11-04"]'),
    ).not.toBeNull();
    await act(async () => up(-0.5, 250));
    expect(h.quickChange).toHaveBeenCalledWith(
      "e1",
      {
        kind: "times",
        startsAt: "2026-11-04T00:00:00.000Z",
        endsAt: "2026-11-05T00:00:00.000Z",
        allDay: true,
      },
      {},
    );
  });

  it("a one-day all-day event dropped on the grid lasts 1 h from there (RF-14)", async () => {
    setup(WITH_ALL_DAY);
    down(block("Feria"), -0.5, 250);
    move(16, 150);
    await act(async () => up(16, 150));
    expect(h.quickChange).toHaveBeenCalledWith(
      "e3",
      {
        kind: "times",
        startsAt: "2026-11-03T15:00:00.000Z",
        endsAt: "2026-11-03T16:00:00.000Z",
        allDay: false,
      },
      {},
    );
  });

  it("an all-day event moves along the strip keeping its days (RF-15)", async () => {
    setup(WITH_ALL_DAY);
    down(block("Viaje"), -0.5, 150);
    move(-0.5, 250);
    await act(async () => up(-0.5, 250));
    expect(h.quickChange).toHaveBeenCalledWith(
      "e4",
      {
        kind: "times",
        startsAt: "2026-11-04T00:00:00.000Z",
        endsAt: "2026-11-06T00:00:00.000Z",
        allDay: true,
      },
      {},
    );
  });

  it("an event of several days does not turn timed on the grid", async () => {
    setup(WITH_ALL_DAY);
    down(block("Viaje"), -0.5, 150);
    move(12, 150);
    await act(async () => up(12, 150));
    expect(h.quickChange).not.toHaveBeenCalled();
  });

  describe("with a finger (RF-6, RF-11, RF-22)", () => {
    const touch = (hours: number, x = 150, pointerId = 1) => ({
      clientX: x,
      clientY: at(hours),
      button: 0,
      pointerId,
      pointerType: "touch",
    });

    beforeEach(() => {
      vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it("holding 500 ms lifts it, then it follows the finger and the page does not pan", async () => {
      setup();
      fireEvent.pointerDown(block("Cena"), touch(10.25));
      act(() => vi.advanceTimersByTime(499));
      expect(block("Cena")).not.toHaveClass("ring-2");
      act(() => vi.advanceTimersByTime(1));
      expect(block("Cena")).toHaveClass("ring-2");
      expect(fireEvent.touchMove(window)).toBe(false);

      fireEvent.pointerMove(window, touch(12.25));
      await act(async () => {
        fireEvent.pointerUp(window, touch(12.25));
      });
      expect(h.quickChange).toHaveBeenCalledWith(
        "e1",
        expect.objectContaining({ startsAt: "2026-11-03T11:00:00.000Z" }),
        {},
      );
    });

    it("moving before 500 ms scrolls or swipes instead (RF-22)", () => {
      setup();
      fireEvent.pointerDown(block("Cena"), touch(10.25));
      fireEvent.pointerMove(window, touch(10.6));
      act(() => vi.advanceTimersByTime(600));
      expect(block("Cena")).not.toHaveClass("ring-2");
      expect(fireEvent.touchMove(window)).toBe(true);
    });

    it("a second finger cancels the press", () => {
      setup();
      fireEvent.pointerDown(block("Cena"), touch(10.25));
      fireEvent.pointerDown(window, touch(11, 160, 2));
      act(() => vi.advanceTimersByTime(600));
      expect(block("Cena")).not.toHaveClass("ring-2");
    });

    it("stays lifted with a handle that changes the end, until a tap elsewhere (RF-11)", async () => {
      setup();
      expect(block("Cena").querySelector("[data-handle]")).toBeNull();
      fireEvent.pointerDown(block("Cena"), touch(10.25));
      act(() => vi.advanceTimersByTime(500));
      await act(async () => {
        fireEvent.pointerUp(window, touch(10.25));
      });
      expect(h.quickChange).not.toHaveBeenCalled();
      expect(block("Cena")).toHaveClass("ring-2", "touch-none");
      const handle = block("Cena").querySelector("[data-handle]")!;
      expect(handle).not.toBeNull();

      // Lifted, the handle stretches at once, without holding again.
      fireEvent.pointerDown(handle, touch(11));
      fireEvent.pointerMove(window, touch(12));
      await act(async () => {
        fireEvent.pointerUp(window, touch(12));
      });
      expect(h.quickChange).toHaveBeenCalledWith(
        "e1",
        expect.objectContaining({
          startsAt: "2026-11-03T09:00:00.000Z",
          endsAt: "2026-11-03T11:00:00.000Z",
        }),
        {},
      );

      fireEvent.pointerDown(document.body, touch(20));
      expect(block("Cena")).not.toHaveClass("ring-2");
    });

    it("the system menu of a long press never opens", () => {
      setup();
      fireEvent.pointerDown(block("Cena"), touch(10.25));
      expect(fireEvent.contextMenu(block("Cena"))).toBe(false);
    });
  });

  it("scrolls the grid near its bottom edge (RF-9)", async () => {
    setup();
    down(block("Cena"), 10.25);
    move(990 / HOUR);
    await vi.waitFor(() => expect(scroller.scrollTop).toBeGreaterThan(0));
    fireEvent.keyDown(window, { key: "Escape" });
  });
});
