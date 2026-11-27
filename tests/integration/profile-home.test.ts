import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestUser, deleteTestUser, type TestUser } from "./helpers";

// Spec 054 T1: the home screen saved in the account (RF-24, RF-26).
let ana: TestUser;
let ben: TestUser;

beforeAll(async () => {
  [ana, ben] = await Promise.all([
    createTestUser({ display_name: "Ana" }),
    createTestUser({ display_name: "Ben" }),
  ]);
});

afterAll(async () => {
  await Promise.all(
    [ana, ben].filter(Boolean).map((user) => deleteTestUser(user.id)),
  );
});

const homeOf = async (reader: TestUser, owner: TestUser) =>
  (
    await reader.client
      .from("profiles")
      .select("home")
      .eq("id", owner.id)
      .maybeSingle()
  ).data?.home;

describe("profiles.home", () => {
  it("is 'calendar' for a new account (RF-24)", async () => {
    expect(await homeOf(ana, ana)).toBe("calendar");
  });

  it("only its owner reads and changes it, and only to a known screen (RF-26)", async () => {
    const own = await ana.client
      .from("profiles")
      .update({ home: "now" })
      .eq("id", ana.id)
      .select("id");
    expect(own.data).toHaveLength(1);
    expect(await homeOf(ana, ana)).toBe("now");

    const other = await ana.client
      .from("profiles")
      .update({ home: "now" })
      .eq("id", ben.id)
      .select("id");
    expect(other.data).toHaveLength(0);
    expect(await homeOf(ben, ben)).toBe("calendar");

    const bad = await ana.client
      .from("profiles")
      .update({ home: "notes" })
      .eq("id", ana.id);
    expect(bad.error?.code).toBe("23514");
  });

  it("is not readable by another user (RF-26)", async () => {
    expect(await homeOf(ben, ana)).toBeUndefined();
  });
});
