import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  admin,
  createTestUser,
  deleteTestUser,
  type TestUser,
} from "./helpers";

// Spec 006, T7: when every member has decided, or 15 days have passed, the
// calendar without owner is settled (plan "Contratos", D3; RF-26 to RF-29).
// The scheduled job runs this as postgres; the test runs it with the service role.

interface Case {
  owner: TestUser;
  members: TestUser[];
  calendarName: string;
  calendarId: string;
}

let twoKeepers: Case; // S1
let oneKeeper: Case; // S2
let nobodyLeft: Case; // S3: everyone left
let notDue: Case; // S4: one member undecided, deadline not reached
let deadlineNobody: Case; // S5: deadline passed, member undecided
let deadlineMixed: Case; // S6: deadline passed, one keeps, one undecided

const PAST = new Date(Date.now() - 16 * 24 * 60 * 60_000).toISOString();

async function buildCase(
  calendarName: string,
  members: TestUser[],
  owner: TestUser,
): Promise<Case> {
  const { data: cal } = await admin
    .from("calendars")
    .insert({ owner_id: owner.id, name: calendarName })
    .select("id")
    .single();
  const calendarId = cal!.id;
  await admin.from("calendar_members").insert(
    members.map((member, i) => ({
      calendar_id: calendarId,
      user_id: member.id,
      role: i === 0 ? "editor" : "viewer",
    })),
  );
  await admin.from("events").insert({
    calendar_id: calendarId,
    title: `Evento de ${calendarName}`,
    starts_at: "2026-11-02T10:00:00Z",
    ends_at: "2026-11-02T11:00:00Z",
    created_by: owner.id,
  });
  return { owner, members, calendarName, calendarId };
}

function decide(user: TestUser, calendarId: string, keep: boolean) {
  return user.client.rpc("decide_orphan_calendar", {
    p_calendar_id: calendarId,
    p_keep: keep,
  });
}

beforeAll(async () => {
  const users = await Promise.all(
    Array.from({ length: 14 }, (_, i) =>
      createTestUser({ display_name: `P${i}` }),
    ),
  );
  const [a1, b1, c1, a2, e2, a3, g3, a4, h4, a5, i5, a6, j6, k6] = users;

  // A1/A2/... delete their accounts; the case builder runs before that.
  twoKeepers = await buildCase("Familia S1", [b1, c1], a1);
  oneKeeper = await buildCase("Familia S2", [e2], a2);
  nobodyLeft = await buildCase("Familia S3", [g3], a3);
  notDue = await buildCase("Familia S4", [h4], a4);
  deadlineNobody = await buildCase("Familia S5", [i5], a5);
  deadlineMixed = await buildCase("Familia S6", [j6, k6], a6);

  // Ana-like owners leave; their shared calendars become orphans.
  for (const owner of [a1, a2, a3, a4, a5, a6]) {
    const { error } = await owner.client.rpc("delete_own_account");
    expect(error).toBeNull();
  }

  await decide(b1, twoKeepers.calendarId, true);
  await decide(c1, twoKeepers.calendarId, true);
  await decide(e2, oneKeeper.calendarId, true);
  await decide(g3, nobodyLeft.calendarId, false);
  await decide(j6, deadlineMixed.calendarId, true);
  // H4 stays undecided on a fresh calendar; I5 and K6 stay undecided past the deadline.
  await admin
    .from("calendars")
    .update({ orphaned_at: PAST })
    .in("id", [deadlineNobody.calendarId, deadlineMixed.calendarId]);

  const { error } = await admin.rpc("apply_orphan_decisions");
  expect(error).toBeNull();
});

afterAll(async () => {
  const calendarIds = [
    twoKeepers,
    oneKeeper,
    nobodyLeft,
    notDue,
    deadlineNobody,
    deadlineMixed,
  ].map((c) => c.calendarId);
  await admin.from("calendars").delete().in("id", calendarIds);
  await Promise.all(
    [
      twoKeepers.members,
      oneKeeper.members,
      nobodyLeft.members,
      notDue.members,
      deadlineNobody.members,
      deadlineMixed.members,
    ]
      .flat()
      .map((user) => deleteTestUser(user.id)),
  );
});

describe("apply_orphan_decisions (RF-26 to RF-29)", () => {
  it("two keepers: the original goes and each keeper gets a full copy (RF-28)", async () => {
    const { data: original } = await admin
      .from("calendars")
      .select("id")
      .eq("id", twoKeepers.calendarId);
    expect(original).toEqual([]);

    for (const keeper of twoKeepers.members) {
      const { data } = await admin
        .from("calendars")
        .select("owner_id")
        .eq("name", "Familia S1")
        .eq("owner_id", keeper.id);
      expect(data).toHaveLength(1);
    }
  });

  it("two keepers: each keeper gets a kept_copy notice (RF-28)", async () => {
    for (const keeper of twoKeepers.members) {
      const { data } = await admin
        .from("account_notices")
        .select("kind")
        .eq("user_id", keeper.id)
        .eq("kind", "kept_copy");
      expect(data).toHaveLength(1);
    }
  });

  it("one keeper: the calendar keeps its id and that member becomes owner, without copy (RF-27)", async () => {
    const { data } = await admin
      .from("calendars")
      .select("owner_id, orphaned_at")
      .eq("id", oneKeeper.calendarId)
      .single();
    expect(data).toEqual({
      owner_id: oneKeeper.members[0].id,
      orphaned_at: null,
    });

    const { data: membership } = await admin
      .from("calendar_members")
      .select("user_id, role")
      .eq("calendar_id", oneKeeper.calendarId);
    expect(membership).toEqual([
      { user_id: oneKeeper.members[0].id, role: "owner" },
    ]);
  });

  it("the decisions of a settled calendar are cleared", async () => {
    const { data } = await admin
      .from("calendar_orphan_decisions")
      .select("calendar_id")
      .eq("calendar_id", oneKeeper.calendarId);
    expect(data).toEqual([]);
  });

  it("nobody keeps it: the calendar and its events go (RF-29), with no notice to whoever left", async () => {
    const { data } = await admin
      .from("calendars")
      .select("id")
      .eq("id", nobodyLeft.calendarId);
    expect(data).toEqual([]);

    const { data: notices } = await admin
      .from("account_notices")
      .select("id")
      .eq("user_id", nobodyLeft.members[0].id)
      .eq("kind", "deleted_calendar");
    expect(notices).toEqual([]);
  });

  it("deadline passed with nobody keeping: deleted, and the remaining member is told (RF-26, RF-29)", async () => {
    const { data } = await admin
      .from("calendars")
      .select("id")
      .eq("id", deadlineNobody.calendarId);
    expect(data).toEqual([]);

    const { data: notices } = await admin
      .from("account_notices")
      .select("kind")
      .eq("user_id", deadlineNobody.members[0].id)
      .eq("kind", "deleted_calendar");
    expect(notices).toEqual([{ kind: "deleted_calendar" }]);
  });

  it("not due yet: a calendar with an undecided member is left untouched (RF-26)", async () => {
    const { data } = await admin
      .from("calendars")
      .select("owner_id, orphaned_at")
      .eq("id", notDue.calendarId)
      .single();
    expect(data?.owner_id).toBeNull();
    expect(data?.orphaned_at).not.toBeNull();

    const { data: notices } = await admin
      .from("account_notices")
      .select("id")
      .eq("user_id", notDue.members[0].id)
      .eq("kind", "deleted_calendar");
    expect(notices).toEqual([]);
  });

  it("deadline passed with one keeper and one undecided: the keeper becomes owner, no copy, the undecided member gets nothing (RF-26, RF-27)", async () => {
    const { data } = await admin
      .from("calendars")
      .select("owner_id, orphaned_at")
      .eq("id", deadlineMixed.calendarId)
      .single();
    expect(data).toEqual({
      owner_id: deadlineMixed.members[0].id,
      orphaned_at: null,
    });

    const { data: undecidedCalendars } = await admin
      .from("calendars")
      .select("id")
      .eq("name", "Familia S6")
      .eq("owner_id", deadlineMixed.members[1].id);
    expect(undecidedCalendars).toEqual([]);
  });

  it("running it again changes nothing: no duplicate copies or notices (for update)", async () => {
    const { error } = await admin.rpc("apply_orphan_decisions");
    expect(error).toBeNull();

    const { data: copies } = await admin
      .from("calendars")
      .select("id")
      .eq("name", "Familia S1")
      .eq("owner_id", twoKeepers.members[0].id);
    expect(copies).toHaveLength(1);

    const { data: notices } = await admin
      .from("account_notices")
      .select("id")
      .eq("user_id", twoKeepers.members[0].id)
      .eq("kind", "kept_copy");
    expect(notices).toHaveLength(1);
  });
});
