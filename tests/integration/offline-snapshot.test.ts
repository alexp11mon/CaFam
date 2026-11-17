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
  const notes = await Promise.all([
    ana.client.from("notes").insert({ kind: "list", title: "Compra de Ana" }),
    luis.client.from("notes").insert({ kind: "text", title: "Idea de Luis" }),
  ]);
  for (const result of notes) if (result.error) throw result.error;
});

afterAll(async () => {
  for (const user of [ana, luis, sam]) if (user) await deleteTestUser(user.id);
  await deleteTestMail();
});

describe("readSnapshot (spec 034 T4)", () => {
  it("reads Ana's copy for the fixed range, through RLS", async () => {
    const snapshot = await readSnapshot(ana.client, ana.id, NOW);
    expect(snapshot).toMatchObject({
      format: 1,
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
      "Inglés",
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

  it("holds no e-mails, images, comments or busy blocks (RF-66)", async () => {
    const text = JSON.stringify(await readSnapshot(ana.client, ana.id, NOW));
    for (const user of [ana, luis, sam]) expect(text).not.toContain(user.email);
    expect(text).not.toMatch(/"(images|comments|busy|accountEmail)"\s*:\s*\[/);
  });
});
