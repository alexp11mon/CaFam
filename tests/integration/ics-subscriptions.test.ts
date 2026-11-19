import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  admin,
  anonClient,
  createTestUser,
  deleteTestMail,
  deleteTestUser,
  getOwnCalendarId,
  type TestUser,
} from "./helpers";

// Spec 044, T4: subscriptions in the database (RF-5, RF-7 to RF-11, RF-13).
const SECRET = process.env.CRON_SECRET ?? "";
const URL_ONE = "https://example.com/colegio.ics";
const FROM = "2026-05-19T00:00:00Z";
const TO = "2027-11-19T00:00:00Z";

let owner: TestUser;
let editor: TestUser;
let viewer: TestUser;
let calendarId: string;

function event(id: string, title = `Evento ${id}`, day = 20) {
  return {
    title,
    description: null,
    location: null,
    starts_at: `2026-12-${day}T09:00:00Z`,
    ends_at: `2026-12-${day}T10:00:00Z`,
    all_day: false,
    external_id: id,
  };
}

async function sub() {
  const { data } = await admin
    .from("ics_subscriptions")
    .select("*")
    .eq("calendar_id", calendarId)
    .maybeSingle();
  return data;
}

async function events() {
  const { data } = await admin
    .from("events")
    .select("id, title, external_id, color")
    .eq("calendar_id", calendarId)
    .order("title");
  return data ?? [];
}

async function apply(list: unknown[], readAt: string | null) {
  return anonClient().rpc("ics_apply_events", {
    p_secret: SECRET,
    p_calendar_id: calendarId,
    p_events: list as never,
    p_read_at: readAt as never,
    p_from: FROM,
    p_to: TO,
  });
}

beforeAll(async () => {
  [owner, editor, viewer] = await Promise.all([
    createTestUser({ display_name: "Dueña" }),
    createTestUser({ display_name: "Editor" }),
    createTestUser({ display_name: "Lector" }),
  ]);
  calendarId = await getOwnCalendarId(owner.id);
  await admin.from("calendar_members").insert([
    { calendar_id: calendarId, user_id: editor.id, role: "editor" },
    { calendar_id: calendarId, user_id: viewer.id, role: "viewer" },
  ]);
  // The first import, and something that did not come from the link.
  await editor.client.rpc("import_into_calendar", {
    p_calendar_id: calendarId,
    p_events: [event("a"), event("b"), event("c")],
  });
  await admin.from("events").insert([
    {
      calendar_id: calendarId,
      created_by: owner.id,
      title: "Propio",
      starts_at: "2026-12-21T09:00:00Z",
      ends_at: "2026-12-21T10:00:00Z",
    },
    {
      calendar_id: calendarId,
      created_by: owner.id,
      title: "Otro archivo",
      starts_at: "2026-12-21T09:00:00Z",
      ends_at: "2026-12-21T10:00:00Z",
      external_id: "other-file",
    },
  ]);
});

afterAll(async () => {
  await Promise.all(
    [owner, editor, viewer]
      .filter(Boolean)
      .map((user) => deleteTestUser(user.id)),
  );
});

describe("ics subscriptions", () => {
  it("keeps the link in Vault and only members see the subscription", async () => {
    const asViewer = await viewer.client.rpc("create_ics_subscription", {
      p_calendar_id: calendarId,
      p_url: URL_ONE,
      p_ids: [],
    });
    expect(asViewer.error?.code).toBe("CF404");

    const created = await editor.client.rpc("create_ics_subscription", {
      p_calendar_id: calendarId,
      p_url: URL_ONE,
      p_ids: ["a", "b", "c"],
    });
    expect(created.error).toBeNull();

    const seen = await viewer.client
      .from("ics_subscriptions")
      .select("calendar_id, state, created_by")
      .eq("calendar_id", calendarId);
    expect(seen.data).toEqual([
      { calendar_id: calendarId, state: "active", created_by: editor.id },
    ]);
    const secret = await viewer.client
      .from("ics_subscriptions")
      .select("secret_id");
    expect(secret.error?.code).toBe("42501");

    const url = await anonClient().rpc("ics_get_url", {
      p_secret: SECRET,
      p_calendar_id: calendarId,
    });
    expect(url.data).toBe(URL_ONE);
    const wrong = await anonClient().rpc("ics_get_url", {
      p_secret: "nope",
      p_calendar_id: calendarId,
    });
    expect(wrong.error?.code).toBe("42501");
  });

  it("adds, changes and removes only what came from the link", async () => {
    // A color set in CaFam survives the update of the event (RF-8).
    const a = (await events()).find((row) => row.external_id === "a")!;
    await admin.from("events").update({ color: "#FFADAD" }).eq("id", a.id);

    const result = await apply(
      [event("a", "A cambiado"), event("b", "B del enlace"), event("d")],
      // A read after every change above, so all of them may be updated.
      new Date(Date.now() + 60_000).toISOString(),
    );
    expect(result.error).toBeNull();
    // "c" is gone from the link; "Otro archivo" and "Propio" never came from it.
    expect(result.data).toEqual({ added: 1, changed: 2, removed: 1 });

    const after = await events();
    expect(after.map((row) => [row.title, row.external_id])).toEqual([
      ["A cambiado", "a"],
      ["B del enlace", "b"],
      ["Evento d", "d"],
      ["Otro archivo", "other-file"],
      ["Propio", null],
    ]);
    expect(after.find((row) => row.external_id === "a")?.color).toBe("#FFADAD");
    const state = await sub();
    expect(state?.feed_ids?.sort()).toEqual(["a", "b", "d"]);
    expect(state?.last_summary).toEqual({ added: 1, changed: 2, removed: 1 });
  });

  it("does not overwrite what was changed in CaFam after the read", async () => {
    const { last_read_at: readAt } = (await sub())!;
    await admin
      .from("events")
      .update({ title: "Mío" })
      .eq("external_id", "d")
      .eq("calendar_id", calendarId);
    const result = await apply(
      [event("a", "A cambiado"), event("b", "B del enlace")],
      readAt,
    );
    // "d" was edited after the read: neither changed nor removed.
    expect(result.data).toEqual({ added: 0, changed: 0, removed: 0 });
    expect((await events()).map((row) => row.title)).toContain("Mío");
  });

  it("notifies at the third failure and pauses a link that is gone", async () => {
    for (let i = 0; i < 3; i++) {
      await anonClient().rpc("ics_fail", {
        p_secret: SECRET,
        p_calendar_id: calendarId,
        p_kind: "gone",
        p_message: "El enlace ya no existe.",
      });
    }
    const state = await sub();
    expect(state?.state).toBe("paused");
    expect(state?.consecutive_failures).toBe(3);
    const { data: notices } = await admin
      .from("account_notices")
      .select("kind, calendar_name, detail")
      .eq("user_id", editor.id);
    expect(notices).toEqual([
      {
        kind: "ics_failing",
        calendar_name: "Mi calendario",
        detail: "El enlace ya no existe.",
      },
    ]);

    // "Reintentar": a manual claim activates it again, every 5 minutes at most.
    await admin
      .from("ics_subscriptions")
      .update({ attempted_at: "2026-01-01T00:00:00Z" })
      .eq("calendar_id", calendarId);
    const claim = await editor.client.rpc("ics_claim_one", {
      p_secret: SECRET,
      p_calendar_id: calendarId,
    });
    expect(claim.data).toMatchObject({ status: "ok", calendar_id: calendarId });
    expect((await sub())?.state).toBe("active");
    const again = await editor.client.rpc("ics_claim_one", {
      p_secret: SECRET,
      p_calendar_id: calendarId,
    });
    expect(again.data).toEqual({ status: "too_soon" });
    const asViewer = await viewer.client.rpc("ics_claim_one", {
      p_secret: SECRET,
      p_calendar_id: calendarId,
    });
    expect(asViewer.error?.code).toBe("CF404");
  });

  it("claims what is due and pauses when its author becomes a Lector", async () => {
    await admin
      .from("ics_subscriptions")
      .update({ attempted_at: "2026-01-01T00:00:00Z" })
      .eq("calendar_id", calendarId);
    const due = await anonClient().rpc("ics_claim_due", {
      p_secret: SECRET,
      p_limit: 50,
    });
    expect(due.data?.map((row) => row.calendar_id)).toContain(calendarId);

    await admin
      .from("calendar_members")
      .update({ role: "viewer" })
      .eq("calendar_id", calendarId)
      .eq("user_id", editor.id);
    expect((await sub())?.state).toBe("paused");
  });

  it("stops keeping the events and drops the link from Vault", async () => {
    const { secret_id: secretId } = (await sub())!;
    const stopped = await owner.client.rpc("stop_ics_subscription", {
      p_calendar_id: calendarId,
    });
    expect(stopped.error).toBeNull();
    expect(await sub()).toBeNull();
    expect((await events()).length).toBe(5);
    const { data: left } = await admin.rpc("vault_secret_matches", {
      p_id: secretId,
      p_value: URL_ONE,
    });
    expect(left).toBe(false);
  });

  it("goes away with an orphaned calendar", async () => {
    const leaving = await createTestUser({ display_name: "Se va" });
    const orphan = await getOwnCalendarId(leaving.id);
    await admin
      .from("calendar_members")
      .insert({ calendar_id: orphan, user_id: viewer.id, role: "viewer" });
    const created = await leaving.client.rpc("create_ics_subscription", {
      p_calendar_id: orphan,
      p_url: URL_ONE,
      p_ids: [],
    });
    expect(created.error).toBeNull();
    const { error } = await leaving.client.rpc("delete_own_account");
    expect(error).toBeNull();
    const { data } = await admin
      .from("ics_subscriptions")
      .select("calendar_id")
      .eq("calendar_id", orphan);
    expect(data).toEqual([]);
    await admin.from("calendars").delete().eq("id", orphan);
    await deleteTestMail();
  });

  it("is scheduled every 15 minutes", async () => {
    const { data } = await admin.rpc("ics_scheduled_jobs");
    expect(data).toEqual([
      { jobname: "ics-refresh-due", schedule: "*/15 * * * *" },
    ]);
  });
});
