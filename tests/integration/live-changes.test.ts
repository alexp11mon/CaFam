import type { RealtimeChannel } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  admin,
  createTestUser,
  deleteTestMail,
  deleteTestUser,
  getOwnCalendarId,
  type TestUser,
} from "./helpers";

// Spec 019, T2: a private message to each member when a calendar changes
// (plan "Modelo de datos", D2 to D5; RF-40, RF-42, RF-45, RF-47).
interface Listener {
  messages: { actor: string | null }[];
  channel: RealtimeChannel;
  status: string;
}

let owner: TestUser;
let editor: TestUser;
let stranger: TestUser;
let calendar: string;
let other: string;
const listeners: Listener[] = [];

async function listen(user: TestUser, topicUser = user.id): Promise<Listener> {
  await user.client.realtime.setAuth();
  const listener: Listener = {
    messages: [],
    status: "",
    channel: null as unknown as RealtimeChannel,
  };
  listener.channel = user.client
    .channel(`user:${topicUser}`, { config: { private: true } })
    .on("broadcast", { event: "changed" }, ({ payload }) => {
      listener.messages.push(payload as { actor: string | null });
    });
  await new Promise<void>((resolve) => {
    listener.channel.subscribe((status) => {
      listener.status = status;
      if (status !== "SUBSCRIBED" && status !== "CLOSED") resolve();
      if (status === "SUBSCRIBED") resolve();
    });
    setTimeout(resolve, 8000);
  });
  listeners.push(listener);
  return listener;
}

async function until(check: () => boolean, ms = 5000): Promise<boolean> {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (check()) return true;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return check();
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 1500));

const TIMES = {
  starts_at: "2026-11-02T10:00:00Z",
  ends_at: "2026-11-02T11:00:00Z",
};

beforeAll(async () => {
  [owner, editor, stranger] = await Promise.all([
    createTestUser({ display_name: "Olga" }),
    createTestUser({ display_name: "Eva" }),
    createTestUser({ display_name: "Sam" }),
  ]);
  calendar = await getOwnCalendarId(owner.id);
  other = await getOwnCalendarId(editor.id);
  const { error } = await admin
    .from("calendar_members")
    .insert({ calendar_id: calendar, user_id: editor.id, role: "editor" });
  if (error) throw error;
}, 30_000);

afterAll(async () => {
  for (const listener of listeners)
    await listener.channel.unsubscribe().catch(() => undefined);
  await Promise.all(
    [owner, editor, stranger].map((user) => deleteTestUser(user.id)),
  );
  await deleteTestMail();
});

describe("live changes", () => {
  it("tells a member who changed an event, within 5 s, without its data", async () => {
    const mine = await listen(owner);
    expect(mine.status).toBe("SUBSCRIBED");
    const started = Date.now();
    const { data, error } = await editor.client
      .from("events")
      .insert({ calendar_id: calendar, title: "Cena secreta", ...TIMES })
      .select("id")
      .single();
    expect(error).toBeNull();
    expect(await until(() => mine.messages.length > 0)).toBe(true);
    expect(Date.now() - started).toBeLessThan(5000);
    expect(mine.messages[0]).toMatchObject({ actor: editor.id });
    expect(JSON.stringify(mine.messages)).not.toContain("Cena");
    expect(JSON.stringify(mine.messages)).not.toContain(data!.id);

    // Changing and deleting it tell again.
    mine.messages.length = 0;
    await editor.client
      .from("events")
      .update({ title: "Comida" })
      .eq("id", data!.id);
    expect(await until(() => mine.messages.length > 0)).toBe(true);
    mine.messages.length = 0;
    await editor.client.from("events").delete().eq("id", data!.id);
    expect(await until(() => mine.messages.length > 0)).toBe(true);
  }, 30_000);

  it("does not let a stranger listen to someone else's topic", async () => {
    const spy = await listen(stranger, owner.id);
    expect(spy.status).not.toBe("SUBSCRIBED");
    const own = await listen(stranger);
    expect(own.status).toBe("SUBSCRIBED");
    await admin
      .from("events")
      .insert({ calendar_id: calendar, title: "Privado", ...TIMES });
    await settle();
    expect(spy.messages).toHaveLength(0);
    expect(own.messages).toHaveLength(0);
  }, 30_000);

  it("sends one message per member for a whole transaction", async () => {
    const mine = await listen(owner);
    await settle();
    mine.messages.length = 0;
    const rows = Array.from({ length: 50 }, (_, index) => ({
      calendar_id: calendar,
      title: `Importado ${index}`,
      ...TIMES,
    }));
    const { error } = await admin.from("events").insert(rows);
    expect(error).toBeNull();
    expect(await until(() => mine.messages.length > 0)).toBe(true);
    await settle();
    expect(mine.messages).toHaveLength(1);
    // Sync and other server writes have no session: no actor.
    expect(mine.messages[0]).toMatchObject({ actor: null });
  }, 30_000);

  it("tells the members when the calendar changes", async () => {
    const theirs = await listen(editor);
    await settle();
    theirs.messages.length = 0;
    await owner.client
      .from("calendars")
      .update({ color: "#FFADAD" })
      .eq("id", calendar);
    expect(await until(() => theirs.messages.length > 0)).toBe(true);
    expect(theirs.messages[0]).toMatchObject({ actor: owner.id });
  }, 30_000);

  it("tells the members of both calendars when an event moves", async () => {
    const mine = await listen(owner);
    const { data } = await admin
      .from("events")
      .insert({ calendar_id: other, title: "Mover", ...TIMES })
      .select("id")
      .single();
    await settle();
    mine.messages.length = 0;
    // The owner is not a member of `other`: only the move into `calendar` reaches them.
    await admin
      .from("events")
      .update({ calendar_id: calendar })
      .eq("id", data!.id);
    expect(await until(() => mine.messages.length > 0)).toBe(true);
    mine.messages.length = 0;
    await admin
      .from("events")
      .update({ calendar_id: other })
      .eq("id", data!.id);
    expect(await until(() => mine.messages.length > 0)).toBe(true);
  }, 30_000);

  it("tells an expelled member, who is no longer one", async () => {
    const theirs = await listen(editor);
    await settle();
    theirs.messages.length = 0;
    const { error } = await owner.client
      .from("calendar_members")
      .delete()
      .eq("calendar_id", calendar)
      .eq("user_id", editor.id);
    expect(error).toBeNull();
    expect(await until(() => theirs.messages.length > 0)).toBe(true);
  }, 30_000);

  it("keeps every public table behind RLS", async () => {
    const { data, error } = await admin.rpc("list_tables_without_rls");
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });
});
