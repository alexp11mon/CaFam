import { render } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import {
  AgendaView,
  type AgendaEvent,
} from "@/components/calendar/agenda-view";
import { getVisibleRange } from "@/lib/calendar/ranges";

// Spec 024, T5 (RF-12, RF-13).
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
const renders = vi.hoisted(() => new Map<string, number>());
vi.mock("@/components/calendar/event-block", () => ({
  EventBlock: ({ event }: { event: { id: string; title: string } }) => {
    renders.set(event.id, (renders.get(event.id) ?? 0) + 1);
    return <p>{event.title}</p>;
  },
}));

// jsdom has no scrollIntoView (the agenda opens on today).
HTMLElement.prototype.scrollIntoView = () => {};

const TZ = "Europe/Madrid";
const TODAY = "2026-11-02";
const DAYS = getVisibleRange("agenda", TODAY, TZ).days;
const event = (id: string, day: string): AgendaEvent => ({
  id,
  title: id,
  startsAt: `${day}T10:00:00Z`,
  endsAt: `${day}T11:00:00Z`,
  allDay: false,
  color: "#FFADAD",
  calendarId: "cal",
  categoryId: null,
});

describe("agenda rows (RF-13)", () => {
  it("does not render again the days whose events did not change", () => {
    const events = [event("a", "2026-11-03"), event("b", "2026-11-05")];
    const view = (isShown: () => boolean, list = events) => (
      <AgendaView
        days={DAYS}
        events={list}
        isShown={isShown}
        timeZone={TZ}
        today={TODAY}
      />
    );
    const { rerender } = render(view(() => true));
    expect(renders.get("a")).toBe(1);

    // The whole feed is built again (a filter, a new chunk)…
    rerender(view(() => true));
    expect(renders.get("a")).toBe(1);
    expect(renders.get("b")).toBe(1);

    // …and only the day that changed is drawn again.
    rerender(view(() => true, [events[0]!, { ...events[1]!, title: "b2" }]));
    expect(renders.get("a")).toBe(1);
    expect(renders.get("b")).toBe(2);
  });
});

describe("hour grid gesture (RF-12)", () => {
  it("leaves the sideways gesture to the app: the grid only pans vertically", () => {
    const source = readFileSync(
      "src/components/calendar/time-grid.tsx",
      "utf8",
    );
    expect(source).toContain("touch-pan-y overflow-y-auto");
    expect(source).not.toContain("touch-pan-x");
  });
});
