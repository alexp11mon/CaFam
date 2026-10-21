import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  admin,
  createTestUser,
  deleteTestUser,
  getOwnCalendarId,
  type TestUser,
} from "./helpers";

// Spec 002 RNF rendimiento (plan D14): the month view query with 500 events
// answers in under 3 s, through RLS as a real user.
let user: TestUser;
let calendarId: string;

const EVENTS_IN_MONTH = 500;

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
  const { error } = await admin
    .from("events")
    .insert([...november, ...december]);
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
