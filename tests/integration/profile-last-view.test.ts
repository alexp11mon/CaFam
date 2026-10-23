import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  admin,
  anonClient,
  createTestUser,
  deleteTestUser,
  type TestUser,
} from "./helpers";

// Spec 008, T10: the last chosen view lives in the user's own profile row and
// the existing "own row only" policies protect it (RF-25, plan D7).
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

describe("profiles.last_view", () => {
  it("is empty for a new user (RF-26 falls back to the agenda)", async () => {
    const { data, error } = await ana.client
      .from("profiles")
      .select("last_view")
      .eq("id", ana.id)
      .single();

    expect(error).toBeNull();
    expect(data?.last_view).toBeNull();
  });

  it("the user can save each of the four views (RF-25)", async () => {
    for (const view of ["agenda", "month", "week", "day"]) {
      const { data, error } = await ana.client
        .from("profiles")
        .update({ last_view: view })
        .eq("id", ana.id)
        .select("last_view");
      expect(error).toBeNull();
      expect(data).toEqual([{ last_view: view }]);
    }
  });

  it("rejects a value outside the list", async () => {
    const { error } = await ana.client
      .from("profiles")
      .update({ last_view: "year" })
      .eq("id", ana.id);

    expect(error?.code).toBe("23514");
  });

  it("nobody reads or changes someone else's view (P3)", async () => {
    await ana.client
      .from("profiles")
      .update({ last_view: "week" })
      .eq("id", ana.id);

    const read = await bea.client
      .from("profiles")
      .select("last_view")
      .eq("id", ana.id);
    const write = await bea.client
      .from("profiles")
      .update({ last_view: "day" })
      .eq("id", ana.id)
      .select("id");

    expect(read.data).toEqual([]);
    expect(write.data).toEqual([]);
    const { data } = await admin
      .from("profiles")
      .select("last_view")
      .eq("id", ana.id)
      .single();
    expect(data?.last_view).toBe("week");
  });

  it("anon sees nothing", async () => {
    const { data } = await anonClient().from("profiles").select("last_view");

    expect(data ?? []).toEqual([]);
  });
});
