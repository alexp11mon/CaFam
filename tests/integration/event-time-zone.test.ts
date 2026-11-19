import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  admin,
  anonClient,
  createTestUser,
  deleteTestUser,
  getOwnCalendarId,
  type TestUser,
} from "./helpers";

// Spec 045, T1: start_tz and end_tz, their validation and the functions that
// copy event columns by name (RF-6, RF-7, RNF-2).
let owner: TestUser;
let heir: TestUser;
let calendar: string;
const SECRET = process.env.CRON_SECRET ?? "";

const TIMED = {
  title: "Vuelo",
  starts_at: "2026-12-01T09:00:00Z",
  ends_at: "2026-12-01T17:00:00Z",
};

beforeAll(async () => {
  [owner, heir] = await Promise.all([
    createTestUser({ display_name: "Olga" }),
    createTestUser({ display_name: "Hugo" }),
  ]);
  calendar = await getOwnCalendarId(owner.id);
});

afterAll(async () => {
  await Promise.all([owner, heir].map((user) => deleteTestUser(user.id)));
});

async function insert(extra: object) {
  return owner.client
    .from("events")
    .insert({ calendar_id: calendar, created_by: owner.id, ...TIMED, ...extra })
    .select("id, start_tz, end_tz")
    .single();
}

describe("events.start_tz and end_tz", () => {
  it("are null by default: the events of before keep working (RF-6)", async () => {
    const { data, error } = await insert({});
    expect(error).toBeNull();
    expect(data).toMatchObject({ start_tz: null, end_tz: null });
  });

  it("keep a valid zone, end_tz following start_tz", async () => {
    const { data, error } = await insert({ start_tz: "America/New_York" });
    expect(error).toBeNull();
    expect(data).toMatchObject({
      start_tz: "America/New_York",
      end_tz: "America/New_York",
    });
    const flight = await insert({
      start_tz: "Europe/Madrid",
      end_tz: "Asia/Kolkata",
    });
    expect(flight.data).toMatchObject({
      start_tz: "Europe/Madrid",
      end_tz: "Asia/Kolkata",
    });
  });

  it("reject an invalid zone (RNF-2)", async () => {
    const { error } = await insert({ start_tz: "Mars/Olympus" });
    expect(error?.code).toBe("22023");
    const end = await insert({ start_tz: "Europe/Madrid", end_tz: "Nope" });
    expect(end.error?.code).toBe("22023");
  });

  it("are dropped on all-day events (RF-7)", async () => {
    const { data } = await insert({
      start_tz: "America/New_York",
      all_day: true,
      starts_at: "2026-12-01T00:00:00Z",
      ends_at: "2026-12-02T00:00:00Z",
    });
    expect(data).toMatchObject({ start_tz: null, end_tz: null });

    const timed = await insert({ start_tz: "America/New_York" });
    const { data: changed } = await owner.client
      .from("events")
      .update({ all_day: true })
      .eq("id", timed.data!.id)
      .select("start_tz, end_tz")
      .single();
    expect(changed).toMatchObject({ start_tz: null, end_tz: null });
  });

  it("survive the copy of an orphaned calendar", async () => {
    await insert({ title: "Copiado", start_tz: "Asia/Kolkata" });
    const { data: copy, error } = await admin.rpc("copy_calendar_for_owner", {
      p_calendar_id: calendar,
      p_user_id: heir.id,
    });
    expect(error).toBeNull();
    const { data } = await admin
      .from("events")
      .select("start_tz")
      .eq("calendar_id", copy!)
      .eq("title", "Copiado")
      .single();
    expect(data?.start_tz).toBe("Asia/Kolkata");
  });

  it("survive deleting and restoring (undo of spec 017)", async () => {
    const { data: row } = await insert({ start_tz: "America/New_York" });
    const { data: trash, error } = await owner.client.rpc("snapshot_event", {
      p_event_id: row!.id,
    });
    expect(error).toBeNull();
    await owner.client.from("events").delete().eq("id", row!.id);
    const restored = await owner.client.rpc("restore_event", {
      p_trash_id: trash!,
    });
    expect(restored.error).toBeNull();
    const { data } = await admin
      .from("events")
      .select("start_tz")
      .eq("id", row!.id)
      .single();
    expect(data?.start_tz).toBe("America/New_York");
  });

  it("are stored by the sync from Google or iCloud (RF-9)", async () => {
    const { data: synced } = await admin
      .from("calendars")
      .insert({ owner_id: owner.id, name: "Google" })
      .select("id")
      .single();
    const { data: conn } = await admin
      .from("calendar_connections")
      .insert({
        owner_id: owner.id,
        provider: "google",
        account_subject: `sub-${randomUUID()}`,
        account_email: "owner@gmail.test",
      })
      .select("id")
      .single();
    await admin.from("synced_calendars").insert({
      calendar_id: synced!.id,
      connection_id: conn!.id,
      provider: "google",
      external_id: `cal-${randomUUID()}`,
    });
    const event = {
      external_id: "ev-1",
      ...TIMED,
      all_day: false,
      start_tz: "America/New_York",
      end_tz: "Europe/Madrid",
    };
    const { error } = await anonClient().rpc("sync_apply_events", {
      p_secret: SECRET,
      p_calendar_id: synced!.id,
      p_events: [event],
    });
    expect(error).toBeNull();
    const read = () =>
      admin
        .from("events")
        .select("start_tz, end_tz")
        .eq("calendar_id", synced!.id)
        .single();
    expect((await read()).data).toMatchObject({
      start_tz: "America/New_York",
      end_tz: "Europe/Madrid",
    });

    await anonClient().rpc("sync_apply_events", {
      p_secret: SECRET,
      p_calendar_id: synced!.id,
      p_events: [{ ...event, start_tz: "Asia/Kolkata", end_tz: null }],
    });
    expect((await read()).data).toMatchObject({
      start_tz: "Asia/Kolkata",
      end_tz: "Asia/Kolkata",
    });
  });

  it("are kept by an .ics import (RF-10)", async () => {
    const { data, error } = await owner.client.rpc("import_into_calendar", {
      p_calendar_id: calendar,
      p_events: [
        { ...TIMED, external_id: "uid-tz", start_tz: "America/Los_Angeles" },
      ],
    });
    expect(error).toBeNull();
    expect(data).toMatchObject({ added: 1 });
    const { data: row } = await admin
      .from("events")
      .select("start_tz")
      .eq("calendar_id", calendar)
      .eq("external_id", "uid-tz")
      .single();
    expect(row?.start_tz).toBe("America/Los_Angeles");
  });
});
