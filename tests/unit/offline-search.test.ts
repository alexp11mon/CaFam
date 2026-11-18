import { describe, expect, it } from "vitest";
import { searchOffline } from "@/lib/offline/offline-sources";
import type { OfflineEvent, Snapshot } from "@/lib/offline/snapshot";

// Spec 039, T5: the search on the device's copy (RF-10).
function event(id: string, extra: Partial<OfflineEvent> = {}): OfflineEvent {
  return {
    id,
    calendarId: "cal-1",
    title: "Cena",
    startsAt: "2026-11-20T19:00:00Z",
    endsAt: "2026-11-20T20:00:00Z",
    allDay: false,
    color: null,
    categoryId: null,
    location: null,
    imageCount: 0,
    commentCount: 0,
    seriesId: null,
    description: null,
    createdBy: null,
    createdByName: null,
    seriesSummary: null,
    seriesChanged: false,
    ...extra,
  };
}

const copy = {
  events: [
    event("e1", { title: "Médico" }),
    event("s1_20261105T160000Z", { title: "Piano", seriesId: "s1" }),
    event("s1_20261112T160000Z", { title: "Piano", seriesId: "s1" }),
    event("e2", { description: "Llevar el informe" }),
    event("e3", { location: "Casa de la abuela" }),
  ],
  comments: [
    {
      id: "c1",
      eventId: "e3",
      authorId: null,
      authorName: "Ana",
      body: "Traigo la TARTA",
      createdAt: "2026-11-10T10:00:00Z",
      editedAt: null,
    },
  ],
} as unknown as Snapshot;

describe("searchOffline", () => {
  it("finds without accents in title, description and place, with occurrences", () => {
    const ids = (q: string) => searchOffline(copy, q).results.map((r) => r.id);
    expect(ids("medico")).toEqual(["e1"]);
    expect(ids("piano")).toEqual([
      "s1_20261105T160000Z",
      "s1_20261112T160000Z",
    ]);
    expect(ids("informe")).toEqual(["e2"]);
    expect(ids("abuela")).toEqual(["e3"]);
  });

  it("finds by comment and gives it for the excerpt", () => {
    const { results } = searchOffline(copy, "tarta");
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      id: "e3",
      matchedComment: "Traigo la TARTA",
    });
  });

  it("does nothing below 2 characters", () => {
    expect(searchOffline(copy, "m")).toEqual({ results: [], more: false });
  });
});
