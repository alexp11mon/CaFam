import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readSnapshot } from "@/app/dashboard/offline-reads";
import {
  admin,
  createTestUser,
  deleteTestMail,
  deleteTestUser,
  getOwnCalendarId,
  type TestUser,
} from "./helpers";

// Spec 034, T4: the full reading of the offline copy goes through RLS and
// keeps nothing the device must not hold (RF-1 to RF-3, RF-66).
const NOW = new Date("2026-11-17T10:00:00Z");

let ana: TestUser;
let luis: TestUser;
let sam: TestUser;
let anaCal: string;
let luisCal: string;
let samCal: string;

beforeAll(async () => {
  [ana, luis, sam] = await Promise.all([
    createTestUser({ display_name: "Ana" }),
    createTestUser({ display_name: "Luis" }),
    createTestUser({ display_name: "Sam" }),
  ]);
  [anaCal, luisCal, samCal] = await Promise.all(
    [ana, luis, sam].map((u) => getOwnCalendarId(u.id)),
  );
  const member = await admin
    .from("calendar_members")
    .insert({ calendar_id: luisCal, user_id: ana.id, role: "editor" });
  if (member.error) throw member.error;
  const events = await admin.from("events").insert([
    {
      calendar_id: anaCal,
      title: "Dentista",
      description: "Llevar la tarjeta",
      starts_at: "2026-11-20T09:00:00Z",
      ends_at: "2026-11-20T10:00:00Z",
      created_by: ana.id,
    },
    {
      calendar_id: luisCal,
      title: "Cena de Luis",
      starts_at: "2026-12-01T19:00:00Z",
      ends_at: "2026-12-01T21:00:00Z",
      created_by: luis.id,
    },
    {
      calendar_id: anaCal,
      title: "Fuera del rango",
      starts_at: "2027-06-01T09:00:00Z",
      ends_at: "2027-06-01T10:00:00Z",
      created_by: ana.id,
    },
    {
      calendar_id: samCal,
      title: "Privado de Sam",
      starts_at: "2026-11-21T09:00:00Z",
      ends_at: "2026-11-21T10:00:00Z",
      created_by: sam.id,
    },
    {
      calendar_id: anaCal,
      title: "Inglés",
      description: "Aula 3",
      starts_at: "2026-11-23T17:00:00Z",
      ends_at: "2026-11-23T18:00:00Z",
      recurrence: "FREQ=WEEKLY;BYDAY=MO;COUNT=3",
      recurrence_tz: "Europe/Madrid",
      recurrence_until: "2026-12-07T18:00:00Z",
      created_by: ana.id,
    },
  ]);
  if (events.error) throw events.error;
  await seedFormat2();
  const notes = await Promise.all([
    ana.client.from("notes").insert({ kind: "list", title: "Compra de Ana" }),
    luis.client.from("notes").insert({ kind: "text", title: "Idea de Luis" }),
  ]);
  for (const result of notes) if (result.error) throw result.error;
});

let dentist: string;
let exception: string;

/** Spec 035 T3: an exception, comments and images (RF-13, RF-17, RF-29). */
async function seedFormat2() {
  const rows = await admin
    .from("events")
    .select("id, title, calendar_id")
    .in("calendar_id", [anaCal, samCal]);
  if (rows.error) throw rows.error;
  const id = (title: string) => rows.data.find((r) => r.title === title)!.id;
  dentist = id("Dentista");
  const english = id("Inglés");
  const sams = id("Privado de Sam");
  const inserted = await admin
    .from("events")
    .insert({
      calendar_id: anaCal,
      title: "Inglés con examen",
      starts_at: "2026-11-30T17:00:00Z",
      ends_at: "2026-11-30T18:00:00Z",
      series_id: english,
      original_start: "2026-11-30T17:00:00Z",
      created_by: ana.id,
    })
    .select("id")
    .single();
  if (inserted.error) throw inserted.error;
  exception = inserted.data.id;
  const comment = (
    eventId: string,
    author: string,
    body: string,
    at: string,
  ) => ({
    event_id: eventId,
    author_id: author,
    client_id: crypto.randomUUID(),
    body,
    created_at: at,
  });
  const comments = await admin.from("event_comments").insert([
    // 52 on the dentist: the copy keeps the 50 latest.
    ...Array.from({ length: 52 }, (_, i) =>
      comment(
        dentist,
        ana.id,
        `Nota ${i + 1}`,
        new Date(Date.UTC(2026, 10, 1, 10, i)).toISOString(),
      ),
    ),
    comment(exception, ana.id, "Traed el libro", "2026-11-10T10:00:00Z"),
    comment(sams, sam.id, "Solo de Sam", "2026-11-10T10:00:00Z"),
  ]);
  if (comments.error) throw comments.error;
  const image = (eventId: string, status: string) => ({
    event_id: eventId,
    object_id: crypto.randomUUID(),
    uploaded_by: ana.id,
    status,
    bytes: 1000,
    width: 400,
    height: 300,
  });
  const images = await admin
    .from("event_images")
    .insert([
      image(dentist, "ready"),
      image(dentist, "pending"),
      image(exception, "ready"),
      image(sams, "ready"),
    ]);
  if (images.error) throw images.error;
  const edited = await admin
    .from("event_comments")
    .update({ body: "Nota 52 (cambiada)" })
    .eq("event_id", dentist)
    .eq("body", "Nota 52");
  if (edited.error) throw edited.error;
}

afterAll(async () => {
  for (const user of [ana, luis, sam]) if (user) await deleteTestUser(user.id);
  await deleteTestMail();
});

describe("readSnapshot (spec 034 T4)", () => {
  it("reads Ana's copy for the fixed range, through RLS", async () => {
    const snapshot = await readSnapshot(ana.client, ana.id, NOW);
    expect(snapshot).toMatchObject({
      format: 2,
      userId: ana.id,
      today: "2026-11-17",
      range: { from: "2026-10-17", to: "2027-02-17" },
      profile: { displayName: "Ana", timeZone: expect.any(String) },
    });
    expect(snapshot.calendars.map((c) => [c.id, c.role]).sort()).toEqual(
      [
        [anaCal, "owner"],
        [luisCal, "editor"],
      ].sort(),
    );
    expect(snapshot.events.map((e) => e.title)).toEqual([
      "Dentista",
      "Inglés",
      "Inglés con examen",
      "Cena de Luis",
      "Inglés",
    ]);
    expect(snapshot.notes.map((n) => n.title)).toEqual(["Compra de Ana"]);
  });

  it("keeps the detail: description, author and the series' rule", async () => {
    const { events } = await readSnapshot(ana.client, ana.id, NOW);
    expect(events.find((e) => e.title === "Dentista")).toMatchObject({
      description: "Llevar la tarjeta",
      createdBy: ana.id,
      createdByName: "Ana",
      seriesSummary: null,
    });
    expect(events.find((e) => e.title === "Cena de Luis")).toMatchObject({
      createdByName: "Luis",
    });
    const english = events.filter((e) => e.title === "Inglés");
    expect(english[1]).toMatchObject({
      description: "Aula 3",
      seriesSummary: expect.stringMatching(/semana/i),
    });
    expect(english[1]?.id).toMatch(/_\d{8}T\d{6}Z$/);
  });

  it("holds no e-mails, busy blocks or account e-mails (RF-66)", async () => {
    const text = JSON.stringify(await readSnapshot(ana.client, ana.id, NOW));
    for (const user of [ana, luis, sam]) expect(text).not.toContain(user.email);
    expect(text).not.toMatch(/"(busy|accountEmail)"\s*:/);
  });
});

describe("readSnapshot of format 2 (spec 035 T3)", () => {
  it("keeps the series rows with the totals of the whole series (RF-13, D3)", async () => {
    const { series, exceptions } = await readSnapshot(ana.client, ana.id, NOW);
    expect(series).toHaveLength(1);
    expect(series[0]).toMatchObject({
      title: "Inglés",
      calendarId: anaCal,
      recurrence: "FREQ=WEEKLY;BYDAY=MO;COUNT=3",
      recurrenceTz: "Europe/Madrid",
      exdates: [],
      totals: {
        exceptions: 1,
        images: 1,
        comments: 1,
        latest: expect.any(String),
      },
    });
    expect(exceptions).toEqual([
      {
        id: exception,
        seriesId: series[0]!.id,
        originalStart: expect.stringMatching(/^2026-11-30T17:00:00/),
      },
    ]);
  });

  it("keeps the 50 latest comments of each event, with author and edit (RF-17)", async () => {
    const { comments } = await readSnapshot(ana.client, ana.id, NOW);
    const ofDentist = comments.filter((c) => c.eventId === dentist);
    expect(ofDentist).toHaveLength(50);
    expect(ofDentist[0]!.body).toBe("Nota 3");
    expect(ofDentist.at(-1)).toMatchObject({
      body: "Nota 52 (cambiada)",
      authorId: ana.id,
      authorName: "Ana",
      editedAt: expect.any(String),
    });
    expect(ofDentist[0]!.editedAt).toBeNull();
    expect(comments.filter((c) => c.eventId === exception)).toHaveLength(1);
    expect(comments.map((c) => c.body)).not.toContain("Solo de Sam");
  });

  it("keeps the ready images of the range, never pending ones (RF-29)", async () => {
    const { images } = await readSnapshot(ana.client, ana.id, NOW);
    expect(images.map((i) => i.eventId).sort()).toEqual(
      [dentist, exception].sort(),
    );
    expect(images[0]).toMatchObject({
      objectId: expect.any(String),
      uploadedBy: ana.id,
      width: 400,
      height: 300,
    });
  });
});
