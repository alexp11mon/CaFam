// Spec 036, T10: Venito's cards in a real browser, without Groq. The answer
// of POST /api/assistant is replaced by one with a created event and a
// pending change, seeded for real, so "Confirmar" and "Deshacer" run the real
// Server Actions against the database. Takes the screenshots of P9 and
// checks what the buttons write.
//
//   npx next start -p 3100 &
//   node --env-file=.env.test.local scripts/assistant-cards.mjs <outDir>
//
// SHOTS_WIDTHS, SHOTS_THEMES and SHOTS_ACCENTS narrow the set, as in
// screenshots.mjs. It seeds a @cafam.test user and deletes it at the end.
import { mkdirSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const BASE = process.env.SHOTS_BASE ?? "http://localhost:3100";
const [outDir = "capturas"] = process.argv.slice(2);
const list = (name, fallback) => (process.env[name] ?? fallback).split(",");
const WIDTHS = list("SHOTS_WIDTHS", "390,768,1440").map(Number);
const THEMES = list("SHOTS_THEMES", "light,dark");
const ACCENTS = list("SHOTS_ACCENTS", "red,yellow");
const HEIGHT = { 390: 844, 768: 1024, 1440: 900 };
const ACCENT_NAME = { red: "violeta", yellow: "ambar" };

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

function check(condition, message) {
  if (!condition) throw new Error(`FALLO: ${message}`);
  console.log(`✓ ${message}`);
}

/** Next Thursday at a Madrid wall hour (UTC+1 in winter), as an ISO instant. */
function thursdayAt(hour, minute = 0) {
  const day = new Date();
  day.setUTCHours(0, 0, 0, 0);
  day.setUTCDate(day.getUTCDate() + ((4 - day.getUTCDay() + 7) % 7 || 7));
  return new Date(
    day.getTime() + ((hour - 1) * 60 + minute) * 60e3,
  ).toISOString();
}

async function insertEvent(row) {
  const { data, error } = await admin
    .from("events")
    .insert(row)
    .select("id, updated_at")
    .single();
  if (error) throw error;
  return data;
}

async function seed() {
  const email = `test-${randomUUID()}@cafam.test`;
  const password = "test-password-1234";
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: "Alex", time_zone: "Europe/Madrid" },
  });
  if (error) throw error;
  const userId = data.user.id;
  const { data: own } = await admin
    .from("calendars")
    .select("id")
    .eq("owner_id", userId)
    .single();
  await admin
    .from("calendars")
    .update({ name: "alexponmon@gmail.test", color: "#A0C4FF" })
    .eq("id", own.id);
  return { userId, email, password, calendarId: own.id };
}

/** The events of the two cards, fresh for each run of the buttons. */
async function cards(user) {
  const at = { calendar_id: user.calendarId, created_by: user.userId };
  await insertEvent({
    ...at,
    title: "PIAE",
    starts_at: thursdayAt(12),
    ends_at: thursdayAt(13, 30),
  });
  // What create_events would have written (spec 036 T4).
  const comida = await insertEvent({
    ...at,
    title: "Comida Uni",
    starts_at: thursdayAt(13, 30),
    ends_at: thursdayAt(14, 30),
  });
  const dentista = await insertEvent({
    ...at,
    title: "Dentista",
    location: "Clínica Sonrisas",
    starts_at: thursdayAt(17),
    ends_at: thursdayAt(18),
  });
  const card = (id, title, startsAt, endsAt, location = null) => ({
    id,
    title,
    startsAt,
    endsAt,
    allDay: false,
    calendarName: "alexponmon@gmail.test",
    color: "#A0C4FF",
    location,
  });
  const created = {
    kind: "created",
    key: randomUUID(),
    event: card(
      comida.id,
      "Comida Uni",
      thursdayAt(13, 30),
      thursdayAt(14, 30),
    ),
    anchor: {
      title: "PIAE",
      startsAt: thursdayAt(12),
      endsAt: thursdayAt(13, 30),
      allDay: false,
    },
    undo: { kind: "uncreate", id: comida.id, updatedAt: comida.updated_at },
  };
  const fields = {
    title: "Dentista",
    description: null,
    location: "Clínica Sonrisas",
    calendarId: user.calendarId,
    startsAt: new Date(Date.parse(thursdayAt(18))).toISOString(),
    endsAt: new Date(Date.parse(thursdayAt(19))).toISOString(),
    allDay: false,
  };
  const change = {
    kind: "change",
    key: randomUUID(),
    before: card(
      dentista.id,
      "Dentista",
      thursdayAt(17),
      thursdayAt(18),
      "Clínica Sonrisas",
    ),
    after: card(
      dentista.id,
      "Dentista",
      fields.startsAt,
      fields.endsAt,
      "Clínica Sonrisas",
    ),
    scope: null,
    change: {
      id: dentista.id,
      scope: null,
      updatedAt: dentista.updated_at,
      fields,
    },
  };
  return { created, change, comidaId: comida.id, dentistaId: dentista.id };
}

const ndjson = (lines) =>
  lines.map((line) => JSON.stringify(line)).join("\n") + "\n";

async function open(browser, user, { width, theme }) {
  const context = await browser.newContext({
    viewport: { width, height: HEIGHT[width] ?? 900 },
    deviceScaleFactor: Number(process.env.SHOTS_SCALE ?? 2),
    colorScheme: theme === "dark" ? "dark" : "light",
    isMobile: width < 500,
    hasTouch: width < 800,
  });
  const page = await context.newPage();
  if (process.env.SHOTS_DEBUG) {
    page.on("console", (m) => console.log("console:", m.text()));
    page.on(
      "request",
      (r) =>
        r.url().includes("/api/") && console.log("req:", r.method(), r.url()),
    );
  }
  await page.goto(`${BASE}/login`);
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Contraseña").fill(user.password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL(/dashboard/);
  return { context, page };
}

/** Asks Venito; the route answers with the two cards. */
async function ask(page, actions) {
  await page.route("**/api/assistant", (route) =>
    route.request().method() === "POST"
      ? route.fulfill({
          status: 200,
          headers: { "Content-Type": "application/x-ndjson; charset=utf-8" },
          body: ndjson([
            { type: "status", text: "Creando «Comida Uni»…" },
            ...actions.map((action) => ({ type: "action", action })),
            {
              type: "done",
              answer:
                "He creado Comida Uni justo al acabar PIAE. Para el dentista, revisa el cambio y pulsa Confirmar.",
              events: [],
              actions,
              remaining: 28,
            },
          ]),
        })
      : route.fulfill({ status: 204 }),
  );
  await page.goto(`${BASE}/dashboard/assistant`);
  // Typed before hydration, Enter would do nothing.
  await page.waitForTimeout(1500);
  const field = page.getByLabel("Tu pregunta").locator("visible=true");
  await field.fill(
    "Crea Comida Uni en alexponmon@gmail.test justo cuando acabe PIAE hasta las 14:30 y pasa el dentista a las 18:00",
  );
  await field.press("Enter");
  await page.getByText("Cambio pendiente").waitFor();
  await page.waitForTimeout(500);
}

const user = await seed();
const browser = await chromium.launch();
try {
  mkdirSync(outDir, { recursive: true });

  // 1. The buttons, against the database (RF-24a, RF-34, RF-35, RF-38).
  {
    const seeded = await cards(user);
    const { context, page } = await open(browser, user, {
      width: 390,
      theme: "light",
    });
    await ask(page, [seeded.created, seeded.change]);
    await page.getByRole("button", { name: "Confirmar" }).click();
    await page.getByText("Cambio aplicado").waitFor();
    const { data: moved } = await admin
      .from("events")
      .select("starts_at")
      .eq("id", seeded.dentistaId)
      .single();
    check(
      Date.parse(moved.starts_at) === Date.parse(thursdayAt(18)),
      "«Confirmar» mueve el dentista a las 18:00 en la base de datos",
    );
    await page.screenshot({ path: join(outDir, "aplicado-390-claro.png") });

    await page.getByRole("button", { name: "Deshacer" }).first().click();
    await page.getByText("Deshecho").first().waitFor();
    const { count } = await admin
      .from("events")
      .select("id", { count: "exact", head: true })
      .eq("id", seeded.comidaId);
    check(count === 0, "«Deshacer» borra la Comida Uni creada");

    await page.getByRole("button", { name: "Deshacer" }).click();
    await page.getByText("Deshecho").nth(1).waitFor();
    const { data: back } = await admin
      .from("events")
      .select("starts_at")
      .eq("id", seeded.dentistaId)
      .single();
    check(
      Date.parse(back.starts_at) === Date.parse(thursdayAt(17)),
      "«Deshacer» devuelve el dentista a las 17:00",
    );
    await context.close();
    await admin.from("events").delete().eq("calendar_id", user.calendarId);
  }

  // 2. "sí" confirms without asking Venito (RF-24a, plan D5).
  {
    const seeded = await cards(user);
    const { context, page } = await open(browser, user, {
      width: 1440,
      theme: "light",
    });
    await ask(page, [seeded.change]);
    let asked = 0;
    page.on("request", (request) => {
      if (
        request.url().endsWith("/api/assistant") &&
        request.method() === "POST"
      )
        asked++;
    });
    const field = page.getByLabel("Tu pregunta").locator("visible=true");
    await field.fill("sí");
    await field.press("Enter");
    await page.getByText("Hecho: he aplicado el cambio.").waitFor();
    check(asked === 0, "«sí» confirma sin llamar a la API del asistente");
    await context.close();
    await admin.from("events").delete().eq("calendar_id", user.calendarId);
  }

  // 3. The screenshots of P9.
  const seeded = await cards(user);
  for (const accent of ACCENTS) {
    await admin.from("profiles").update({ accent }).eq("id", user.userId);
    for (const theme of THEMES) {
      await admin.from("profiles").update({ theme }).eq("id", user.userId);
      for (const width of WIDTHS) {
        const { context, page } = await open(browser, user, { width, theme });
        await ask(page, [seeded.created, seeded.change]);
        // The two cards in view, as a person would scroll to them.
        await page
          .getByRole("region", { name: /Evento creado/ })
          .scrollIntoViewIfNeeded();
        const file = join(
          outDir,
          `tarjetas-${width}-${theme === "dark" ? "oscuro" : "claro"}-${ACCENT_NAME[accent] ?? accent}.png`,
        );
        await page.screenshot({ path: file });
        console.log(file);
        await context.close();
      }
    }
  }
} finally {
  await browser.close();
  await admin.auth.admin.deleteUser(user.userId);
  await admin.from("email_outbox").delete().like("to_email", "%@cafam.test");
}
