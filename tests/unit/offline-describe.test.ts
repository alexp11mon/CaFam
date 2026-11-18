import { describe, expect, it } from "vitest";
import {
  deleteOf,
  pasteOf,
  pendingView,
  quickChangeOf,
  updateOf,
} from "@/lib/offline/describe";
import type { OfflineEvent } from "@/lib/offline/snapshot";
import type { AgendaEvent } from "@/lib/calendar/to-view-events";

const event: OfflineEvent = {
  id: "a",
  calendarId: "cal",
  title: "Dentista",
  startsAt: "2026-11-20T09:00:00.000Z",
  endsAt: "2026-11-20T10:00:00.000Z",
  allDay: false,
  color: null,
  categoryId: null,
  location: "Centro",
  imageCount: 0,
  commentCount: 0,
  seriesId: null,
  description: "Revisión",
  createdBy: "u",
  createdByName: "Ana",
  seriesSummary: null,
  seriesChanged: false,
};

const view = (id: string): AgendaEvent => ({
  id,
  title: id,
  startsAt: "2026-11-20T09:00:00.000Z",
  endsAt: "2026-11-20T10:00:00.000Z",
  allDay: false,
  calendarId: "cal",
  categoryId: null,
  color: "#A0C4FF",
});

describe("describe (spec 034 RF-20 to RF-22)", () => {
  it("a drag keeps the rest of the event and changes the times", () => {
    const change = quickChangeOf(event, {
      kind: "times",
      startsAt: "2026-11-21T09:00:00.000Z",
      endsAt: "2026-11-21T10:00:00.000Z",
      allDay: false,
    });
    expect(change).toMatchObject({
      type: "event.update",
      id: "a",
      base: { startsAt: event.startsAt, description: "Revisión" },
      data: { startsAt: "2026-11-21T09:00:00.000Z", title: "Dentista" },
    });
  });

  it("a color from the menu, and back to the calendar's", () => {
    const change = quickChangeOf(event, { kind: "color", color: null });
    expect(change.type === "event.update" && change.data.color).toBeNull();
  });

  it("a partial event leaves the description out of base and data (R6)", () => {
    const partial = { ...event, partial: true as const, description: null };
    const change = updateOf(partial, {
      ...quickChangeOf(event, { kind: "color", color: "#FFADAD" }),
      title: "Otro",
      calendarId: "cal",
      allDay: false,
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      description: "",
      location: null,
      color: null,
      categoryId: null,
    } as never);
    expect(change.type === "event.update" && change.base.description).toBe(
      undefined,
    );
    expect(change.type === "event.update" && change.data.description).toBe(
      undefined,
    );
  });

  it("delete keeps the base; paste makes a new event at the slot", () => {
    expect(deleteOf(event)).toMatchObject({ type: "event.delete", id: "a" });
    const pasted = pasteOf(
      event,
      { day: "2026-11-22", minute: 600 },
      "Europe/Madrid",
      "new",
    );
    expect(pasted).toMatchObject({
      type: "event.create",
      id: "new",
      data: {
        startsAt: "2026-11-22T09:00:00.000Z",
        endsAt: "2026-11-22T10:00:00.000Z",
        description: "Revisión",
      },
    });
  });

  it("pendingView draws what waits, marked, and drops what was deleted", () => {
    const events = [view("a"), view("b")];
    expect(pendingView(events, [], [])).toBe(events);
    const shown = pendingView(
      events,
      [
        { change: quickChangeOf(event, { kind: "color", color: "#FFADAD" }) },
        { change: { type: "event.delete", id: "b", base: {} as never } },
        { change: pasteOf(event, { day: "2026-11-22" }, "UTC", "c") },
      ],
      [{ id: "cal", name: "Casa", color: "#A0C4FF" }],
    );
    expect(shown.map((e) => e.id)).toEqual(["a", "c"]);
    expect(shown[0]).toMatchObject({ color: "#FFADAD", pending: true });
    expect(shown[1]).toMatchObject({ calendarName: "Casa", pending: true });
  });
});
