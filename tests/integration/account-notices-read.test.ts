import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  admin,
  createTestUser,
  deleteTestUser,
  type TestUser,
} from "./helpers";

// Spec 006, T20: a user closes their own notices, and nothing else (plan D10;
// RF-23).
let ana: TestUser;
let bea: TestUser;
let anaNoticeId: string;
let beaNoticeId: string;

beforeAll(async () => {
  [ana, bea] = await Promise.all([
    createTestUser({ display_name: "Ana" }),
    createTestUser({ display_name: "Bea" }),
  ]);
  const { data, error } = await admin
    .from("account_notices")
    .insert([
      { user_id: ana.id, kind: "kept_copy", calendar_name: "Familia" },
      { user_id: bea.id, kind: "kept_copy", calendar_name: "Familia" },
    ])
    .select("id, user_id");
  expect(error).toBeNull();
  anaNoticeId = data!.find((row) => row.user_id === ana.id)!.id;
  beaNoticeId = data!.find((row) => row.user_id === bea.id)!.id;
});

afterAll(async () => {
  await Promise.all(
    [ana, bea].filter(Boolean).map((user) => deleteTestUser(user.id)),
  );
});

describe("closing notices (RF-23, D10)", () => {
  it("a user can mark their own notice as read", async () => {
    const { data, error } = await ana.client
      .from("account_notices")
      .update({ read_at: new Date().toISOString() })
      .eq("id", anaNoticeId)
      .select("id");

    expect(error).toBeNull();
    expect(data).toEqual([{ id: anaNoticeId }]);
  });

  it("a user cannot mark someone else's notice", async () => {
    const { data } = await ana.client
      .from("account_notices")
      .update({ read_at: new Date().toISOString() })
      .eq("id", beaNoticeId)
      .select("id");
    expect(data).toEqual([]);

    const { data: check } = await admin
      .from("account_notices")
      .select("read_at")
      .eq("id", beaNoticeId)
      .single();
    expect(check?.read_at).toBeNull();
  });

  it("a user cannot change anything but read_at (42501)", async () => {
    const { error } = await ana.client
      .from("account_notices")
      .update({ calendar_name: "Otro" })
      .eq("id", anaNoticeId);

    expect(error?.code).toBe("42501");
  });
});
