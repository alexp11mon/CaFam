import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, expect, it } from "vitest";
import { AssistantUnavailable, chat } from "@/lib/assistant/provider";
import { runAssistant } from "@/lib/assistant/run";
import { runTool } from "@/lib/assistant/tools";
import {
  PRIVATE_TITLES,
  QUESTIONS,
  type EvalResult,
} from "../tests/assistant-eval/questions";
import {
  admin,
  createTestUser,
  deleteTestMail,
  deleteTestUser,
  getOwnCalendarId,
  type TestUser,
} from "../tests/integration/helpers";

// Spec 015, T12: `npm run eval:assistant`. Seeds a @cafam.test user in dev,
// asks every question to the real provider (Groq) and checks the answers.
// Not part of `npm test` nor `test:db`: it needs the network and spends quota.

const TZ = "Europe/Madrid";
const NOW = new Date("2026-11-02T09:00:00Z"); // Monday 10:00 in Madrid
// The free tier allows 8K tokens a minute and a question takes 1-3K.
const PAUSE_MS = 20_000;
const LATENCY_MS = 10_000;

let asker: TestUser;
let others: TestUser[] = [];

const at = (day: string, from: string, to: string) => ({
  starts_at: `${day}T${from}:00+01:00`,
  ends_at: `${day}T${to}:00+01:00`,
});

beforeAll(async () => {
  const [marta, luis, ana, sam, pabloG, pabloS] = await Promise.all([
    createTestUser({ display_name: "Marta" }),
    createTestUser({ display_name: "Luis Pérez" }),
    createTestUser({ display_name: "Ana" }),
    createTestUser({ display_name: "Sam" }),
    createTestUser({ display_name: "Pablo García" }),
    createTestUser({ display_name: "Pablo Sanz" }),
  ]);
  asker = marta!;
  others = [luis!, ana!, sam!, pabloG!, pabloS!];
  const [family, luisCal, anaCal, samCal] = await Promise.all(
    [asker, luis!, ana!, sam!].map((user) => getOwnCalendarId(user.id)),
  );
  await admin.from("calendars").update({ name: "Familia" }).eq("id", family);

  const { data: hidden } = await admin
    .from("calendars")
    .insert({ owner_id: asker.id, name: "Trabajo" })
    .select("id")
    .single();
  const { data: google } = await admin
    .from("calendars")
    .insert({ owner_id: asker.id, name: "Google" })
    .select("id")
    .single();
  const { data: connection } = await admin
    .from("calendar_connections")
    .insert({
      owner_id: asker.id,
      provider: "google",
      account_subject: `sub-${randomUUID()}`,
      account_email: "marta@gmail.test",
    })
    .select("id")
    .single();
  await admin.from("synced_calendars").insert({
    calendar_id: google!.id,
    connection_id: connection!.id,
    provider: "google",
    external_id: `cal-${randomUUID()}`,
  });
  await admin
    .from("calendar_preferences")
    .insert({ user_id: asker.id, calendar_id: hidden!.id, visible: false });

  await admin.from("calendar_members").insert([
    { calendar_id: family, user_id: luis!.id, role: "editor" },
    { calendar_id: family, user_id: ana!.id, role: "viewer" },
    { calendar_id: family, user_id: pabloG!.id, role: "viewer" },
    { calendar_id: family, user_id: pabloS!.id, role: "viewer" },
  ]);
  await admin
    .from("profiles")
    .update({ share_availability: true })
    .in("id", [luis!.id, sam!.id, pabloG!.id, pabloS!.id]);

  const { error } = await admin.from("events").insert(
    [
      {
        calendar_id: family,
        title: "Fútbol de Pablo",
        location: "Polideportivo",
        ...at("2026-11-07", "10:00", "11:30"),
      },
      {
        calendar_id: family,
        title: "Comida con los abuelos",
        ...at("2026-11-08", "14:00", "16:00"),
      },
      {
        calendar_id: hidden!.id,
        title: "Dentista",
        ...at("2026-11-07", "17:00", "18:00"),
      },
      {
        calendar_id: google!.id,
        title: "Reunión de Google",
        external_id: `ev-${randomUUID()}`,
        ...at("2026-11-07", "12:00", "13:00"),
      },
      {
        calendar_id: family,
        title: "Vacunas del perro",
        ...at("2026-11-05", "09:30", "10:00"),
      },
      {
        calendar_id: family,
        title: "Cumpleaños de Pablo",
        all_day: true,
        starts_at: "2026-11-21T00:00:00Z",
        ends_at: "2026-11-22T00:00:00Z",
      },
      {
        calendar_id: family,
        title: "Cumpleaños de Ana",
        all_day: true,
        starts_at: "2026-12-14T00:00:00Z",
        ends_at: "2026-12-15T00:00:00Z",
      },
      {
        calendar_id: family,
        title: "Clase de inglés",
        ...at("2026-11-03", "18:00", "19:00"),
        recurrence: "FREQ=WEEKLY;BYDAY=TU",
        recurrence_tz: TZ,
      },
      {
        calendar_id: family,
        title: "Cena de pasta fresca",
        ...at("2026-11-20", "20:00", "21:00"),
      },
      {
        calendar_id: family,
        title: "Reunión del cole",
        ...at("2026-11-09", "16:00", "18:00"),
      },
      {
        calendar_id: luisCal,
        title: "Médico secreto",
        location: "Clínica",
        ...at("2026-11-09", "19:00", "21:00"),
      },
      {
        calendar_id: anaCal,
        title: "Privado de Ana",
        ...at("2026-11-10", "16:00", "21:00"),
      },
      {
        calendar_id: samCal,
        title: "De Sam",
        ...at("2026-11-09", "16:00", "21:00"),
      },
    ],
    { defaultToNull: false },
  );
  if (error) throw error;
  const shifts = await admin.from("events").insert(
    Array.from({ length: 60 }, (_, i) => {
      const hour = String(8 + Math.floor(i / 6)).padStart(2, "0");
      const minute = (i % 6) * 10;
      return {
        calendar_id: hidden!.id,
        title: `Turno ${i + 1}`,
        ...at(
          "2026-11-25",
          `${hour}:${String(minute).padStart(2, "0")}`,
          `${hour}:${String(minute + 5).padStart(2, "0")}`,
        ),
      };
    }),
  );
  if (shifts.error) throw shifts.error;

  // T15: an EOI series on Tuesdays and Thursdays whose two classes of this
  // week say she will not go, as materialize_occurrence leaves them (RF-37).
  const { data: eoi, error: eoiError } = await admin
    .from("events")
    .insert({
      calendar_id: family,
      title: "EOI Inglés",
      ...at("2026-11-03", "09:15", "11:15"),
      recurrence: "FREQ=WEEKLY;BYDAY=TU,TH",
      recurrence_tz: TZ,
    })
    .select("id")
    .single();
  if (eoiError) throw eoiError;
  const { data: classes, error: classesError } = await admin
    .from("events")
    .insert(
      ["2026-11-03", "2026-11-05"].map((day) => ({
        calendar_id: family,
        series_id: eoi.id,
        title: "EOI Inglés",
        original_start: `${day}T08:15:00Z`,
        ...at(day, "09:15", "11:15"),
      })),
    )
    .select("id");
  if (classesError) throw classesError;
  const { data: commented, error: commentedError } = await admin
    .from("events")
    .select("id, title")
    .in("title", ["Cumpleaños de Ana", "De Sam"]);
  if (commentedError) throw commentedError;
  const idOf = (title: string) =>
    commented.find((row) => row.title === title)!.id;
  const comment = (eventId: string, authorId: string, body: string) => ({
    event_id: eventId,
    author_id: authorId,
    body,
    client_id: randomUUID(),
  });
  const comments = await admin
    .from("event_comments")
    .insert([
      ...classes.map((row) =>
        comment(row.id, asker.id, "No voy a poder ir, tengo médico"),
      ),
      comment(idOf("Cumpleaños de Ana"), asker.id, "Llevaré la tarta"),
      comment(
        idOf("Cumpleaños de Ana"),
        luis!.id,
        "Yo llevo las velas y los globos",
      ),
      comment(idOf("De Sam"), sam!.id, "Llevo la tarta secreta"),
    ]);
  if (comments.error) throw comments.error;
}, 120_000);

afterAll(async () => {
  await Promise.all([asker, ...others].map((user) => deleteTestUser(user.id)));
  await deleteTestMail();
});

const sleep = (ms: number) => new Promise((done) => setTimeout(done, ms));

// Which models answered the current question; EVAL_MODEL forces one, to
// measure the fallback model on its own.
let answeredBy = new Set<string>();
const recordingFetch: typeof fetch = async (input, init) => {
  const body = JSON.parse(String(init?.body)) as { model: string };
  if (process.env.EVAL_MODEL) body.model = process.env.EVAL_MODEL;
  const response = await fetch(input, { ...init, body: JSON.stringify(body) });
  if (response.ok) answeredBy.add(body.model.split("/")[1] ?? body.model);
  return response;
};

async function ask(index: number): Promise<{ result: EvalResult; ms: number }> {
  const { question, before = [] } = QUESTIONS[index]!;
  answeredBy = new Set();
  const started = performance.now();
  const result = await runAssistant(
    [...before, { role: "user", content: question }],
    {
      chat: (messages, tools, signal, requireTool) =>
        chat(messages, tools, signal, requireTool, recordingFetch),
      runTool: (name, args, refs) =>
        runTool(name, args, {
          supabase: asker.client,
          userId: asker.id,
          timeZone: TZ,
          now: NOW,
          refs,
          excludeSynced: false,
        }),
      now: NOW,
      timeZone: TZ,
    },
  );
  return { result, ms: performance.now() - started };
}

// EVAL_ONLY=36-39 asks only those questions (1-based, inclusive), to check a
// prompt change without spending a whole run of the shared Groq quota.
const [onlyFrom, onlyTo] = (process.env.EVAL_ONLY ?? "").split("-").map(Number);
const SELECTED = [...QUESTIONS.entries()].filter(
  ([index]) =>
    !onlyFrom || (index + 1 >= onlyFrom && index + 1 <= (onlyTo || onlyFrom)),
);

it(
  "answers the evaluation questions",
  async () => {
    let right = 0;
    let invented = 0;
    let retries = 0;
    const times: number[] = [];
    for (const [position, [index, item]] of SELECTED.entries()) {
      if (position > 0) await sleep(PAUSE_MS);
      let outcome;
      try {
        outcome = await ask(index);
      } catch (error) {
        // A 429 on both models is the batch hitting the per-minute limit, not
        // what a user asking one question at a time sees: wait and ask again.
        if (!(error instanceof AssistantUnavailable)) throw error;
        retries++;
        await sleep(60_000);
        outcome = await ask(index).catch((again: unknown) => String(again));
      }
      if (typeof outcome === "string") {
        console.log(
          `✗ ${index + 1}. ${item.question}\n    sin respuesta: ${String(outcome)}`,
        );
        continue;
      }
      const { result, ms } = outcome;
      times.push(ms);
      const leaked = PRIVATE_TITLES.filter((title) =>
        result.answer.includes(title),
      );
      const madeUp = item.noEvents && result.events.length > 0;
      if (leaked.length || madeUp) invented++;
      const failures = [
        ...item.checks.map((check) => check(result)),
        leaked.length ? `revela ${leaked.join(", ")}` : null,
        madeUp ? "cita eventos que no hay" : null,
      ].filter(Boolean);
      if (failures.length === 0) right++;
      console.log(
        `${failures.length ? "✗" : "✓"} ${index + 1}. ${item.question} (${(ms / 1000).toFixed(1)} s, ${[...answeredBy].join(" + ")})\n    ${result.answer.replace(/\n/g, " ")}${failures.length ? `\n    FALLO: ${failures.join("; ")}` : ""}`,
      );
    }

    const sorted = [...times].sort((a, b) => a - b);
    const p90 = sorted[Math.ceil(sorted.length * 0.9) - 1] ?? Infinity;
    const fast = times.filter((ms) => ms < LATENCY_MS).length / SELECTED.length;
    const accuracy = right / SELECTED.length;
    console.log(
      `\nAciertos: ${right}/${SELECTED.length} (${Math.round(accuracy * 100)} %). Inventados o revelados: ${invented}. ` +
        `Por debajo de 10 s: ${Math.round(fast * 100)} % (p90 ${(p90 / 1000).toFixed(1)} s). Reintentos por el límite por minuto: ${retries}.`,
    );
    expect(accuracy).toBeGreaterThanOrEqual(0.9);
    expect(invented).toBe(0);
    expect(fast).toBeGreaterThanOrEqual(0.9);
  },
  60 * 60_000,
);
