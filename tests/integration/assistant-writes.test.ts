import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { writeTools } from "@/app/dashboard/assistant/assistant-writes";
import {
  applyPendingChange,
  applyPendingDelete,
  applyPendingSeries,
  undoWrite,
} from "@/app/dashboard/assistant/change-writes";
import type { AssistantUndo, PendingChange } from "@/lib/assistant/actions";
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

// Deleting refreshes the views (spec 052): outside Next there is no cache.
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

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

/** What "Confirmar" runs, with the user's session (write-actions.ts). */
const confirmPending = (user: TestUser, change: PendingChange) =>
  applyPendingChange(user.client, TZ, change);
const undoWith = (user: TestUser, undo: AssistantUndo) =>
  undoWrite(user.client, TZ, undo);

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
    recurrence: "FREQ=WEEKLY;INTERVAL=1;BYDAY=TH;COUNT=4",
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

// Spec 036, T5: what "Confirmar" and "Deshacer" write (RF-24a, RF-24d,
// RF-29, RF-33 to RF-37; plan D7, D8).
describe("changes and undo against the database", () => {
  async function dentist(day = "2026-12-11") {
    const { data, error } = await admin
      .from("events")
      .insert({
        calendar_id: anaCal,
        title: "Dentista",
        starts_at: `${day}T16:00:00Z`,
        ends_at: `${day}T17:00:00Z`,
        created_by: ana.id,
      })
      .select("id")
      .single();
    if (error) throw error;
    return data.id;
  }

  async function proposeFor(title: string, change: object) {
    const { api, actions } = tools(ana);
    const result = await api.propose_changes({
      changes: [{ event: title, ...change }],
    });
    const action = actions[0];
    if (action?.kind !== "change") throw new Error(JSON.stringify(result));
    return action;
  }

  it("writes nothing until confirmed, then applies it and undoes it", async () => {
    const id = await dentist();
    const action = await proposeFor("Dentista", { start: "18:00" });
    const { data: before } = await admin
      .from("events")
      .select("starts_at")
      .eq("id", id)
      .single();
    expect(before!.starts_at).toBe("2026-12-11T16:00:00+00:00");

    const confirmed = await confirmPending(ana, action.change);
    expect(confirmed).toMatchObject({ ok: true });
    const { data: after } = await admin
      .from("events")
      .select("starts_at, ends_at")
      .eq("id", id)
      .single();
    expect(after).toEqual({
      starts_at: "2026-12-11T17:00:00+00:00",
      ends_at: "2026-12-11T18:00:00+00:00",
    });

    if (!confirmed.ok || !confirmed.undo) throw new Error("no undo");
    expect(await undoWith(ana, confirmed.undo)).toEqual({ ok: true });
    const { data: undone } = await admin
      .from("events")
      .select("starts_at")
      .eq("id", id)
      .single();
    expect(undone!.starts_at).toBe("2026-12-11T16:00:00+00:00");
  });

  it("does not apply a change if the event changed meanwhile (RF-24d)", async () => {
    const id = await dentist("2026-12-18");
    const action = await proposeFor("Dentista", {
      eventDate: "2026-12-18",
      start: "19:00",
    });
    // Someone else moves it first (the clock of the database moves on).
    await new Promise((resolve) => setTimeout(resolve, 20));
    await admin
      .from("events")
      .update({ title: "Dentista (Luis)" })
      .eq("id", id);
    expect(await confirmPending(ana, action.change)).toEqual({
      ok: false,
      error:
        "Este evento ha cambiado desde que te propuse el cambio; no lo he aplicado. Pídemelo otra vez.",
    });
    const { data } = await admin
      .from("events")
      .select("starts_at")
      .eq("id", id)
      .single();
    expect(data!.starts_at).toBe("2026-12-18T16:00:00+00:00");
  });

  it("changes one PIAE only, and undoes it (RF-29)", async () => {
    const action = await proposeFor("PIAE", {
      eventDate: "2026-12-10",
      start: "12:30",
    });
    expect(action.scope).toBe("this");
    const confirmed = await confirmPending(ana, action.change);
    expect(confirmed).toMatchObject({ ok: true });
    const { data } = await admin
      .from("events")
      .select("starts_at, series_id")
      .eq("title", "PIAE")
      .not("series_id", "is", null);
    expect(data).toEqual([
      expect.objectContaining({ starts_at: "2026-12-10T11:30:00+00:00" }),
    ]);
    if (!confirmed.ok || !confirmed.undo) throw new Error("no undo");
    expect(await undoWith(ana, confirmed.undo)).toEqual({ ok: true });
    const { data: back } = await admin
      .from("events")
      .select("starts_at")
      .eq("title", "PIAE")
      .not("series_id", "is", null);
    expect(back).toEqual([{ starts_at: "2026-12-10T11:00:00+00:00" }]);
  });

  it("undoes a creation unless someone changed it (RF-34, RF-36)", async () => {
    const { api, actions } = tools(ana);
    await api.create_events({
      events: [
        {
          title: "Borrable",
          calendar: "Uni",
          date: "2026-12-12",
          start: "10:00",
        },
      ],
    });
    await api.create_events({
      events: [
        {
          title: "Tocado",
          calendar: "Uni",
          date: "2026-12-12",
          start: "12:00",
        },
      ],
    });
    const [first, second] = actions;
    if (first?.kind !== "created" || second?.kind !== "created") {
      throw new Error("not created");
    }
    expect(await undoWith(ana, first.undo)).toEqual({ ok: true });
    const { count } = await admin
      .from("events")
      .select("id", { count: "exact", head: true })
      .eq("id", first.event.id);
    expect(count).toBe(0);

    await new Promise((resolve) => setTimeout(resolve, 20));
    await admin
      .from("events")
      .update({ location: "Aula 3" })
      .eq("id", second.event.id);
    expect(await undoWith(ana, second.undo)).toEqual({
      ok: false,
      error: "Este evento ha cambiado entretanto; no se ha deshecho.",
    });
  });

  it("refuses to confirm as a reader (RLS decides, RF-39)", async () => {
    const { data: samEvent } = await admin
      .from("events")
      .insert({
        calendar_id: samCal,
        title: "Turno Sam",
        starts_at: "2026-12-14T07:00:00Z",
        ends_at: "2026-12-14T14:00:00Z",
        created_by: sam.id,
      })
      .select("id, updated_at")
      .single();
    const result = await confirmPending(ana, {
      id: samEvent!.id,
      scope: null,
      updatedAt: samEvent!.updated_at,
      fields: {
        title: "Turno Sam",
        description: null,
        location: null,
        calendarId: samCal,
        startsAt: "2026-12-14T08:00:00.000Z",
        endsAt: "2026-12-14T15:00:00.000Z",
        allDay: false,
      },
    });
    expect(result).toMatchObject({ ok: false });
    const { data } = await admin
      .from("events")
      .select("starts_at")
      .eq("id", samEvent!.id)
      .single();
    expect(data!.starts_at).toBe("2026-12-14T07:00:00+00:00");
  });
});

// Spec 052 T2, T3: deleting and series, confirmed with the user's session.
describe("deletions and series against the database", () => {
  async function event(title: string, day: string, calendar = anaCal) {
    const { data, error } = await admin
      .from("events")
      .insert({
        calendar_id: calendar,
        title,
        starts_at: `${day}T18:00:00Z`,
        ends_at: `${day}T19:00:00Z`,
        created_by: ana.id,
      })
      .select("id")
      .single();
    if (error) throw error;
    return data.id;
  }

  async function proposeDelete(user: TestUser, args: object) {
    const { api, actions } = tools(user);
    const result = await api.propose_deletes({ deletes: [args] });
    return { result, action: actions[0] };
  }

  it("deletes nothing until confirmed, then through the trash, and undoes it (RF-1, RF-3)", async () => {
    const id = await event("Cena de empresa", "2026-12-15");
    const { action } = await proposeDelete(ana, { event: "Cena de empresa" });
    if (action?.kind !== "delete") throw new Error("no card");
    const { count: still } = await admin
      .from("events")
      .select("id", { count: "exact", head: true })
      .eq("id", id);
    expect(still).toBe(1);

    const confirmed = await applyPendingDelete(ana.client, action.remove);
    expect(confirmed).toMatchObject({ ok: true, undo: { kind: "restore" } });
    const { count: gone } = await admin
      .from("events")
      .select("id", { count: "exact", head: true })
      .eq("id", id);
    expect(gone).toBe(0);
    const { count: trashed } = await admin
      .from("event_trash")
      .select("id", { count: "exact", head: true })
      .eq("title", "Cena de empresa");
    expect(trashed).toBe(1);

    if (!confirmed.ok || !confirmed.undo) throw new Error("no undo");
    expect(await undoWith(ana, confirmed.undo)).toEqual({ ok: true });
    const { data: back } = await admin
      .from("events")
      .select("starts_at")
      .eq("title", "Cena de empresa");
    expect(back).toEqual([{ starts_at: "2026-12-15T18:00:00+00:00" }]);
  });

  it("deletes one PIAE only by default (RF-2)", async () => {
    const { action } = await proposeDelete(ana, {
      event: "PIAE",
      eventDate: "2026-12-17",
    });
    if (action?.kind !== "delete") throw new Error("no card");
    expect(action.scope).toBe("this");
    expect(await applyPendingDelete(ana.client, action.remove)).toMatchObject({
      ok: true,
    });
    const { data } = await admin
      .from("events")
      .select("exdates")
      .eq("title", "PIAE")
      .is("series_id", null)
      .single();
    expect(data!.exdates).toEqual(["2026-12-17T11:00:00+00:00"]);
  });

  it("does not delete if the event changed meanwhile", async () => {
    const id = await event("Reunión movida", "2026-12-16");
    const { action } = await proposeDelete(ana, { event: "Reunión movida" });
    if (action?.kind !== "delete") throw new Error("no card");
    await new Promise((resolve) => setTimeout(resolve, 20));
    await admin.from("events").update({ location: "Sala 2" }).eq("id", id);
    expect(await applyPendingDelete(ana.client, action.remove)).toMatchObject({
      ok: false,
    });
  });

  it("a reader gets no card, and the database refuses anyway (RF-4)", async () => {
    const id = await event("Turno de guardia", "2026-12-19", samCal);
    const { result, action } = await proposeDelete(ana, {
      event: "Turno de guardia",
    });
    expect(result).toMatchObject({ status: "forbidden" });
    expect(action).toBeUndefined();
    const { data: row } = await admin
      .from("events")
      .select("updated_at")
      .eq("id", id)
      .single();
    expect(
      await applyPendingDelete(ana.client, {
        id,
        scope: null,
        updatedAt: row!.updated_at,
      }),
    ).toMatchObject({ ok: false });
    const { count } = await admin
      .from("events")
      .select("id", { count: "exact", head: true })
      .eq("id", id);
    expect(count).toBe(1);
  });

  it("creates the series only when confirmed, and undoes it (RF-5, RF-6)", async () => {
    const { api, actions } = tools(ana);
    const result = await api.propose_series({
      series: [
        {
          title: "Inglés",
          calendar: "Uni",
          start: "18:00",
          freq: "weekly",
          byDay: ["TU"],
          until: "2027-06-30",
        },
      ],
    });
    expect(result).toMatchObject({ status: "proposed_series" });
    const action = actions[0];
    if (action?.kind !== "series") throw new Error("no card");
    expect(action.dates).toHaveLength(3);
    const { count: none } = await admin
      .from("events")
      .select("id", { count: "exact", head: true })
      .eq("title", "Inglés");
    expect(none).toBe(0);

    const confirmed = await applyPendingSeries(
      ana.client,
      ana.id,
      TZ,
      action.series,
    );
    expect(confirmed).toMatchObject({ ok: true, undo: { kind: "unseries" } });
    const { data } = await admin
      .from("events")
      .select("starts_at, recurrence, recurrence_tz, created_by")
      .eq("title", "Inglés")
      .single();
    expect(data).toEqual({
      // Wednesday 2 December: the first Tuesday is the 8th, 18:00 in Madrid.
      starts_at: "2026-12-08T17:00:00+00:00",
      recurrence: "FREQ=WEEKLY;INTERVAL=1;BYDAY=TU;UNTIL=20270630T235959",
      recurrence_tz: TZ,
      created_by: ana.id,
    });

    if (!confirmed.ok || !confirmed.undo) throw new Error("no undo");
    expect(await undoWith(ana, confirmed.undo)).toEqual({ ok: true });
    const { count } = await admin
      .from("events")
      .select("id", { count: "exact", head: true })
      .eq("title", "Inglés");
    expect(count).toBe(0);
  });

  it("a series in a calendar Ana only reads is refused by the database", async () => {
    const result = await applyPendingSeries(ana.client, ana.id, TZ, {
      calendarId: samCal,
      title: "Intruso",
      description: null,
      location: null,
      startsAt: "2026-12-08T17:00:00.000Z",
      endsAt: "2026-12-08T18:00:00.000Z",
      allDay: false,
      rule: { freq: "daily", interval: 1, end: { kind: "count", count: 2 } },
    });
    expect(result).toMatchObject({ ok: false });
  });
});
