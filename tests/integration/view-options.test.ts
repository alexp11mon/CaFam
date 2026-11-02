import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  admin,
  createTestUser,
  deleteTestUser,
  getOwnCalendarId,
  type TestUser,
} from "./helpers";

// Spec 019, T5: weekends and the default duration live in the user's own
// profile row (RF-23, RF-24, RF-30, RF-31; plan view-options-schema).
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

describe("profiles view options", () => {
  it("start with weekends shown and 60 minutes", async () => {
    const { data, error } = await ana.client
      .from("profiles")
      .select("show_weekends, default_event_minutes")
      .eq("id", ana.id)
      .single();

    expect(error).toBeNull();
    expect(data).toEqual({ show_weekends: true, default_event_minutes: 60 });
  });

  it("saves each allowed duration and the weekends", async () => {
    for (const minutes of [15, 30, 45, 60, 90, 120]) {
      const { data, error } = await ana.client
        .from("profiles")
        .update({ default_event_minutes: minutes, show_weekends: false })
        .eq("id", ana.id)
        .select("show_weekends, default_event_minutes");
      expect(error).toBeNull();
      expect(data).toEqual([
        { show_weekends: false, default_event_minutes: minutes },
      ]);
    }
  });

  it("rejects a duration outside the list", async () => {
    const { error } = await ana.client
      .from("profiles")
      .update({ default_event_minutes: 20 })
      .eq("id", ana.id);

    expect(error?.code).toBe("23514");
  });

  it("nobody reads or changes someone else's (P3)", async () => {
    const read = await bea.client
      .from("profiles")
      .select("show_weekends")
      .eq("id", ana.id);
    const write = await bea.client
      .from("profiles")
      .update({ default_event_minutes: 15 })
      .eq("id", ana.id)
      .select("id");

    expect(read.data).toEqual([]);
    expect(write.data).toEqual([]);
  });

  it("shared names never carry them", async () => {
    const calendarId = await getOwnCalendarId(ana.id);
    const { error } = await admin
      .from("calendar_members")
      .insert({ calendar_id: calendarId, user_id: bea.id, role: "viewer" });
    if (error) throw error;

    const people = await bea.client.rpc("visible_people");
    expect(people.error).toBeNull();
    for (const row of people.data ?? []) {
      expect(row).not.toHaveProperty("show_weekends");
      expect(row).not.toHaveProperty("default_event_minutes");
    }
  });
});
