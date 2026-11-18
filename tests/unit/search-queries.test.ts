// @vitest-environment node
import { describe, expect, it } from "vitest";
import { searchEvents, searchRange } from "@/lib/search/queries";

// Spec 039, T3: search results with the occurrences of series (RF-5, RF-8).
const SERIES = "11111111-1111-4111-8111-111111111111";
const EXCEPTION = "22222222-2222-4222-8222-222222222222";
const OTHER = "33333333-3333-4333-8333-333333333333";

type Row = Record<string, unknown>;

function row(id: string, extra: Row = {}): Row {
  return {
    id,
    calendar_id: "cal-1",
    title: "Piano",
    starts_at: "2026-11-05T16:00:00+00:00",
    ends_at: "2026-11-05T17:00:00+00:00",
    all_day: false,
    color: null,
    category_id: null,
    location: null,
    recurrence: null,
    recurrence_tz: null,
    exdates: [],
    series_id: null,
    original_start: null,
    event_images: [{ count: 0 }],
    event_comments: [{ count: 0 }],
    ...extra,
  };
}

const series = row(SERIES, {
  recurrence: "FREQ=WEEKLY;INTERVAL=1;BYDAY=TH",
  recurrence_tz: "Europe/Madrid",
});
// The occurrence of 12 November was renamed: it no longer says "Piano".
const exception = row(EXCEPTION, {
  title: "Solfeo",
  series_id: SERIES,
  original_start: "2026-11-12T16:00:00+00:00",
  starts_at: "2026-11-12T16:00:00+00:00",
  ends_at: "2026-11-12T17:00:00+00:00",
});

function fakeClient(matches: Row[], rows: Row[]) {
  const calls: { fn: string; args: unknown }[] = [];
  const query = () => {
    let list = rows;
    const builder = {
      select: () => builder,
      in: (column: string, values: unknown[]) => {
        list = list.filter((r) => values.includes(r[column]));
        return builder;
      },
      eq: () => builder,
      then: (resolve: (value: { data: Row[]; error: null }) => void) =>
        resolve({ data: list, error: null }),
    };
    return builder;
  };
  const client = {
    rpc: async (fn: string, args: unknown) => {
      calls.push({ fn, args });
      return { data: matches, error: null };
    },
    from: () => query(),
  };
  return { client: client as never, calls };
}

const range = {
  from: new Date("2026-11-01T00:00:00Z"),
  to: new Date("2026-11-30T00:00:00Z"),
};

describe("searchEvents", () => {
  it("gives the occurrences of a matching series, without the renamed one", async () => {
    const { client, calls } = fakeClient(
      [{ event_id: SERIES, matched_comment: null }],
      [series, exception],
    );
    const { results, more } = await searchEvents(
      client,
      "piano",
      range,
      new Date("2026-11-01T00:00:00Z"),
    );
    expect(calls[0]).toEqual({
      fn: "search_events",
      args: {
        p_query: "piano",
        p_from: range.from.toISOString(),
        p_to: range.to.toISOString(),
        p_limit: 300,
      },
    });
    expect(results.map((r) => r.startsAt.slice(0, 10))).toEqual([
      "2026-11-05",
      "2026-11-19",
      "2026-11-26",
    ]);
    expect(results[0].id).toBe(`${SERIES}_20261105T160000Z`);
    expect(more).toBe(false);
  });

  it("gives the exception when it is what matches", async () => {
    const { client } = fakeClient(
      [{ event_id: EXCEPTION, matched_comment: "Llevar partituras" }],
      [series, exception],
    );
    const { results } = await searchEvents(client, "solfeo", range);
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      id: EXCEPTION,
      title: "Solfeo",
      seriesId: SERIES,
      matchedComment: "Llevar partituras",
    });
  });

  it("keeps 100 at most and says there are more (RF-8)", async () => {
    const daily = row(OTHER, {
      title: "Paseo",
      starts_at: "2026-01-01T08:00:00+00:00",
      ends_at: "2026-01-01T09:00:00+00:00",
      recurrence: "FREQ=DAILY;INTERVAL=1",
      recurrence_tz: "Europe/Madrid",
    });
    const { client } = fakeClient(
      [{ event_id: OTHER, matched_comment: null }],
      [daily],
    );
    const { results, more } = await searchEvents(client, "paseo", {
      from: new Date("2026-01-01T00:00:00Z"),
      to: new Date("2026-12-31T00:00:00Z"),
    });
    expect(results).toHaveLength(100);
    expect(more).toBe(true);
  });

  it("does not search with less than 2 characters", async () => {
    const { client, calls } = fakeClient([], []);
    expect(await searchEvents(client, " a ", range)).toEqual({
      results: [],
      more: false,
    });
    expect(calls).toEqual([]);
  });
});

describe("searchRange", () => {
  const now = new Date("2026-11-18T12:00:00Z");

  it("goes from 1 year back to 2 ahead (RF-5)", () => {
    const { from, to } = searchRange(now);
    expect(from.toISOString()).toBe("2025-11-18T12:00:00.000Z");
    expect(to.toISOString()).toBe("2028-11-18T12:00:00.000Z");
  });

  it("widens the start 2 years each time (Buscar más atrás)", () => {
    expect(searchRange(now, 2).from.toISOString()).toBe(
      "2021-11-18T12:00:00.000Z",
    );
  });
});
