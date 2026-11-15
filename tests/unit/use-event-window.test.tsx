import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  PREFETCH_DELAY_MS,
  useEventWindow,
} from "@/lib/hooks/use-event-window";
import type { CalendarView } from "@/lib/calendar/ranges";

// Spec 024, T4 (RF-2..RF-6).
type Ev = { id: string; startsAt: string; endsAt: string };
type Load = (
  from: string,
  to: string,
) => Promise<{ events: Ev[] } | { error: string }>;
const ev = (id: string, day: string): Ev => ({
  id,
  startsAt: `${day}T10:00:00Z`,
  endsAt: `${day}T11:00:00Z`,
});

// October to December 2026, as the server sends for a date in November.
const server = () => ({
  range: { from: "2026-09-28", to: "2027-01-03" },
  events: [ev("nov", "2026-11-10"), ev("dec", "2026-12-10")],
});

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

type Props = {
  initial: ReturnType<typeof server>;
  view: CalendarView;
  date: string;
};

function setup(load: Load, initial = server()) {
  const first: Props = { initial, view: "month", date: "2026-11-15" };
  const hook = renderHook(
    (props: Props) => useEventWindow<Ev>({ ...props, load }),
    { initialProps: first },
  );
  return {
    ...hook,
    move: (view: CalendarView, date: string, next = initial) =>
      hook.rerender({ initial: next, view, date }),
  };
}

const flush = () => act(async () => void (await vi.runAllTimersAsync()));

describe("useEventWindow", () => {
  it("asks for nothing while the period and its neighbours are loaded (RF-2)", async () => {
    const load = vi.fn<Load>();
    const { result } = setup(load);
    await flush();
    expect(load).not.toHaveBeenCalled();
    expect(result.current.loading).toBe(false);
    expect(result.current.events.map((e) => e.id)).toEqual(["nov", "dec"]);
  });

  it("reads the next period only once the user is still (RF-3)", async () => {
    const load = vi.fn<Load>(async () => ({
      events: [ev("jan", "2027-01-20")],
    }));
    const { result, move } = setup(load);

    // December is loaded: it paints with no request and no loading state.
    move("month", "2026-12-01");
    expect(result.current.loading).toBe(false);
    expect(load).not.toHaveBeenCalled();
    await act(async () => void vi.advanceTimersByTime(PREFETCH_DELAY_MS - 1));
    expect(load).not.toHaveBeenCalled();

    await flush();
    // January's weeks, right after what was loaded.
    expect(load).toHaveBeenCalledExactlyOnceWith("2027-01-04", "2027-01-31");
    expect(result.current.events.map((e) => e.id)).toEqual([
      "nov",
      "dec",
      "jan",
    ]);
    expect(result.current.range).toEqual({
      from: "2026-09-28",
      to: "2027-01-31",
    });
  });

  it("does not prefetch a period the user already left", async () => {
    const load = vi.fn<Load>(async () => ({ events: [] }));
    const { move } = setup(load);
    move("month", "2026-12-01");
    await act(async () => void vi.advanceTimersByTime(50));
    move("month", "2026-11-01");
    await flush();
    expect(load).not.toHaveBeenCalled();
  });

  it("reads a far period at once and says it is loading (RF-4)", async () => {
    let answer: (value: { events: Ev[] }) => void = () => {};
    const load = vi.fn<Load>(
      () => new Promise((resolve) => (answer = resolve)),
    );
    const { result, move } = setup(load);

    move("month", "2027-06-15");
    expect(result.current.loading).toBe(true);
    await act(async () => void vi.advanceTimersByTime(0));
    expect(load).toHaveBeenCalledExactlyOnceWith("2027-05-31", "2027-07-04");

    await act(async () => answer({ events: [ev("jun", "2027-06-20")] }));
    expect(result.current.loading).toBe(false);
    // A far jump starts a new window (plan D4).
    expect(result.current.events.map((e) => e.id)).toEqual(["jun"]);
  });

  it("says so when the read fails and tries again on another period", async () => {
    const load = vi.fn<Load>(async () => ({ error: "sin conexión" }));
    const { result, move } = setup(load);

    move("month", "2027-06-15");
    await flush();
    expect(result.current.failed).toBe(true);
    expect(result.current.loading).toBe(false);
    expect(load).toHaveBeenCalledOnce();

    move("month", "2027-07-15");
    await flush();
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("starts again from the window of a server refresh (RF-5)", async () => {
    const load = vi.fn<Load>(async () => ({
      events: [ev("jan", "2027-01-20")],
    }));
    const { result, move } = setup(load);
    move("month", "2026-12-01");
    await flush();
    expect(result.current.events).toHaveLength(3);

    const fresh = {
      range: { from: "2026-10-26", to: "2027-01-31" },
      events: [ev("new", "2026-12-24")],
    };
    move("month", "2026-12-01", fresh);
    expect(result.current.events.map((e) => e.id)).toEqual(["new"]);
    expect(result.current.range).toEqual(fresh.range);
  });

  it("drops an answer that arrives after a refresh", async () => {
    let answer: (value: { events: Ev[] }) => void = () => {};
    const load = vi.fn<Load>(
      () => new Promise((resolve) => (answer = resolve)),
    );
    const { result, move } = setup(load);
    move("month", "2026-12-01");
    await act(async () => void vi.advanceTimersByTime(PREFETCH_DELAY_MS));
    expect(load).toHaveBeenCalledOnce();

    const fresh = {
      range: { from: "2026-10-26", to: "2027-01-31" },
      events: [ev("new", "2026-12-24")],
    };
    move("month", "2026-12-01", fresh);
    await act(async () => answer({ events: [ev("stale", "2027-01-20")] }));

    expect(result.current.events.map((e) => e.id)).toEqual(["new"]);
  });
});
