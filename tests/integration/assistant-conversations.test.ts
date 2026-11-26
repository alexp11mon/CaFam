import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  admin,
  createTestUser,
  deleteTestMail,
  deleteTestUser,
  type TestUser,
} from "./helpers";

// Spec 052 T5: Venito's saved conversations (RF-9 to RF-12). Only their
// author sees them, at most 50, none older than 90 days.

let ana: TestUser;
let luis: TestUser;

const messages = [
  { role: "user", content: "¿Qué tengo mañana?" },
  { role: "assistant", content: "Mañana tienes PIAE." },
];

beforeAll(async () => {
  [ana, luis] = await Promise.all([
    createTestUser({ display_name: "Ana" }),
    createTestUser({ display_name: "Luis" }),
  ]);
});

afterAll(async () => {
  for (const user of [ana, luis]) if (user) await deleteTestUser(user.id);
  await deleteTestMail();
});

describe("assistant_conversations", () => {
  it("is off by default in the profile (plan D3)", async () => {
    const { data } = await ana.client
      .from("profiles")
      .select("save_chats")
      .eq("id", ana.id)
      .single();
    expect(data!.save_chats).toBe(false);
  });

  it("only its author reads, changes and deletes it (RF-11)", async () => {
    const { data: saved, error } = await ana.client
      .from("assistant_conversations")
      .insert({ title: "¿Qué tengo mañana?", messages })
      .select("id, user_id")
      .single();
    expect(error).toBeNull();
    expect(saved!.user_id).toBe(ana.id);

    const { data: seen } = await luis.client
      .from("assistant_conversations")
      .select("id")
      .eq("id", saved!.id);
    expect(seen).toEqual([]);
    const { data: changed } = await luis.client
      .from("assistant_conversations")
      .update({ title: "Mía" })
      .eq("id", saved!.id)
      .select("id");
    expect(changed).toEqual([]);
    const { data: deleted } = await luis.client
      .from("assistant_conversations")
      .delete()
      .eq("id", saved!.id)
      .select("id");
    expect(deleted).toEqual([]);

    // Nor can Luis write one for Ana.
    const { error: forged } = await luis.client
      .from("assistant_conversations")
      .insert({ user_id: ana.id, title: "Falsa", messages });
    expect(forged).not.toBeNull();
  });

  it("refuses messages that are not a list or too big", async () => {
    const { error: notList } = await ana.client
      .from("assistant_conversations")
      .insert({ title: "Rara", messages: { role: "user" } });
    expect(notList).not.toBeNull();
    const { error: big } = await ana.client
      .from("assistant_conversations")
      .insert({
        title: "Enorme",
        messages: [{ role: "user", content: "x".repeat(210 * 1024) }],
      });
    expect(big).not.toBeNull();
  });

  it("keeps at most 50: the 51st pushes out the oldest (RF-10)", async () => {
    await admin.from("assistant_conversations").delete().eq("user_id", ana.id);
    const rows = Array.from({ length: 50 }, (_, index) => ({
      user_id: ana.id,
      title: `Conversación ${index + 1}`,
      messages,
      created_at: new Date(Date.UTC(2026, 10, 1, 0, index)).toISOString(),
      updated_at: new Date(Date.UTC(2026, 10, 1, 0, index)).toISOString(),
    }));
    const { error } = await admin.from("assistant_conversations").insert(rows);
    expect(error).toBeNull();
    await ana.client
      .from("assistant_conversations")
      .insert({ title: "La nueva", messages });
    const { data } = await ana.client
      .from("assistant_conversations")
      .select("title");
    const titles = data!.map((row) => row.title);
    expect(titles).toHaveLength(50);
    expect(titles).toContain("La nueva");
    expect(titles).not.toContain("Conversación 1");
  });

  it("forgets those older than 90 days (RF-10)", async () => {
    const { data: old } = await admin
      .from("assistant_conversations")
      .insert({
        user_id: luis.id,
        title: "Antigua",
        messages,
        updated_at: new Date(Date.now() - 91 * 86_400_000).toISOString(),
      })
      .select("id")
      .single();
    const { error } = await admin.rpc("assistant_conversations_purge");
    expect(error).toBeNull();
    const { count } = await admin
      .from("assistant_conversations")
      .select("id", { count: "exact", head: true })
      .eq("id", old!.id);
    expect(count).toBe(0);
  });

  it("the purge is not for users", async () => {
    const { error } = await ana.client.rpc("assistant_conversations_purge");
    expect(error).not.toBeNull();
  });
});
