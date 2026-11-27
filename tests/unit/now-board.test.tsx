import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NowBoard, type NowBoardData } from "@/components/now/now-board";

// Spec 054 T4: the board recalculates every tick and refreshes (RF-1, RF-19,
// RF-20, RF-27).
const router = vi.hoisted(() => ({ refresh: vi.fn() }));
const live = vi.hoisted(() => ({ useLiveCalendar: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/lib/hooks/use-live-calendar", () => live);

const data = (more: Partial<NowBoardData> = {}): NowBoardData => ({
  userId: "me",
  timeZone: "Europe/Madrid",
  day: "2026-11-27",
  readAt: Date.parse("2026-11-27T10:59:00Z"),
  calendars: [
    { id: "mine", name: "Mío", ownerId: "me", color: "#111111" },
    { id: "school", name: "Cole", ownerId: "son", color: "#222222" },
  ],
  people: [
    { id: "me", displayName: "Ana" },
    { id: "son", displayName: "Hugo" },
  ],
  preferences: { calendarPreferences: [], personPreferences: [] },
  events: [
    {
      id: "e1",
      calendarId: "school",
      title: "Mates",
      startsAt: "2026-11-27T11:00:00.000Z",
      endsAt: "2026-11-27T12:00:00.000Z",
      allDay: false,
      location: null,
    },
  ],
  busy: [],
  busyPeople: [],
  ...more,
});

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-27T10:59:00Z"));
  router.refresh.mockClear();
  live.useLiveCalendar.mockClear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("NowBoard", () => {
  it("shows a card per person, me first, and listens to live changes (RF-1, RF-20)", () => {
    render(<NowBoard data={data()} />);
    const [first, second] = screen.getAllByRole("region");
    expect(first).toBe(screen.getByRole("region", { name: "Ana (tú)" }));
    expect(second).toBe(screen.getByRole("region", { name: "Hugo" }));
    expect(live.useLiveCalendar).toHaveBeenCalledWith("me");
  });

  it("moves an event to on now when the minute comes (RF-19)", () => {
    render(<NowBoard data={data()} />);
    expect(screen.getByText("Libre hasta las 12:00")).toBeVisible();
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(screen.getByText("Cole · hasta las 13:00")).toBeVisible();
    expect(router.refresh).not.toHaveBeenCalled();
  });

  it("reads again past midnight", () => {
    vi.setSystemTime(new Date("2026-11-27T22:59:45Z"));
    render(<NowBoard data={data()} />);
    expect(router.refresh).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(30_000);
    });
    expect(router.refresh).toHaveBeenCalled();
  });

  it("explains how to follow someone when no one is followed (RF-27)", () => {
    render(
      <NowBoard
        data={data({ calendars: [data().calendars[0]!], events: [] })}
      />,
    );
    expect(screen.getAllByRole("region")).toHaveLength(1);
    expect(screen.getByText("Aún no sigues a nadie")).toBeVisible();
    expect(
      screen.getByRole("link", { name: "Unirme con código" }),
    ).toHaveAttribute("href", "/dashboard/join");
  });

  it("does not listen nor refresh offline", () => {
    vi.setSystemTime(new Date("2026-11-28T10:00:00Z"));
    render(<NowBoard data={data()} live={false} />);
    expect(live.useLiveCalendar).toHaveBeenCalledWith(undefined);
    expect(router.refresh).not.toHaveBeenCalled();
  });
});
