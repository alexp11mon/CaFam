import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  admin,
  createTestUser,
  deleteTestMail,
  deleteTestUser,
  getOwnCalendarId,
  type TestUser,
} from "./helpers";

// Spec 007, T12: private calendar groups (RF-35, RF-37, RF-41 to RF-43, RF-46).
let ana: TestUser;
let bea: TestUser;
let gone: TestUser;
let anaCalendar: string;
let beaCalendar: string;
let orphanCalendar: string;

const CONFLICT = { onConflict: "user_id,calendar_id" };

beforeAll(async () => {
  [ana, bea, gone] = await Promise.all([
    createTestUser({ display_name: "Ana" }),
    createTestUser({ display_name: "Bea" }),
    createTestUser({ display_name: "Gone" }),
  ]);
  [anaCalendar, beaCalendar] = await Promise.all([
    getOwnCalendarId(ana.id),
    getOwnCalendarId(bea.id),
  ]);
  // Ana sees Bea's calendar and one left without owner (spec 006).
  const { data: shared } = await admin
    .from("calendars")
    .insert({ owner_id: gone.id, name: "Familia" })
    .select("id")
    .single();
  orphanCalendar = shared!.id;
  const { error } = await admin.from("calendar_members").insert([
    { calendar_id: beaCalendar, user_id: ana.id, role: "viewer" },
    { calendar_id: orphanCalendar, user_id: ana.id, role: "editor" },
  ]);
  if (error) throw error;
  const { error: deleteError } = await gone.client.rpc("delete_own_account");
  if (deleteError) throw deleteError;
});

afterAll(async () => {
  await deleteTestMail();
  await admin.from("calendars").delete().eq("id", orphanCalendar);
  await Promise.all(
    [ana, bea].filter(Boolean).map((user) => deleteTestUser(user.id)),
  );
});

async function createGroup(user: TestUser, name: string) {
  return user.client
    .from("calendar_groups")
    .insert({ user_id: user.id, name })
    .select("id")
    .single();
}

async function assign(user: TestUser, calendarId: string, groupId: string) {
  return user.client
    .from("calendar_preferences")
    .upsert(
      { user_id: user.id, calendar_id: calendarId, group_id: groupId },
      CONFLICT,
    );
}

async function groupOf(userId: string, calendarId: string) {
  const { data } = await admin
    .from("calendar_preferences")
    .select("group_id")
    .eq("user_id", userId)
    .eq("calendar_id", calendarId)
    .maybeSingle();
  return data?.group_id ?? null;
}

describe("calendar_groups (RF-35, RF-41, RF-42)", () => {
  it("each user creates, reads, renames and deletes only their own groups", async () => {
    const { data: group, error } = await createGroup(ana, "Trabajo");
    expect(error).toBeNull();

    const { data: seen } = await bea.client
      .from("calendar_groups")
      .select("id")
      .eq("id", group!.id);
    expect(seen).toEqual([]);
    const { data: renamed } = await bea.client
      .from("calendar_groups")
      .update({ name: "Mío" })
      .eq("id", group!.id)
      .select("id");
    expect(renamed).toEqual([]);
    const { error: foreign } = await bea.client
      .from("calendar_groups")
      .insert({ user_id: ana.id, name: "Intruso" });
    expect(foreign?.code).toBe("42501");

    const { error: rename } = await ana.client
      .from("calendar_groups")
      .update({ name: "Oficina" })
      .eq("id", group!.id);
    expect(rename).toBeNull();
    const { data: removed } = await ana.client
      .from("calendar_groups")
      .delete()
      .eq("id", group!.id)
      .select("id");
    expect(removed).toHaveLength(1);
  });

  it("names are 1 to 40 characters and unique ignoring case and outer spaces", async () => {
    expect((await createGroup(ana, "")).error?.code).toBe("23514");
    expect((await createGroup(ana, "   ")).error?.code).toBe("23514");
    expect((await createGroup(ana, "x".repeat(41))).error?.code).toBe("23514");
    expect((await createGroup(ana, "Familia")).error).toBeNull();
    expect((await createGroup(ana, "  familia ")).error?.code).toBe("23505");
    // Another user may use the same name.
    expect((await createGroup(bea, "Familia")).error).toBeNull();
  });
});

describe("assigning calendars (RF-37, RF-41, RF-42, RF-46)", () => {
  it("groups own, shared and ownerless calendars, one group each", async () => {
    const { data: group } = await createGroup(ana, "Todo");
    const { data: other } = await createGroup(ana, "Otro");

    for (const calendar of [anaCalendar, beaCalendar, orphanCalendar]) {
      expect((await assign(ana, calendar, group!.id)).error).toBeNull();
    }
    expect(await groupOf(ana.id, orphanCalendar)).toBe(group!.id);

    // Moving it to another group replaces the assignment (primary key).
    expect((await assign(ana, beaCalendar, other!.id)).error).toBeNull();
    expect(await groupOf(ana.id, beaCalendar)).toBe(other!.id);
  });

  it("a group of another user cannot be assigned", async () => {
    const { data: beaGroup } = await createGroup(bea, "Ajeno");

    const { error } = await assign(ana, anaCalendar, beaGroup!.id);

    expect(error?.code).toBe("23503");
  });

  it("deleting a group leaves its calendars without group", async () => {
    const { data: group } = await createGroup(ana, "Temporal");
    await assign(ana, anaCalendar, group!.id);
    await ana.client
      .from("calendar_preferences")
      .update({ visible: false })
      .eq("user_id", ana.id)
      .eq("calendar_id", anaCalendar);

    await ana.client.from("calendar_groups").delete().eq("id", group!.id);

    const { data } = await admin
      .from("calendar_preferences")
      .select("group_id, visible")
      .eq("user_id", ana.id)
      .eq("calendar_id", anaCalendar)
      .single();
    expect(data).toEqual({ group_id: null, visible: false });
    const { count } = await admin
      .from("calendars")
      .select("id", { count: "exact", head: true })
      .eq("id", anaCalendar);
    expect(count).toBe(1);
  });

  it("leaving a calendar removes it from the group (RF-43)", async () => {
    const { data: group } = await createGroup(ana, "Compartidos");
    await assign(ana, beaCalendar, group!.id);

    await ana.client
      .from("calendar_members")
      .delete()
      .eq("calendar_id", beaCalendar)
      .eq("user_id", ana.id);

    expect(await groupOf(ana.id, beaCalendar)).toBeNull();
  });

  it("a deleted calendar leaves the group (RF-43)", async () => {
    const { data: group } = await createGroup(ana, "Borrables");
    const { data: calendar } = await ana.client
      .from("calendars")
      .insert({ owner_id: ana.id, name: "Efímero" })
      .select("id")
      .single();
    await assign(ana, calendar!.id, group!.id);

    await ana.client.from("calendars").delete().eq("id", calendar!.id);

    const { count } = await admin
      .from("calendar_preferences")
      .select("calendar_id", { count: "exact", head: true })
      .eq("group_id", group!.id);
    expect(count).toBe(0);
  });
});
