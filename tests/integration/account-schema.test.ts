import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  admin,
  createTestUser,
  deleteTestUser,
  getOwnCalendarId,
  type TestUser,
} from "./helpers";

// Spec 006, T2: calendars without owner, notices, decisions, mail queue and
// recovery limiter (plan "Modelo de datos", D2, D10; RF-5, RF-21, RF-22, RF-23).
let ana: TestUser;
let bea: TestUser;
let anaCalendarId: string;

beforeAll(async () => {
  [ana, bea] = await Promise.all([
    createTestUser({ display_name: "Ana" }),
    createTestUser({ display_name: "Bea" }),
  ]);
  anaCalendarId = await getOwnCalendarId(ana.id);
});

afterAll(async () => {
  await Promise.all(
    [ana, bea].filter(Boolean).map((user) => deleteTestUser(user.id)),
  );
});

describe("calendars without owner (RF-21, D2)", () => {
  it("a calendar with an owner has no orphaned_at", async () => {
    const { data, error } = await admin
      .from("calendars")
      .select("orphaned_at")
      .eq("id", anaCalendarId)
      .single();

    expect(error).toBeNull();
    expect(data?.orphaned_at).toBeNull();
  });

  it("orphaned_at cannot be set while the calendar has an owner (23514)", async () => {
    const { error } = await admin
      .from("calendars")
      .update({ orphaned_at: new Date().toISOString() })
      .eq("id", anaCalendarId);

    expect(error?.code).toBe("23514");
  });

  it("owner_id cannot change outside the account functions (42501)", async () => {
    const { error } = await admin
      .from("calendars")
      .update({ owner_id: bea.id })
      .eq("id", anaCalendarId);

    expect(error?.code).toBe("42501");
  });
});

describe("account notices (RF-23, D10)", () => {
  it("a user reads only their own notices", async () => {
    const { data: inserted, error } = await admin
      .from("account_notices")
      .insert({
        user_id: ana.id,
        kind: "orphaned",
        person_name: "Bea",
        calendar_name: "Familia",
      })
      .select("id")
      .single();
    expect(error).toBeNull();

    const own = await ana.client
      .from("account_notices")
      .select("id")
      .eq("id", inserted!.id);
    expect(own.data).toEqual([{ id: inserted!.id }]);

    const other = await bea.client
      .from("account_notices")
      .select("id")
      .eq("id", inserted!.id);
    expect(other.data).toEqual([]);
  });

  it("a user cannot write notices", async () => {
    const { error } = await ana.client.from("account_notices").insert({
      user_id: ana.id,
      kind: "orphaned",
      person_name: "Ana",
      calendar_name: "Falsa",
    });

    expect(error?.code).toBe("42501");
  });
});

describe("decisions, mail queue and recovery limiter (RF-5, RF-23)", () => {
  it("a user can read their decisions but not write them", async () => {
    const insert = await ana.client.from("calendar_orphan_decisions").insert({
      calendar_id: anaCalendarId,
      user_id: ana.id,
      keep: true,
    });
    expect(insert.error?.code).toBe("42501");

    const read = await ana.client
      .from("calendar_orphan_decisions")
      .select("calendar_id");
    expect(read.error).toBeNull();
    expect(read.data).toEqual([]);
  });

  it("no client can read the mail queue", async () => {
    const { error } = await ana.client.from("email_outbox").select("id");
    expect(error?.code).toBe("42501");

    const anon = await admin
      .from("email_outbox")
      .select("id", { count: "exact", head: true });
    expect(anon.error).toBeNull();
  });

  it("no client can read the recovery request hashes", async () => {
    const { error } = await ana.client
      .from("auth_email_requests")
      .select("email_hash");
    expect(error?.code).toBe("42501");

    const check = await admin
      .from("auth_email_requests")
      .select("email_hash", { count: "exact", head: true });
    expect(check.error).toBeNull();
  });
});
