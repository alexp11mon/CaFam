import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getBusyIntervals, getBusyPeople } from "@/lib/availability/queries";
import { getEventsInRange } from "@/lib/calendar/queries";
import { buildNowCards } from "@/lib/now/cards";
import { nowWindow } from "@/lib/now/window";
import {
  admin,
  createTestUser,
  deleteTestUser,
  getOwnCalendarId,
  type TestUser,
} from "./helpers";

// Spec 054 (RNF privacy, P3): "Ahora" reads with the user's session what the
// grid already reads, nothing else. Mother is a viewer of Son's calendar and
// sees Aunt only through availability.
let mother: TestUser;
let son: TestUser;
let aunt: TestUser;
let sonCal: string;
let auntCal: string;

const NOW = Date.parse("2026-11-27T11:00:00Z");
const ZONE = "Europe/Madrid";

beforeAll(async () => {
  [mother, son, aunt] = await Promise.all([
    createTestUser({ display_name: "Madre" }),
    createTestUser({ display_name: "Hijo" }),
    createTestUser({ display_name: "Tía" }),
  ]);
  [sonCal, auntCal] = await Promise.all([
    getOwnCalendarId(son.id),
    getOwnCalendarId(aunt.id),
  ]);
  const motherCal = await getOwnCalendarId(mother.id);
  const steps = await Promise.all([
    admin.from("calendar_members").insert([
      { calendar_id: sonCal, user_id: mother.id, role: "viewer" },
      // Aunt shares a calendar with Mother but Mother hides it: she follows
      // her only through availability.
      { calendar_id: motherCal, user_id: aunt.id, role: "editor" },
    ]),
    admin.from("profiles").update({ share_busy: true }).eq("id", aunt.id),
    admin.from("events").insert([
      {
        calendar_id: sonCal,
        title: "Mates",
        location: "Aula 3",
        starts_at: "2026-11-27T10:00:00Z",
        ends_at: "2026-11-27T12:00:00Z",
        created_by: son.id,
      },
      {
        calendar_id: auntCal,
        title: "Médico",
        location: "Clínica",
        description: "Secreto",
        starts_at: "2026-11-27T10:30:00Z",
        ends_at: "2026-11-27T11:30:00Z",
        created_by: aunt.id,
      },
    ]),
  ]);
  for (const { error } of steps) if (error) throw error;
  const { error } = await mother.client
    .from("person_preferences")
    .upsert(
      { user_id: mother.id, person_id: aunt.id, show_busy: true },
      { onConflict: "user_id,person_id" },
    );
  if (error) throw error;
});

afterAll(async () => {
  await Promise.all(
    [mother, son, aunt].filter(Boolean).map((user) => deleteTestUser(user.id)),
  );
});

describe("the reads of Ahora", () => {
  it("bring the visible events and only the times of a busy person", async () => {
    const supabase = mother.client as never;
    const window = nowWindow(ZONE, NOW);
    const [events, busy, busyPeople] = await Promise.all([
      getEventsInRange(supabase, window.from, window.to),
      getBusyIntervals(supabase, window.from, window.to),
      getBusyPeople(supabase),
    ]);

    expect(events.map((event) => event.title)).toEqual(["Mates"]);
    expect(events.some((event) => event.calendarId === auntCal)).toBe(false);
    expect(busy).toEqual([
      {
        personId: aunt.id,
        startsAt: "2026-11-27T10:30:00+00:00",
        endsAt: "2026-11-27T11:30:00+00:00",
        allDay: false,
      },
    ]);
    expect(JSON.stringify(busy)).not.toMatch(/Médico|Clínica|Secreto/);

    const cards = buildNowCards(
      {
        userId: mother.id,
        timeZone: ZONE,
        calendars: [
          { id: sonCal, name: "Hijo", ownerId: son.id, color: "#111111" },
        ],
        people: [
          { id: mother.id, displayName: "Madre" },
          { id: son.id, displayName: "Hijo" },
        ],
        preferences: { calendarPreferences: [], personPreferences: [] },
        events,
        busy,
        busyPeople,
      },
      NOW,
    );
    const auntCard = cards.find((card) => card.person.id === aunt.id);
    expect(auntCard).toMatchObject({
      busyOnly: true,
      current: { kind: "busy" },
      today: [],
      next: null,
    });
    expect(JSON.stringify(cards)).not.toMatch(/Médico|Clínica|Secreto/);
  });
});
