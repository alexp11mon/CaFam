// The whole app on an emulated iPhone (spec 029 CA-3): sign up, a calendar,
// an event created and moved, views and periods, Venito and its suggestions,
// a note with ticked items, Ajustes and the theme.
//
//   npx next start -p 3100 &
//   node --env-file=.env.test.local scripts/e2e-phone.mjs
//
// It signs up a @cafam.test user through the real form and deletes it at the
// end. With the mocked LLM of scripts/perf/mock-groq.mjs the assistant
// answers; without it (and without a Groq key) that step reports the error
// the chat shows. Chromium, not Safari: an approximation of the real phone.
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { createClient } from "@supabase/supabase-js";

const require = createRequire(import.meta.url);
const { chromium, devices } = require("playwright");

const BASE = process.env.E2E_BASE ?? "http://localhost:3100";
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);
const email = `test-${randomUUID()}@cafam.test`;
const results = [];
const errors = [];

async function step(name, run) {
  try {
    const detail = await run();
    results.push(["ok", name, detail ?? ""]);
  } catch (error) {
    results.push(["FALLO", name, String(error).split("\n")[0].slice(0, 160)]);
  }
}

const browser = await chromium.launch();
const context = await browser.newContext({ ...devices["iPhone 13"] });
const page = await context.newPage();
page.on("pageerror", (error) => errors.push(error.message));
const visible = (locator) => locator.locator("visible=true");
const bar = () =>
  visible(page.getByRole("navigation", { name: "Principal" })).first();
const dock = () => page.getByRole("navigation", { name: "Calendario" });

try {
  await step("Registrarse", async () => {
    await page.goto(`${BASE}/signup`);
    await page.getByLabel("Nombre visible").fill("Prueba");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Contraseña").fill("test-password-1234");
    await page.getByRole("button", { name: "Crear cuenta" }).tap();
    await page.waitForURL(/dashboard\/calendar/);
  });

  await step("Crear un calendario", async () => {
    await bar().getByRole("link", { name: "Calendarios" }).tap();
    await visible(page.getByRole("link", { name: "Nuevo calendario" })).tap();
    await visible(page.getByLabel("Nombre")).fill("Clase");
    await visible(page.getByRole("button", { name: "Crear calendario" })).tap();
    await visible(page.getByText("Clase")).first().waitFor();
  });

  await step("Crear un evento tocando un hueco", async () => {
    await bar().getByRole("link", { name: "Calendario" }).tap();
    await dock()
      .getByRole("button", { name: /^Vista/ })
      .tap();
    await page
      .getByRole("list", { name: "Vistas" })
      .getByRole("link", { name: "Día" })
      .tap();
    await visible(page.locator("[data-time-col]"))
      .first()
      .tap({ position: { x: 120, y: 180 } });
    await visible(page.getByLabel("Título")).fill("Examen");
    await visible(page.getByRole("button", { name: "Guardar" })).tap();
    await visible(page.locator("[data-event-id]").filter({ hasText: "Examen" }))
      .first()
      .waitFor();
  });

  await step("Mover el evento (Alt + flecha)", async () => {
    const event = visible(
      page.locator("[data-event-id]").filter({ hasText: "Examen" }),
    ).first();
    const before = (await event.boundingBox()).y;
    await event.focus();
    await page.keyboard.press("Alt+ArrowDown");
    await page.keyboard.press("Alt+ArrowDown");
    await page.waitForTimeout(1500);
    const after = (await event.boundingBox()).y;
    if (!(after > before)) throw new Error("el evento no se movió");
    return `${Math.round(after - before)} px más abajo`;
  });

  await step("Cambiar de vista y de periodo", async () => {
    await dock()
      .getByRole("button", { name: /^Vista/ })
      .tap();
    await page
      .getByRole("list", { name: "Vistas" })
      .getByRole("link", { name: "Mes" })
      .tap();
    await page.waitForURL(/view=month/);
    const first = page.url();
    await dock().getByRole("button", { name: "Mes siguiente" }).tap();
    await page.waitForFunction((url) => location.href !== url, first);
    const next = page.url().split("date=")[1];
    await dock().getByRole("button", { name: /^Hoy/ }).tap();
    await page.waitForTimeout(400);
    return `siguiente ${next}, hoy ${page.url().split("date=")[1]}`;
  });

  await step("Venito y una sugerencia", async () => {
    await page.getByRole("button", { name: /^Venito/ }).tap();
    await page.getByLabel("Tu pregunta").waitFor();
    await page.getByRole("button", { name: "¿Qué tengo hoy?" }).tap();
    const log = page.getByRole("log");
    await log.getByText("¿Qué tengo hoy?").waitFor();
    const answered = await Promise.race([
      log
        .locator(".self-start")
        .first()
        .waitFor({ timeout: 20000 })
        .then(() => "respuesta"),
      page
        .getByRole("alert")
        .first()
        .waitFor({ timeout: 20000 })
        .then(() => "aviso de error"),
    ]);
    await page.getByRole("button", { name: "Cerrar el chat" }).tap();
    return answered;
  });

  await step("Crear una nota y marcar tareas", async () => {
    await bar().getByRole("link", { name: "Notas" }).tap();
    await bar().getByRole("link", { name: "Nueva nota" }).tap();
    await visible(page.getByLabel("Título (opcional)")).fill("Deberes");
    await visible(page.getByRole("button", { name: "Crear nota" })).tap();
    await page.waitForURL(/notes\/[0-9a-f-]{36}/);
    const adder = visible(page.getByLabel("Añadir elemento"));
    for (const text of ["Mates", "Lengua", "Inglés"]) {
      await adder.fill(text);
      await adder.press("Enter");
    }
    await page.getByRole("checkbox", { name: "Mates" }).tap();
    await page.getByText("Completadas: 1 de 3").waitFor();
    return "1 de 3";
  });

  await step("Ajustes y tema oscuro", async () => {
    await bar().getByRole("button", { name: "Más" }).tap();
    await page
      .getByRole("dialog", { name: "Más" })
      .getByRole("link", { name: "Ajustes" })
      .tap();
    await page.waitForURL(/settings/);
    await visible(page.getByText("Oscuro", { exact: true }))
      .first()
      .tap();
    await page.waitForFunction(
      () => document.documentElement.dataset.theme === "dark",
    );
    return "tema oscuro aplicado";
  });
} finally {
  await browser.close();
  const { data } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const user = data?.users.find((candidate) => candidate.email === email);
  if (user) await admin.auth.admin.deleteUser(user.id);
  await admin.from("email_outbox").delete().like("to_email", "%@cafam.test");
}

for (const [state, name, detail] of results) {
  console.log(`${state.padEnd(5)} ${name}${detail ? ` — ${detail}` : ""}`);
}
if (errors.length) console.log("Errores de la página:", errors);
process.exit(
  results.some(([state]) => state !== "ok") || errors.length ? 1 : 0,
);
