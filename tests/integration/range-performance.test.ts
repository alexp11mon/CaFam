import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getEventsInRange } from "@/lib/calendar/queries";
import { getVisibleRange } from "@/lib/calendar/ranges";
import {
  admin,
  createTestUser,
  deleteTestUser,
  getOwnCalendarId,
  type TestUser,
} from "./helpers";

// Spec 002 RNF rendimiento (plan D14): the month view query with 500 events
// answers in under 3 s, through RLS as a real user. Spec 005 adds the same
// threshold for the agenda: 500 events in its 14 days (RNF rendimiento).
let user: TestUser;
let calendarId: string;

const EVENTS_IN_MONTH = 500;
const EVENTS_IN_AGENDA = 500;

beforeAll(async () => {
  user = await createTestUser({ display_name: "Rendimiento" });
  calendarId = await getOwnCalendarId(user.id);

  const day = (n: number) => String(n).padStart(2, "0");
  const november = Array.from({ length: EVENTS_IN_MONTH }, (_, index) => ({
    calendar_id: calendarId,
    title: `Evento ${index}`,
    starts_at: `2026-11-${day((index % 28) + 1)}T${day(index % 24)}:00:00Z`,
    ends_at: `2026-11-${day((index % 28) + 1)}T${day(index % 24)}:30:00Z`,
  }));
  const december = Array.from({ length: 50 }, (_, index) => ({
    calendar_id: calendarId,
    title: `Fuera ${index}`,
    starts_at: "2026-12-15T10:00:00Z",
    ends_at: "2026-12-15T11:00:00Z",
  }));
  // 4 to 17 January 2027 in Madrid: the 14 days of the agenda below.
  const january = Array.from({ length: EVENTS_IN_AGENDA }, (_, index) => ({
    calendar_id: calendarId,
    title: `Agenda ${index}`,
    location: "Casa",
    starts_at: `2027-01-${day((index % 14) + 4)}T${day((index % 12) + 8)}:00:00Z`,
    ends_at: `2027-01-${day((index % 14) + 4)}T${day((index % 12) + 8)}:45:00Z`,
  }));
  const { error } = await admin
    .from("events")
    .insert([...november, ...december, ...january]);
  if (error) throw error;
});

afterAll(async () => {
  if (user) await deleteTestUser(user.id);
});

describe("month query with 500 events", () => {
  it("returns only the events of the visible range in under 3 seconds", async () => {
    const started = performance.now();
    const { data, error } = await user.client
      .from("events")
      .select(
        "id, calendar_id, title, starts_at, ends_at, all_day, color, category_id",
      )
      // The same filter the month view uses (getEventsInRange): Monday 26 Oct to Monday 7 Dec.
      .lt("starts_at", "2026-12-01T00:00:00Z")
      .gte("ends_at", "2026-10-26T00:00:00Z")
      .order("starts_at");
    const elapsed = performance.now() - started;

    expect(error).toBeNull();
    expect(data).toHaveLength(EVENTS_IN_MONTH);
    expect(elapsed).toBeLessThan(3000);
  });
});

describe("agenda query with 500 events (spec 005 RNF rendimiento)", () => {
  it("returns the 14 days in under 3 seconds", async () => {
    const range = getVisibleRange("agenda", "2027-01-04", "Europe/Madrid");
    const started = performance.now();
    const { data, error } = await user.client
      .from("events")
      .select(
        "id, calendar_id, title, starts_at, ends_at, all_day, color, category_id, location",
      )
      // The same filter getEventsInRange applies to the agenda range.
      .lt("starts_at", range.to.toISOString())
      .gte("ends_at", range.from.toISOString())
      .order("starts_at");
    const elapsed = performance.now() - started;

    expect(error).toBeNull();
    expect(data).toHaveLength(EVENTS_IN_AGENDA);
    expect(elapsed).toBeLessThan(3000);
  });
});

// Spec 013 RNF rendimiento: a view with 50 active series takes at most 300 ms
// more than the same view with 50 single events. Best of three runs, so a slow
// round trip to Supabase does not decide it.
describe("month with 50 series (spec 013 RNF rendimiento)", () => {
  let seriesUser: TestUser;
  let singlesUser: TestUser;

  beforeAll(async () => {
    [seriesUser, singlesUser] = await Promise.all([
      createTestUser({ display_name: "Series" }),
      createTestUser({ display_name: "Sueltos" }),
    ]);
    const [seriesCalendar, singlesCalendar] = await Promise.all([
      getOwnCalendarId(seriesUser.id),
      getOwnCalendarId(singlesUser.id),
    ]);
    // Long-running series, half daily and half on three weekdays.
    const series = Array.from({ length: 50 }, (_, index) => ({
      calendar_id: seriesCalendar,
      title: `Serie ${index}`,
      starts_at: "2024-01-01T08:00:00Z",
      ends_at: "2024-01-01T09:00:00Z",
      recurrence:
        index % 2
          ? "FREQ=DAILY;INTERVAL=1"
          : "FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,WE,FR",
      recurrence_tz: "Europe/Madrid",
    }));
    const singles = Array.from({ length: 50 }, (_, index) => ({
      calendar_id: singlesCalendar,
      title: `Suelto ${index}`,
      starts_at: `2026-11-${String((index % 28) + 1).padStart(2, "0")}T08:00:00Z`,
      ends_at: `2026-11-${String((index % 28) + 1).padStart(2, "0")}T09:00:00Z`,
    }));
    const { error } = await admin
      .from("events")
      .insert([...series, ...singles]);
    if (error) throw error;
  });

  afterAll(async () => {
    await Promise.all(
      [seriesUser, singlesUser]
        .filter(Boolean)
        .map((u) => deleteTestUser(u.id)),
    );
  });

  async function bestOfThree(client: TestUser["client"]) {
    const range = getVisibleRange("month", "2026-11-01", "Europe/Madrid");
    const times: number[] = [];
    let count = 0;
    for (let run = 0; run < 3; run++) {
      const started = performance.now();
      count = (await getEventsInRange(client as never, range.from, range.to))
        .length;
      times.push(performance.now() - started);
    }
    return { time: Math.min(...times), count };
  }

  it("takes at most 300 ms more than 50 single events", async () => {
    const singles = await bestOfThree(singlesUser.client);
    const series = await bestOfThree(seriesUser.client);
    expect(singles.count).toBe(50);
    expect(series.count).toBeGreaterThan(900);
    expect(series.time - singles.time).toBeLessThan(300);
  });
});
