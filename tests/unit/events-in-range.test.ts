// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

// Spec 023, T9: PostgREST answers 1,000 rows at most, without an error. The
// range read asks for the next page until one comes short (RF-13, plan D10).
vi.mock("next/server", () => ({ connection: async () => {} }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

const { getEventsInRange } = await import("@/lib/calendar/queries");

function row(index: number) {
  return {
    id: `e${index}`,
    calendar_id: "cal",
    title: `Evento ${index}`,
    starts_at: "2026-11-10T10:00:00.000Z",
    ends_at: "2026-11-10T11:00:00.000Z",
    all_day: false,
    color: null,
    category_id: null,
    location: null,
    series_id: null,
    event_images: [],
    event_comments: [],
  };
}

/** A client whose single events come from `rows`; no series. */
function client(rows: unknown[]) {
  const calls: { single: boolean; range: [number, number]; order: string[] }[] =
    [];
  const from = () => {
    const call = {
      single: false,
      range: [0, 0] as [number, number],
      order: [] as string[],
    };
    const builder: Record<string, unknown> = {};
    const chain = () => builder;
    Object.assign(builder, {
      select: chain,
      eq: chain,
      lt: chain,
      gte: chain,
      or: chain,
      not: chain,
      is: (column: string) => {
        if (column === "recurrence") call.single = true;
        return builder;
      },
      order: (column: string) => {
        call.order.push(column);
        return builder;
      },
      range: (start: number, end: number) => {
        call.range = [start, end];
        return builder;
      },
      then: (resolve: (value: unknown) => void) => {
        calls.push(call);
        resolve({
          data: call.single ? rows.slice(call.range[0], call.range[1] + 1) : [],
          error: null,
        });
      },
    });
    return builder;
  };
  return { supabase: { from } as never, calls };
}

const FROM = new Date("2026-11-09T00:00:00Z");
const TO = new Date("2026-11-16T00:00:00Z");

describe("getEventsInRange pages", () => {
  it("asks for the next page after a full one", async () => {
    const { supabase, calls } = client(
      Array.from({ length: 1005 }, (_, index) => row(index)),
    );

    const events = await getEventsInRange(supabase, FROM, TO);

    expect(events).toHaveLength(1005);
    expect(new Set(events.map((event) => event.id)).size).toBe(1005);
    const single = calls.filter((call) => call.single);
    expect(single.map((call) => call.range)).toEqual([
      [0, 999],
      [1000, 1999],
    ]);
    // A stable order, or a page could repeat or skip rows.
    expect(single[0].order).toEqual(["starts_at", "id"]);
  });

  it("stops at a short page", async () => {
    const { supabase, calls } = client([row(1), row(2)]);

    expect(await getEventsInRange(supabase, FROM, TO)).toHaveLength(2);
    expect(calls.filter((call) => call.single)).toHaveLength(1);
  });
});
