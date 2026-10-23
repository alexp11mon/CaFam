import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  admin,
  createTestUser,
  deleteTestMail,
  deleteTestUser,
  type TestUser,
} from "./helpers";

// Spec 006, T5: members of a calendar without owner choose to keep it or to
// leave it (plan "Contratos", D2; RF-24, RF-25).
let ana: TestUser; // the owner who deletes the account
let bea: TestUser; // member who decides
let cy: TestUser; // member who decides later
let dan: TestUser; // not a member of the orphaned calendar
let orphanCalendarId: string;
let danCalendarId: string;

function decide(user: TestUser, calendarId: string, keep: boolean) {
  return user.client.rpc("decide_orphan_calendar", {
    p_calendar_id: calendarId,
    p_keep: keep,
  });
}

beforeAll(async () => {
  [ana, bea, cy, dan] = await Promise.all([
    createTestUser({ display_name: "Ana" }),
    createTestUser({ display_name: "Bea" }),
    createTestUser({ display_name: "Cy" }),
    createTestUser({ display_name: "Dan" }),
  ]);

  const { data: orphan } = await admin
    .from("calendars")
    .insert({ owner_id: ana.id, name: "Familia" })
    .select("id")
    .single();
  orphanCalendarId = orphan!.id;
  await admin.from("calendar_members").insert([
    { calendar_id: orphanCalendarId, user_id: bea.id, role: "editor" },
    { calendar_id: orphanCalendarId, user_id: cy.id, role: "viewer" },
  ]);
  const { error } = await ana.client.rpc("delete_own_account");
  expect(error).toBeNull();

  const { data: danCal } = await admin
    .from("calendars")
    .insert({ owner_id: dan.id, name: "De Dan" })
    .select("id")
    .single();
  danCalendarId = danCal!.id;
  await admin
    .from("calendar_members")
    .insert({ calendar_id: danCalendarId, user_id: cy.id, role: "viewer" });
});

afterAll(async () => {
  await deleteTestMail();
  await admin
    .from("calendars")
    .delete()
    .in("id", [orphanCalendarId, danCalendarId]);
  await Promise.all(
    [bea, cy, dan].filter(Boolean).map((user) => deleteTestUser(user.id)),
  );
});

describe("decide_orphan_calendar (RF-24, RF-25)", () => {
  it("a member can choose to keep the calendar (RF-24)", async () => {
    const { error } = await decide(bea, orphanCalendarId, true);
    expect(error).toBeNull();

    const { data } = await admin
      .from("calendar_orphan_decisions")
      .select("keep")
      .eq("calendar_id", orphanCalendarId)
      .eq("user_id", bea.id);
    expect(data).toEqual([{ keep: true }]);

    const { data: member } = await admin
      .from("calendar_members")
      .select("user_id")
      .eq("calendar_id", orphanCalendarId)
      .eq("user_id", bea.id);
    expect(member).toHaveLength(1);
  });

  it("deciding again updates the same decision, it does not duplicate it", async () => {
    const { error } = await decide(bea, orphanCalendarId, true);
    expect(error).toBeNull();

    const { data } = await admin
      .from("calendar_orphan_decisions")
      .select("keep")
      .eq("calendar_id", orphanCalendarId)
      .eq("user_id", bea.id);
    expect(data).toHaveLength(1);
  });

  it("a member can choose to leave: the calendar leaves their list (RF-25)", async () => {
    const { error } = await decide(bea, orphanCalendarId, false);
    expect(error).toBeNull();

    const { data: member } = await admin
      .from("calendar_members")
      .select("user_id")
      .eq("calendar_id", orphanCalendarId)
      .eq("user_id", bea.id);
    expect(member).toEqual([]);

    const { data: decision } = await admin
      .from("calendar_orphan_decisions")
      .select("keep")
      .eq("calendar_id", orphanCalendarId)
      .eq("user_id", bea.id);
    expect(decision).toEqual([{ keep: false }]);
  });

  it("someone who already left cannot decide again (CF404)", async () => {
    const { error } = await decide(bea, orphanCalendarId, true);
    expect(error?.code).toBe("CF404");
  });

  it("a user who is not a member cannot decide (CF404)", async () => {
    const { error } = await decide(dan, orphanCalendarId, true);
    expect(error?.code).toBe("CF404");
  });

  it("a calendar that still has an owner cannot be decided (CF404)", async () => {
    const { error } = await decide(cy, danCalendarId, true);
    expect(error?.code).toBe("CF404");
  });

  it("the other member's decision is independent (RF-24)", async () => {
    const { error } = await decide(cy, orphanCalendarId, true);
    expect(error).toBeNull();

    const { data } = await admin
      .from("calendar_orphan_decisions")
      .select("user_id, keep")
      .eq("calendar_id", orphanCalendarId);
    expect(data).toEqual(
      expect.arrayContaining([{ user_id: cy.id, keep: true }]),
    );
  });
});
