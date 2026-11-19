import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  admin,
  createTestUser,
  deleteTestUser,
  getOwnCalendarId,
  type TestUser,
} from "./helpers";
import { exportIcs } from "@/lib/ics/export-queries";

// Spec 043, T2: exporting with the session (RF-1, RF-2, RF-5, RNF-2).
const NOW = new Date("2026-11-19T10:00:00Z");
let owner: TestUser;
let viewer: TestUser;
let stranger: TestUser;
let mainId: string;
let workId: string;
let bigId: string;

const unfold = (text: string) => text.replace(/\r\n /g, "").split("\r\n");

beforeAll(async () => {
  [owner, viewer, stranger] = await Promise.all([
    createTestUser({ display_name: "Dueña" }),
    createTestUser({ display_name: "Lector" }),
    createTestUser({ display_name: "Ajeno" }),
  ]);
  mainId = await getOwnCalendarId(owner.id);
  const { data, error } = await admin
    .from("calendars")
    .insert([
      { owner_id: owner.id, name: "Trabajo" },
      { owner_id: owner.id, name: "Grande" },
    ])
    .select("id, name");
  if (error) throw error;
  workId = data.find((row) => row.name === "Trabajo")!.id;
  bigId = data.find((row) => row.name === "Grande")!.id;
  await admin
    .from("calendar_members")
    .insert({ calendar_id: mainId, user_id: viewer.id, role: "viewer" });
  const { error: eventsError } = await admin.from("events").insert([
    {
      calendar_id: mainId,
      created_by: owner.id,
      title: "Cena",
      starts_at: "2026-11-20T19:00:00Z",
      ends_at: "2026-11-20T21:00:00Z",
      color: "#FFADAD",
    },
    {
      calendar_id: workId,
      created_by: owner.id,
      title: "Reunión",
      starts_at: "2026-11-21T08:00:00Z",
      ends_at: "2026-11-21T09:00:00Z",
    },
  ]);
  if (eventsError) throw eventsError;
  // The big calendar is hidden in the filters of the owner.
  await admin
    .from("calendar_preferences")
    .insert({ user_id: owner.id, calendar_id: bigId, visible: false });
  const rows = Array.from({ length: 2000 }, (_, i) => ({
    calendar_id: bigId,
    created_by: owner.id,
    title: `Evento ${i}`,
    description: "Una descripción de prueba con algo de texto.",
    starts_at: new Date(Date.UTC(2026, 0, 1) + i * 3_600_000).toISOString(),
    ends_at: new Date(
      Date.UTC(2026, 0, 1) + i * 3_600_000 + 1_800_000,
    ).toISOString(),
  }));
  for (let i = 0; i < rows.length; i += 500) {
    const { error: bigError } = await admin
      .from("events")
      .insert(rows.slice(i, i + 500));
    if (bigError) throw bigError;
  }
}, 60_000);

afterAll(async () => {
  await Promise.all(
    [owner, viewer, stranger]
      .filter(Boolean)
      .map((user) => deleteTestUser(user.id)),
  );
});

describe("exportIcs", () => {
  it("exports a calendar to a viewer, without colours", async () => {
    const result = await exportIcs(
      viewer.client,
      viewer.id,
      { calendarId: mainId },
      NOW,
    );
    expect(result?.filename).toMatch(/\.ics$/);
    const lines = unfold(result!.text);
    expect(lines).toContain("SUMMARY:Cena");
    expect(lines).toContain("DTSTART:20261120T190000Z");
    expect(lines.some((line) => line.startsWith("COLOR"))).toBe(false);
    expect(lines.some((line) => line.startsWith("CATEGORIES"))).toBe(false);
  });

  it("gives nothing for someone else's calendar or a bad id", async () => {
    expect(
      await exportIcs(
        stranger.client,
        stranger.id,
        { calendarId: mainId },
        NOW,
      ),
    ).toBeNull();
    expect(
      await exportIcs(owner.client, owner.id, { calendarId: "nope" }, NOW),
    ).toBeNull();
  });

  it("exports the visible calendars with their name as category", async () => {
    const result = await exportIcs(
      owner.client,
      owner.id,
      { visible: true },
      NOW,
    );
    expect(result?.filename).toBe("cafam.ics");
    const lines = unfold(result!.text);
    expect(lines).toContain("X-WR-CALNAME:CaFam");
    expect(lines).toContain("CATEGORIES:Trabajo");
    expect(lines).toContain("SUMMARY:Reunión");
    expect(lines.some((line) => line.startsWith("SUMMARY:Evento "))).toBe(
      false,
    );
  });

  it("exports 2,000 events in less than a second", async () => {
    const started = performance.now();
    const result = await exportIcs(
      owner.client,
      owner.id,
      { calendarId: bigId },
      NOW,
    );
    const elapsed = performance.now() - started;
    expect(
      unfold(result!.text).filter((line) => line === "BEGIN:VEVENT"),
    ).toHaveLength(2000);
    expect(elapsed).toBeLessThan(1000);
  });
});
