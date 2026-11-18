import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { writeTools } from "@/app/dashboard/assistant/assistant-writes";
import type { AssistantAction } from "@/lib/assistant/actions";
import { createRefs } from "@/lib/assistant/citations";
import type { CitedEvent } from "@/lib/assistant/tools";
import {
  admin,
  createTestUser,
  deleteTestMail,
  deleteTestUser,
  getOwnCalendarId,
  type TestUser,
} from "./helpers";

// Spec 036, T4 and T5: Venito writes with the user's session, so RLS decides
// (RF-1 to RF-30, RF-39; plan D1, D7).
const TZ = "Europe/Madrid";
// Wednesday 2 December 2026, 10:00 in Madrid.
const NOW = new Date("2026-12-02T09:00:00Z");

let ana: TestUser;
let luis: TestUser;
let sam: TestUser;
let anaCal: string;
let luisCal: string; // Ana is an editor
let samCal: string; // Ana is a reader

function tools(user: TestUser) {
  const actions: AssistantAction[] = [];
  const api = writeTools({
    supabase: user.client,
    userId: user.id,
    timeZone: TZ,
    now: NOW,
    refs: createRefs<CitedEvent>(),
    onAction: (action) => actions.push(action),
  });
  return { api, actions };
}

beforeAll(async () => {
  [ana, luis, sam] = await Promise.all([
    createTestUser({ display_name: "Ana" }),
    createTestUser({ display_name: "Luis" }),
    createTestUser({ display_name: "Sam" }),
  ]);
  [anaCal, luisCal, samCal] = await Promise.all(
    [ana, luis, sam].map((u) => getOwnCalendarId(u.id)),
  );
  await admin.from("calendars").update({ name: "Uni" }).eq("id", anaCal);
  await admin
    .from("calendars")
    .update({ name: "Casa de Luis" })
    .eq("id", luisCal);
  await admin
    .from("calendars")
    .update({ name: "Turnos de Sam" })
    .eq("id", samCal);
  const { error } = await admin.from("calendar_members").insert([
    { calendar_id: luisCal, user_id: ana.id, role: "editor" },
    { calendar_id: samCal, user_id: ana.id, role: "viewer" },
  ]);
  if (error) throw error;
  // PIAE every Thursday 12:00-13:30 in Madrid, from 3 December.
  const { error: seriesError } = await admin.from("events").insert({
    calendar_id: anaCal,
    title: "PIAE",
    starts_at: "2026-12-03T11:00:00Z",
    ends_at: "2026-12-03T12:30:00Z",
    recurrence: "FREQ=WEEKLY;BYDAY=TH;COUNT=4",
    recurrence_tz: TZ,
    recurrence_until: "2026-12-24T12:30:00Z",
    created_by: ana.id,
  });
  if (seriesError) throw seriesError;
});

afterAll(async () => {
  for (const user of [ana, luis, sam]) if (user) await deleteTestUser(user.id);
  await deleteTestMail();
});

describe("create_events against the database", () => {
  it("creates the user's example after the next PIAE (RF-9, RF-14)", async () => {
    const { api, actions } = tools(ana);
    const result = await api.create_events({
      events: [
        { title: "Comida Uni", calendar: "uni", after: "PIAE", end: "14:30" },
      ],
    });
    expect(result).toMatchObject({
      status: "created",
      date: "2026-12-03",
      start: "13:30",
      end: "14:30",
      calendar: "Uni",
    });
    const id = actions[0]!.kind === "created" ? actions[0]!.event.id : "";
    const { data } = await admin
      .from("events")
      .select("calendar_id, title, starts_at, ends_at, created_by, updated_at")
      .eq("id", id)
      .single();
    expect(data).toMatchObject({
      calendar_id: anaCal,
      title: "Comida Uni",
      starts_at: "2026-12-03T12:30:00+00:00",
      ends_at: "2026-12-03T13:30:00+00:00",
      created_by: ana.id,
    });
    expect(actions[0]).toMatchObject({
      undo: { kind: "uncreate", id, updatedAt: data!.updated_at },
    });
  });

  it("uses the PIAE of the day the user says (RF-13)", async () => {
    const { api } = tools(ana);
    expect(
      await api.create_events({
        events: [
          {
            title: "Repaso",
            calendar: "Uni",
            before: "PIAE",
            anchorDate: "2026-12-17",
            durationMinutes: 30,
          },
        ],
      }),
    ).toMatchObject({
      status: "created",
      date: "2026-12-17",
      start: "11:30",
      end: "12:00",
    });
  });

  it("creates as an editor of someone else's calendar", async () => {
    const { api } = tools(ana);
    expect(
      await api.create_events({
        events: [
          {
            title: "Cena",
            calendar: "casa de luis",
            date: "2026-12-05",
            start: "21:00",
          },
        ],
      }),
    ).toMatchObject({ status: "created", calendar: "Casa de Luis" });
    const { count } = await admin
      .from("events")
      .select("id", { count: "exact", head: true })
      .eq("calendar_id", luisCal);
    expect(count).toBe(1);
  });

  it("writes nothing in a calendar Ana only reads (RF-18, RF-23)", async () => {
    const { api, actions } = tools(ana);
    expect(
      await api.create_events({
        events: [
          {
            title: "Turno",
            calendar: "Turnos de Sam",
            date: "2026-12-05",
            start: "08:00",
          },
        ],
      }),
    ).toMatchObject({ status: "read_only" });
    expect(actions).toEqual([]);
    const { count } = await admin
      .from("events")
      .select("id", { count: "exact", head: true })
      .eq("calendar_id", samCal);
    expect(count).toBe(0);
  });

  it("never finds events Ana cannot see (RF-12, P3)", async () => {
    await admin.from("events").insert({
      calendar_id: samCal,
      title: "Oculto",
      starts_at: "2026-12-04T10:00:00Z",
      ends_at: "2026-12-04T11:00:00Z",
      created_by: sam.id,
    });
    // Ana reads Sam's calendar, so this one she sees; one of a stranger she does not.
    const stranger = await createTestUser({ display_name: "Extraño" });
    try {
      await admin.from("events").insert({
        calendar_id: await getOwnCalendarId(stranger.id),
        title: "Secreto",
        starts_at: "2026-12-04T10:00:00Z",
        ends_at: "2026-12-04T11:00:00Z",
        created_by: stranger.id,
      });
      const { api } = tools(ana);
      expect(
        await api.create_events({
          events: [{ title: "Antes", calendar: "Uni", before: "Secreto" }],
        }),
      ).toEqual({ status: "event_not_found", title: "Secreto" });
    } finally {
      await deleteTestUser(stranger.id);
    }
  });
});
