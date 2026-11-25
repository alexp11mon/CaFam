import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestUser, deleteTestUser, type TestUser } from "./helpers";

// Spec 048, T4: "Tareas con fecha" in the calendar (RF-6 to RF-8, plan D3).
let user: TestUser;
let other: TestUser;

beforeAll(async () => {
  [user, other] = await Promise.all([
    createTestUser({ display_name: "Tania" }),
    createTestUser({ display_name: "Otto" }),
  ]);
});

afterAll(async () => {
  await Promise.all(
    [user, other].map((u) => deleteTestUser(u.id).catch(() => {})),
  );
});

const range = { p_from: "2026-12-01", p_to: "2026-12-31" };

describe("calendar tasks", () => {
  it("the switch is the user's own, for every device", async () => {
    const { error } = await user.client
      .from("profiles")
      .update({ show_tasks: true })
      .eq("id", user.id);
    expect(error).toBeNull();
    const { data } = await user.client
      .from("profiles")
      .select("show_tasks")
      .eq("id", user.id)
      .single();
    expect(data?.show_tasks).toBe(true);
    // Somebody else's is never written.
    const { data: theirs } = await user.client
      .from("profiles")
      .update({ show_tasks: true })
      .eq("id", other.id)
      .select("id");
    expect(theirs ?? []).toEqual([]);
  });

  it("ticking an item in the calendar takes it out, and back with Deshacer", async () => {
    const { data: note, error } = await user.client
      .from("notes")
      .insert({ title: "Compra" })
      .select("id")
      .single();
    expect(error).toBeNull();
    const { data: item } = await user.client
      .from("note_items")
      .insert({ note_id: note!.id, text: "Pan", due_date: "2026-12-03" })
      .select("id")
      .single();
    const texts = async () =>
      ((await user.client.rpc("calendar_tasks", range)).data ?? []).map(
        (row) => row.text,
      );
    expect(await texts()).toContain("Pan");

    await user.client
      .from("note_items")
      .update({ done: true })
      .eq("id", item!.id);
    expect(await texts()).not.toContain("Pan");

    await user.client
      .from("note_items")
      .update({ done: false })
      .eq("id", item!.id);
    expect(await texts()).toContain("Pan");
    // Nobody else sees a personal note's tasks (RF-8).
    const theirs = (await other.client.rpc("calendar_tasks", range)).data;
    expect(theirs ?? []).toEqual([]);
  });
});
