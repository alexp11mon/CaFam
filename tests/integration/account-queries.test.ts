import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getNotices, getOrphanCalendars } from "@/lib/account/queries";
import {
  admin,
  createTestUser,
  deleteTestMail,
  deleteTestUser,
  type TestUser,
} from "./helpers";

// Spec 006, T19: a member reads their notices and the calendars without owner
// they belong to, through RLS (RF-22, RF-23, RF-26).
let ana: TestUser; // deletes the account
let bea: TestUser; // member of Ana's calendar
let cy: TestUser; // stranger
let calendarId: string;

beforeAll(async () => {
  [ana, bea, cy] = await Promise.all([
    createTestUser({ display_name: "Ana" }),
    createTestUser({ display_name: "Bea" }),
    createTestUser({ display_name: "Cy" }),
  ]);
  const { data: cal } = await admin
    .from("calendars")
    .insert({ owner_id: ana.id, name: "Familia", color: "#A0C4FF" })
    .select("id")
    .single();
  calendarId = cal!.id;
  const { error: memberError } = await admin
    .from("calendar_members")
    .insert({ calendar_id: calendarId, user_id: bea.id, role: "editor" });
  expect(memberError).toBeNull();
  const { error } = await ana.client.rpc("delete_own_account");
  expect(error).toBeNull();
});

afterAll(async () => {
  await deleteTestMail();
  await admin.from("calendars").delete().eq("id", calendarId);
  await Promise.all(
    [bea, cy].filter(Boolean).map((user) => deleteTestUser(user.id)),
  );
});

describe("account queries (RF-22, RF-23, RF-26)", () => {
  it("a member reads the notice that names the person and the calendar (RF-23)", async () => {
    const notices = await getNotices(bea.client);

    expect(notices).toEqual([
      expect.objectContaining({
        kind: "orphaned",
        personName: "Ana",
        calendarName: "Familia",
      }),
    ]);
  });

  it("a member reads the calendar without owner with its date and no decision yet (RF-26)", async () => {
    const calendars = await getOrphanCalendars(bea.client, bea.id);

    expect(calendars).toEqual([
      expect.objectContaining({
        id: calendarId,
        name: "Familia",
        color: "#A0C4FF",
        decision: null,
      }),
    ]);
    expect(Date.parse(calendars[0].orphanedAt)).not.toBeNaN();
  });

  it("shows the decision once it is taken", async () => {
    const { error } = await bea.client.rpc("decide_orphan_calendar", {
      p_calendar_id: calendarId,
      p_keep: true,
    });
    expect(error).toBeNull();

    const calendars = await getOrphanCalendars(bea.client, bea.id);
    expect(calendars[0].decision).toBe(true);
  });

  it("a stranger sees neither the notice nor the calendar (RF-22)", async () => {
    await expect(getNotices(cy.client)).resolves.toEqual([]);
    await expect(getOrphanCalendars(cy.client, cy.id)).resolves.toEqual([]);
  });
});
