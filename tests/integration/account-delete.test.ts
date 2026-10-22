import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  admin,
  anonClient,
  createTestUser,
  deleteTestUser,
  type TestUser,
} from "./helpers";

// Spec 006, T4: deleting an account keeps the shared calendars for their other
// members (plan D1, D2; RF-18 to RF-21, RF-23, RF-20).
let ana: TestUser; // the one who deletes the account
let bea: TestUser; // editor of Ana's shared calendar
let cy: TestUser; // viewer of Ana's shared calendar
let dan: TestUser; // owner of a calendar where Ana is a viewer

let soleCalendarId: string;
let sharedCalendarId: string;
let danCalendarId: string;
let anaEventId: string;
let beaEventId: string;

beforeAll(async () => {
  [ana, bea, cy, dan] = await Promise.all([
    createTestUser({ display_name: "Ana" }),
    createTestUser({ display_name: "Bea" }),
    createTestUser({ display_name: "Cy" }),
    createTestUser({ display_name: "Dan" }),
  ]);

  const { data: sole } = await admin
    .from("calendars")
    .insert({ owner_id: ana.id, name: "Solo de Ana" })
    .select("id")
    .single();
  soleCalendarId = sole!.id;

  const { data: shared } = await admin
    .from("calendars")
    .insert({ owner_id: ana.id, name: "Familia" })
    .select("id")
    .single();
  sharedCalendarId = shared!.id;
  await admin.from("calendar_members").insert([
    { calendar_id: sharedCalendarId, user_id: bea.id, role: "editor" },
    { calendar_id: sharedCalendarId, user_id: cy.id, role: "viewer" },
  ]);

  const { data: anaEvent } = await admin
    .from("events")
    .insert({
      calendar_id: sharedCalendarId,
      title: "Cena de Ana",
      starts_at: "2026-11-01T18:00:00Z",
      ends_at: "2026-11-01T19:00:00Z",
      created_by: ana.id,
    })
    .select("id")
    .single();
  anaEventId = anaEvent!.id;

  const { data: beaEvent } = await admin
    .from("events")
    .insert({
      calendar_id: sharedCalendarId,
      title: "Partido de Bea",
      starts_at: "2026-11-02T10:00:00Z",
      ends_at: "2026-11-02T11:00:00Z",
      created_by: bea.id,
    })
    .select("id")
    .single();
  beaEventId = beaEvent!.id;

  const { data: danCal } = await admin
    .from("calendars")
    .insert({ owner_id: dan.id, name: "Del Dan" })
    .select("id")
    .single();
  danCalendarId = danCal!.id;
  await admin
    .from("calendar_members")
    .insert({ calendar_id: danCalendarId, user_id: ana.id, role: "viewer" });

  const { error } = await ana.client.rpc("delete_own_account");
  expect(error).toBeNull();
});

afterAll(async () => {
  // Ana's account is gone already; delete the calendars left behind and the others.
  await admin
    .from("calendars")
    .delete()
    .in("id", [sharedCalendarId, danCalendarId]);
  await Promise.all(
    [bea, cy, dan].filter(Boolean).map((user) => deleteTestUser(user.id)),
  );
});

describe("delete_own_account (RF-18, RF-19, RF-20)", () => {
  it("removes the calendars that had no other member, with their events (RF-18)", async () => {
    const { data } = await admin
      .from("calendars")
      .select("id")
      .eq("id", soleCalendarId);
    expect(data).toEqual([]);
  });

  it("removes the account and its profile (RF-19)", async () => {
    const { data, error } = await admin
      .from("profiles")
      .select("id")
      .eq("id", ana.id);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("removes Ana from the calendars where she was a member (RF-20)", async () => {
    const { data } = await admin
      .from("calendar_members")
      .select("calendar_id")
      .eq("user_id", ana.id);
    expect(data).toEqual([]);

    const { data: danMembers } = await admin
      .from("calendar_members")
      .select("user_id, role")
      .eq("calendar_id", danCalendarId);
    expect(danMembers).toContainEqual({ user_id: dan.id, role: "owner" });
    expect(danMembers?.some((m) => m.user_id === ana.id)).toBe(false);
  });

  it("keeps a shared calendar without owner for its other members (RF-21)", async () => {
    const { data, error } = await admin
      .from("calendars")
      .select("name, owner_id, orphaned_at")
      .eq("id", sharedCalendarId)
      .single();
    expect(error).toBeNull();
    expect(data?.owner_id).toBeNull();
    expect(data?.orphaned_at).not.toBeNull();
    expect(data?.name).toBe("Familia");
  });

  it("keeps the events of that calendar, with Ana's authorship cleared (RF-20)", async () => {
    const { data } = await admin
      .from("events")
      .select("id, created_by")
      .eq("calendar_id", sharedCalendarId);
    expect(data).toHaveLength(2);
    expect(data).toContainEqual({ id: anaEventId, created_by: null });
    expect(data).toContainEqual({ id: beaEventId, created_by: bea.id });
  });

  it("keeps the other members on the orphaned calendar", async () => {
    const { data } = await admin
      .from("calendar_members")
      .select("user_id, role")
      .eq("calendar_id", sharedCalendarId);
    expect(data).toEqual(
      expect.arrayContaining([
        { user_id: bea.id, role: "editor" },
        { user_id: cy.id, role: "viewer" },
      ]),
    );
    expect(data).toHaveLength(2);
  });

  it("notifies each remaining member in the app, naming Ana and the calendar (RF-23)", async () => {
    for (const member of [bea, cy]) {
      const { data } = await admin
        .from("account_notices")
        .select("kind, person_name, calendar_name")
        .eq("user_id", member.id);
      expect(data).toEqual([
        { kind: "orphaned", person_name: "Ana", calendar_name: "Familia" },
      ]);
    }
  });

  it("queues an email for each remaining member (RF-23)", async () => {
    const { data } = await admin
      .from("email_outbox")
      .select("to_email, subject")
      .in("to_email", [bea.email, cy.email]);
    expect(data?.map((row) => row.to_email).sort()).toEqual(
      [bea.email, cy.email].sort(),
    );
  });

  it("does not let Ana's old session act any more", async () => {
    const { data } = await admin.auth.admin.getUserById(ana.id);
    expect(data.user).toBeNull();
  });

  it("refuses without a session (42501)", async () => {
    const { error } = await anonClient().rpc("delete_own_account");
    expect(error?.code).toBe("42501");
  });
});
