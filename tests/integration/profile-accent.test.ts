import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  admin,
  anonClient,
  createTestUser,
  deleteTestUser,
  getOwnCalendarId,
  type TestUser,
} from "./helpers";

// Spec 005, T1: the accent lives in the user's own profile row and the
// existing "own row only" policies protect it (RF-8, RF-10, RF-13; plan D4).
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

const ACCENTS = ["red", "blue", "green", "yellow", "purple", "gray"];

describe("profiles.accent", () => {
  it("a new user starts with red (RF-10)", async () => {
    const { data, error } = await ana.client
      .from("profiles")
      .select("accent")
      .eq("id", ana.id)
      .single();

    expect(error).toBeNull();
    expect(data?.accent).toBe("red");
  });

  it("the user can save each of the six accents (RF-8)", async () => {
    for (const accent of ACCENTS) {
      const { data, error } = await ana.client
        .from("profiles")
        .update({ accent })
        .eq("id", ana.id)
        .select("accent");
      expect(error).toBeNull();
      expect(data).toEqual([{ accent }]);
    }
  });

  it("rejects a value outside the list", async () => {
    const { error } = await ana.client
      .from("profiles")
      .update({ accent: "pink" })
      .eq("id", ana.id);

    expect(error?.code).toBe("23514");
  });

  it("nobody reads or changes someone else's accent (RF-13)", async () => {
    const read = await bea.client
      .from("profiles")
      .select("accent")
      .eq("id", ana.id);
    const write = await bea.client
      .from("profiles")
      .update({ accent: "green" })
      .eq("id", ana.id)
      .select("id");

    expect(read.data).toEqual([]);
    expect(write.data).toEqual([]);
    const { data } = await admin
      .from("profiles")
      .select("accent")
      .eq("id", ana.id)
      .single();
    expect(data?.accent).not.toBe("green");
  });

  it("anon sees no accent", async () => {
    const { data } = await anonClient().from("profiles").select("accent");

    expect(data ?? []).toEqual([]);
  });

  it("shared names never carry the accent (P3)", async () => {
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
      expect(row).not.toHaveProperty("accent");
    }
  });
});
