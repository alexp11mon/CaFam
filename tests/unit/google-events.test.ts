import { describe, expect, it } from "vitest";
import { convertGoogleEvents } from "@/lib/sync/google-events";
import fixture from "../fixtures/sync/google-events.json";

// Spec 007, T5: Google events to rows (RF-16, RF-17, RF-18).
const { events, skipped } = convertGoogleEvents(fixture.items);
const byId = (id: string) => events.find((e) => e.external_id === id);

describe("convertGoogleEvents", () => {
  it("converts a timed event to UTC instants with its texts", () => {
    expect(byId("timed1")).toEqual({
      external_id: "timed1",
      title: "Dentista",
      description: "Revisión anual",
      location: "Calle Mayor 1",
      starts_at: "2026-11-02T09:00:00.000Z",
      ends_at: "2026-11-02T10:00:00.000Z",
      all_day: false,
    });
  });

  it("uses the spec 002 convention for all-day events", () => {
    expect(byId("allday1")).toMatchObject({
      starts_at: "2026-11-05T00:00:00.000Z",
      ends_at: "2026-11-06T00:00:00.000Z",
      all_day: true,
      description: null,
      location: null,
    });
    expect(byId("multi1")).toMatchObject({
      starts_at: "2026-12-22T00:00:00.000Z",
      ends_at: "2026-12-27T00:00:00.000Z",
    });
  });

  it("gives an untitled event a title", () => {
    expect(byId("notitle1")?.title).toBe("(Sin título)");
  });

  it("drops cancelled events and counts those with the end before the start", () => {
    expect(byId("cancelled1")).toBeUndefined();
    expect(byId("backwards1")).toBeUndefined();
    expect(skipped).toBe(1);
  });

  it("keeps each repetition with its own id, modified ones included (RF-16)", () => {
    expect(byId("weekly_20261109T090000Z")?.starts_at).toBe(
      "2026-11-09T09:00:00.000Z",
    );
    expect(byId("weekly_20261116T090000Z")).toMatchObject({
      title: "Clase (cambiada)",
      starts_at: "2026-11-16T11:00:00.000Z",
    });
  });

  it("cuts long texts to the table limits", () => {
    const [row] = convertGoogleEvents([
      {
        id: "long",
        summary: "t".repeat(150),
        description: "d".repeat(2500),
        location: "l".repeat(300),
        start: { date: "2026-11-01" },
        end: { date: "2026-11-02" },
      },
    ]).events;
    expect(row.title).toHaveLength(100);
    expect(row.description).toHaveLength(2000);
    expect(row.location).toHaveLength(200);
  });
});
