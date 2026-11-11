// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

// Spec 023, T8: a single event with comments that becomes a series stays as
// the first occurrence of a new series row, as it already did with images.
// The series row never shows comments, so they would be out of reach (RF-12).
const EVENT_ID = "5b8f6c2e-3f0a-4d8e-9a51-2a8f1d7c9e10";
const CALENDAR_ID = "0d7e1c6a-8b2f-4c3d-9e4f-5a6b7c8d9e0f";
const SERIES_ID = "9a1b2c3d-4e5f-4a6b-8c7d-0e1f2a3b4c5d";

const h = vi.hoisted(() => ({
  counts: {} as Record<string, number>,
  writes: [] as { table: string; op: string; payload: unknown }[],
}));

// Every call chains; awaiting it answers by table and operation.
function query(table: string, op = "select", payload?: unknown): unknown {
  const answer = () => {
    if (op !== "select") h.writes.push({ table, op, payload });
    if (table === "events" && op === "insert") {
      return { data: { id: SERIES_ID }, error: null };
    }
    return { data: null, error: null, count: h.counts[table] ?? 0 };
  };
  return new Proxy(
    {},
    {
      get(_target, key) {
        if (key === "then") {
          return (resolve: (value: unknown) => void) => resolve(answer());
        }
        if (key === "insert" || key === "update" || key === "delete") {
          return (value: unknown) => query(table, String(key), value);
        }
        return () => query(table, op, payload);
      },
    },
  );
}

vi.mock("@/lib/sync/write-event", () => ({ writeEvent: vi.fn() }));
vi.mock("@/lib/sync/engine", () => ({ writeEngineDeps: () => ({}) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));
vi.mock("@/lib/calendar/queries", () => ({
  requireActionUser: async () => ({
    supabase: { from: (table: string) => query(table) },
    userId: "u1",
  }),
  getProfileTimeZone: async () => "Europe/Madrid",
  getEvent: async () => ({
    id: EVENT_ID,
    calendarId: CALENDAR_ID,
    createdBy: "author",
    series: null,
  }),
}));

const { updateEvent } = await import("@/app/dashboard/events/actions");

function form() {
  const data = new FormData();
  const fields = {
    title: "Cena",
    calendarId: CALENDAR_ID,
    startDate: "2026-10-23",
    startTime: "21:00",
    endDate: "2026-10-23",
    endTime: "22:00",
    repeat: "weekly",
    mode: "modal",
  };
  for (const [key, value] of Object.entries(fields)) data.append(key, value);
  return data;
}

const EMPTY = { values: {} } as Parameters<typeof updateEvent>[1];

beforeEach(() => {
  h.counts = {};
  h.writes = [];
});

describe("a single event that becomes a series", () => {
  it("is updated in place when it has neither images nor comments", async () => {
    const state = await updateEvent(EVENT_ID, EMPTY, form());

    expect(state.done).toBe("updated");
    expect(h.writes.map((write) => write.op)).toEqual(["update"]);
    expect(h.writes[0].payload).toMatchObject({
      recurrence: "FREQ=WEEKLY;INTERVAL=1;BYDAY=FR",
    });
  });

  it.each(["event_images", "event_comments"])(
    "stays as the first occurrence of a new series when it has %s",
    async (table) => {
      h.counts = { [table]: 2 };

      const state = await updateEvent(EVENT_ID, EMPTY, form());

      expect(state.done).toBe("updated");
      expect(h.writes.map((write) => write.op)).toEqual(["insert", "update"]);
      expect(h.writes[0].payload).toMatchObject({
        recurrence: "FREQ=WEEKLY;INTERVAL=1;BYDAY=FR",
        created_by: "author",
      });
      // The original row keeps its images and comments as an occurrence.
      expect(h.writes[1].payload).toMatchObject({
        series_id: SERIES_ID,
        original_start: "2026-10-23T19:00:00.000Z",
      });
      expect(h.writes[1].payload).not.toHaveProperty("recurrence");
    },
  );
});
