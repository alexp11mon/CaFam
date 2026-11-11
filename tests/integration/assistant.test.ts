import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  admin,
  anonClient,
  createTestUser,
  deleteTestMail,
  deleteTestUser,
  getOwnCalendarId,
  type TestUser,
} from "./helpers";

// Spec 015, T2: assistant schema (plan "Modelo de datos", D6, D7, D9; RF-6,
// RF-15, RF-19, RF-20, RF-21, RF-23, RF-24, RF-27, RF-29).
let asker: TestUser;
let luis: TestUser; // consents and shares a calendar with the asker
let ana: TestUser; // shares a calendar, no consent
let stranger: TestUser; // consents, shares nothing
let askerCal: string;
let luisCal: string;
let anaCal: string;
let strangerCal: string;

const FROM = "2026-11-09T00:00:00Z";
const TO = "2026-11-16T00:00:00Z";

beforeAll(async () => {
  [asker, luis, ana, stranger] = await Promise.all([
    createTestUser({ display_name: "Marta" }),
    createTestUser({ display_name: "Luis Pérez" }),
    createTestUser({ display_name: "Ana" }),
    createTestUser({ display_name: "Sam" }),
  ]);
  [askerCal, luisCal, anaCal, strangerCal] = await Promise.all(
    [asker, luis, ana, stranger].map((u) => getOwnCalendarId(u.id)),
  );
  const { error } = await admin.from("calendar_members").insert([
    { calendar_id: askerCal, user_id: luis.id, role: "viewer" },
    { calendar_id: askerCal, user_id: ana.id, role: "editor" },
  ]);
  if (error) throw error;
  for (const user of [luis, stranger]) {
    const { error: e } = await admin
      .from("profiles")
      .update({ share_availability: true })
      .eq("id", user.id);
    if (e) throw e;
  }
  const { error: eventsError } = await admin.from("events").insert([
    // Luis's private calendar: a single event, a series and an exception.
    {
      calendar_id: luisCal,
      title: "Médico privado",
      location: "Clínica",
      description: "Secreto",
      starts_at: "2026-11-10T16:00:00Z",
      ends_at: "2026-11-10T17:00:00Z",
    },
    {
      calendar_id: luisCal,
      title: "Gimnasio",
      starts_at: "2026-11-02T18:00:00Z",
      ends_at: "2026-11-02T19:00:00Z",
      recurrence: "FREQ=WEEKLY",
      recurrence_tz: "Europe/Madrid",
    },
    {
      calendar_id: anaCal,
      title: "Privado de Ana",
      starts_at: "2026-11-10T16:00:00Z",
      ends_at: "2026-11-10T17:00:00Z",
    },
    {
      calendar_id: strangerCal,
      title: "Privado de Sam",
      starts_at: "2026-11-10T16:00:00Z",
      ends_at: "2026-11-10T17:00:00Z",
    },
    {
      calendar_id: luisCal,
      title: "Fuera del periodo",
      starts_at: "2026-12-10T16:00:00Z",
      ends_at: "2026-12-10T17:00:00Z",
    },
  ]);
  if (eventsError) throw eventsError;
});

afterAll(async () => {
  await Promise.all(
    [asker, luis, ana, stranger].map((user) => deleteTestUser(user.id)),
  );
  await deleteTestMail();
});

describe("profiles.share_availability (RF-20, RF-21)", () => {
  it("is off by default and only its owner changes it", async () => {
    const { data } = await asker.client
      .from("profiles")
      .select("share_availability")
      .eq("id", asker.id)
      .single();
    expect(data?.share_availability).toBe(false);

    const { data: changed } = await asker.client
      .from("profiles")
      .update({ share_availability: true })
      .eq("id", asker.id)
      .select("share_availability");
    expect(changed).toEqual([{ share_availability: true }]);

    const { data: foreign } = await asker.client
      .from("profiles")
      .update({ share_availability: false })
      .eq("id", luis.id)
      .select("id");
    expect(foreign).toEqual([]);

    await asker.client
      .from("profiles")
      .update({ share_availability: false })
      .eq("id", asker.id);
  });
});

describe("assistant_questions (RF-27, D9)", () => {
  it("each user inserts and reads only their own rows", async () => {
    const { error } = await asker.client
      .from("assistant_questions")
      .insert({ user_id: asker.id });
    expect(error).toBeNull();

    const { data: mine } = await asker.client
      .from("assistant_questions")
      .select("user_id");
    expect(mine?.length).toBeGreaterThanOrEqual(1);
    expect(mine?.every((row) => row.user_id === asker.id)).toBe(true);

    const { data: theirs } = await luis.client
      .from("assistant_questions")
      .select("id");
    expect(theirs).toEqual([]);

    const { error: forged } = await luis.client
      .from("assistant_questions")
      .insert({ user_id: asker.id });
    expect(forged?.code).toBe("42501");
  });

  it("does not let anyone choose asked_at, change or delete rows", async () => {
    const { error } = await asker.client
      .from("assistant_questions")
      .insert({ user_id: asker.id, asked_at: "2020-01-01T00:00:00Z" });
    expect(error?.code).toBe("42501");

    const { data: deleted } = await asker.client
      .from("assistant_questions")
      .delete()
      .eq("user_id", asker.id)
      .select("id");
    expect(deleted ?? []).toEqual([]);

    const { error: updateError } = await asker.client
      .from("assistant_questions")
      .update({ asked_at: "2020-01-01T00:00:00Z" })
      .eq("user_id", asker.id);
    expect(updateError?.code).toBe("42501");
  });

  it("anon sees nothing", async () => {
    const { data } = await anonClient()
      .from("assistant_questions")
      .select("id");
    expect(data ?? []).toEqual([]);
  });

  it("a cron job purges the old rows", async () => {
    const { data, error } = await admin.rpc("assistant_scheduled_jobs");
    expect(error).toBeNull();
    expect(data?.map((job) => job.jobname)).toEqual([
      "assistant-purge-questions",
    ]);
  });
});

describe("assistant_people (RF-15)", () => {
  it("lists the caller and whoever shares a calendar, with consent and no email", async () => {
    const { data, error } = await asker.client.rpc("assistant_people");
    expect(error).toBeNull();
    const byId = new Map((data ?? []).map((row) => [row.user_id, row]));
    expect(byId.get(asker.id)?.display_name).toBe("Marta");
    expect(byId.get(luis.id)).toEqual({
      user_id: luis.id,
      display_name: "Luis Pérez",
      shares_availability: true,
    });
    expect(byId.get(ana.id)?.shares_availability).toBe(false);
    expect(byId.has(stranger.id)).toBe(false);
    expect(JSON.stringify(data)).not.toContain("@");
  });

  it("works from the member's side too", async () => {
    const { data } = await luis.client.rpc("assistant_people");
    expect((data ?? []).map((row) => row.user_id).sort()).toEqual(
      [asker.id, ana.id, luis.id].sort(),
    );
  });
});

describe("assistant_busy (RF-19, RF-20, RF-23, RF-24, RF-29)", () => {
  it("returns only times of a consenting person who shares a calendar", async () => {
    const { data, error } = await asker.client.rpc("assistant_busy", {
      p_person_ids: [luis.id, ana.id, stranger.id],
      p_from: FROM,
      p_to: TO,
    });
    expect(error).toBeNull();
    const rows = data ?? [];
    expect(new Set(rows.map((row) => row.person_id))).toEqual(
      new Set([luis.id]),
    );
    // The single event in range and the weekly series; not the December one.
    expect(
      rows.some((row) => row.starts_at.startsWith("2026-11-10T16:00")),
    ).toBe(true);
    expect(rows.some((row) => row.recurrence === "FREQ=WEEKLY")).toBe(true);
    expect(rows.some((row) => row.starts_at.startsWith("2026-12"))).toBe(false);

    const text = JSON.stringify(rows);
    for (const secret of [
      "Médico",
      "Clínica",
      "Secreto",
      "Gimnasio",
      luisCal,
    ]) {
      expect(text).not.toContain(secret);
    }
    expect(Object.keys(rows[0]).sort()).toEqual(
      [
        "all_day",
        "ends_at",
        "exdates",
        "id",
        "original_start",
        "person_id",
        "recurrence",
        "recurrence_tz",
        "series_id",
        "starts_at",
      ].sort(),
    );
  });

  it("returns nothing for whoever does not share a calendar, even with consent", async () => {
    const { data } = await stranger.client.rpc("assistant_busy", {
      p_person_ids: [luis.id],
      p_from: FROM,
      p_to: TO,
    });
    expect(data).toEqual([]);
  });

  it("rejects periods longer than 32 days", async () => {
    const { error } = await asker.client.rpc("assistant_busy", {
      p_person_ids: [luis.id],
      p_from: "2026-11-01T00:00:00Z",
      p_to: "2026-12-04T00:00:00Z",
    });
    expect(error?.code).toBe("22023");
  });

  it("does not expose a third person's calendar where they are only a member (spec 023 RF-2)", async () => {
    // Luis reads Sam's calendar; Sam's events are not Luis's availability.
    const { error: memberError } = await admin
      .from("calendar_members")
      .insert({ calendar_id: strangerCal, user_id: luis.id, role: "editor" });
    if (memberError) throw memberError;
    const { error: eventsError } = await admin.from("events").insert([
      {
        calendar_id: strangerCal,
        title: "De Sam",
        created_by: stranger.id,
        starts_at: "2026-11-12T08:00:00Z",
        ends_at: "2026-11-12T09:00:00Z",
      },
      {
        calendar_id: strangerCal,
        title: "De Luis en el de Sam",
        created_by: luis.id,
        starts_at: "2026-11-13T08:00:00Z",
        ends_at: "2026-11-13T09:00:00Z",
      },
    ]);
    if (eventsError) throw eventsError;

    const { data, error } = await asker.client.rpc("assistant_busy", {
      p_person_ids: [luis.id],
      p_from: FROM,
      p_to: TO,
    });
    await admin
      .from("calendar_members")
      .delete()
      .eq("calendar_id", strangerCal)
      .eq("user_id", luis.id);
    expect(error).toBeNull();
    const starts = (data ?? []).map((row) => row.starts_at.slice(0, 13));
    expect(starts).not.toContain("2026-11-12T08");
    expect(starts).toContain("2026-11-13T08");
    expect(starts).toContain("2026-11-10T16");
  });

  it("is not available to anon", async () => {
    const { error } = await anonClient().rpc("assistant_busy", {
      p_person_ids: [luis.id],
      p_from: FROM,
      p_to: TO,
    });
    expect(error).not.toBeNull();
  });
});
