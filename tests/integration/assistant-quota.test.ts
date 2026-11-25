import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  admin,
  createTestUser,
  deleteTestUser,
  type TestUser,
} from "./helpers";

// Spec 051, T2: the daily quota of the assistant, reserved atomically
// (RF-4, RF-5).
let user: TestUser;

beforeAll(async () => {
  user = await createTestUser({ display_name: "Marta" });
});

afterAll(async () => {
  await deleteTestUser(user.id);
});

beforeEach(async () => {
  await admin.from("assistant_questions").delete().eq("user_id", user.id);
});

async function answered(count: number) {
  const { error } = await admin.from("assistant_questions").insert(
    Array.from({ length: count }, () => ({
      user_id: user.id,
      state: "answered",
    })),
  );
  if (error) throw error;
}

const reserve = () => user.client.rpc("assistant_reserve");

describe("assistant_reserve", () => {
  it("lets only one of 35 parallel questions in with 29 answered (RF-4)", async () => {
    await answered(29);
    const results = await Promise.all(Array.from({ length: 35 }, reserve));
    const ok = results.filter((result) => !result.error);
    expect(ok).toHaveLength(1);
    expect(ok[0].data).toEqual([{ id: expect.any(Number), remaining: 0 }]);
    expect(
      results.filter((result) => result.error?.code === "CF429"),
    ).toHaveLength(34);
  });

  it("releasing gives the slot back; answering keeps it (RF-5)", async () => {
    await answered(29);
    const first = await reserve();
    expect((await reserve()).error?.code).toBe("CF429");
    await user.client.rpc("assistant_release", {
      p_id: first.data![0].id,
    });
    const second = await reserve();
    expect(second.error).toBeNull();
    await user.client.rpc("assistant_answered", {
      p_id: second.data![0].id,
    });
    const { data } = await admin
      .from("assistant_questions")
      .select("state, expires_at")
      .eq("id", second.data![0].id)
      .single();
    expect(data).toEqual({ state: "answered", expires_at: null });
    expect((await reserve()).error?.code).toBe("CF429");
  });

  it("an expired reservation does not count (RF-5)", async () => {
    await answered(29);
    const { error } = await admin.from("assistant_questions").insert({
      user_id: user.id,
      state: "reserved",
      expires_at: new Date(Date.now() - 3_600_000).toISOString(),
    });
    expect(error).toBeNull();
    expect((await reserve()).error).toBeNull();
  });

  it("counts only today in the profile's zone (RF-27 of 015)", async () => {
    const { error } = await admin.from("assistant_questions").insert(
      Array.from({ length: 30 }, () => ({
        user_id: user.id,
        state: "answered",
        asked_at: new Date(Date.now() - 26 * 3_600_000).toISOString(),
      })),
    );
    expect(error).toBeNull();
    expect((await reserve()).error).toBeNull();
  });

  it("the client can no longer insert rows by itself", async () => {
    const { error } = await user.client
      .from("assistant_questions")
      .insert({ user_id: user.id });
    expect(error?.code).toBe("42501");
  });
});
