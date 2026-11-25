import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestUser, deleteTestUser, type TestUser } from "./helpers";

// Spec 047, T4: the badge of the icon is a setting of the own profile (RF-12).
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

describe("profiles.badge_today", () => {
  it("starts on and the owner turns it off", async () => {
    const before = await ana.client
      .from("profiles")
      .select("badge_today")
      .eq("id", ana.id)
      .single();
    expect(before.data).toEqual({ badge_today: true });

    const { data, error } = await ana.client
      .from("profiles")
      .update({ badge_today: false })
      .eq("id", ana.id)
      .select("badge_today");
    expect(error).toBeNull();
    expect(data).toEqual([{ badge_today: false }]);
  });

  it("nobody reads or changes someone else's (P3)", async () => {
    const read = await bea.client
      .from("profiles")
      .select("badge_today")
      .eq("id", ana.id);
    const write = await bea.client
      .from("profiles")
      .update({ badge_today: true })
      .eq("id", ana.id)
      .select("id");
    expect(read.data).toEqual([]);
    expect(write.data).toEqual([]);
  });
});
