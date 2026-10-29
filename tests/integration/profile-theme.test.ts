import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  admin,
  anonClient,
  createTestUser,
  deleteTestUser,
  getOwnCalendarId,
  type TestUser,
} from "./helpers";

// Spec 011, T1: the theme lives in the user's own profile row and the
// existing "own row only" policies protect it (RF-2, RF-4; plan theme-schema).
let ana: TestUser;
let bea: TestUser;

beforeAll(async () => {
  [ana, bea] = await Promise.all([
    createTestUser({ display_name: "Ana" }),
    createTestUser({ display_name: "Bea" }),
  ]);
});

afterAll(async () => {
  await Promise.all(
    [ana, bea].filter(Boolean).map((user) => deleteTestUser(user.id)),
  );
});

const THEMES = ["light", "dark", "system"];

describe("profiles.theme", () => {
  it("a new user starts with the system theme (RF-2)", async () => {
    const { data, error } = await ana.client
      .from("profiles")
      .select("theme")
      .eq("id", ana.id)
      .single();

    expect(error).toBeNull();
    expect(data?.theme).toBe("system");
  });

  it("the user can save each theme (RF-4)", async () => {
    for (const theme of THEMES) {
      const { data, error } = await ana.client
        .from("profiles")
        .update({ theme })
        .eq("id", ana.id)
        .select("theme");
      expect(error).toBeNull();
      expect(data).toEqual([{ theme }]);
    }
  });

  it("rejects a value outside the list", async () => {
    const { error } = await ana.client
      .from("profiles")
      .update({ theme: "sepia" })
      .eq("id", ana.id);

    expect(error?.code).toBe("23514");
  });

  it("nobody reads or changes someone else's theme (P3)", async () => {
    const read = await bea.client
      .from("profiles")
      .select("theme")
      .eq("id", ana.id);
    const write = await bea.client
      .from("profiles")
      .update({ theme: "dark" })
      .eq("id", ana.id)
      .select("id");

    expect(read.data).toEqual([]);
    expect(write.data).toEqual([]);
    const { data } = await admin
      .from("profiles")
      .select("theme")
      .eq("id", ana.id)
      .single();
    expect(data?.theme).not.toBe("dark");
  });

  it("anon sees no theme", async () => {
    const { data } = await anonClient().from("profiles").select("theme");

    expect(data ?? []).toEqual([]);
  });

  it("shared names never carry the theme (P3)", async () => {
    const calendarId = await getOwnCalendarId(ana.id);
    const { error: memberError } = await admin
      .from("calendar_members")
      .insert({ calendar_id: calendarId, user_id: bea.id, role: "viewer" });
    if (memberError) throw memberError;

    const people = await bea.client.rpc("visible_people");
    const members = await bea.client.rpc("calendar_members_with_names", {
      p_calendar_ids: [calendarId],
    });

    expect(people.error).toBeNull();
    expect(members.error).toBeNull();
    for (const row of [...(people.data ?? []), ...(members.data ?? [])]) {
      expect(row).not.toHaveProperty("theme");
    }
  });
});
