// Spec 040, T7: a real Web Push end to end with Edge. Signs a user up, turns
// the notices on in Ajustes (the real push service of the browser), creates an
// event 10 minutes ahead (its default reminder is due now), calls
// /api/push/run by hand (pg_cron does not reach localhost) and checks that
// the service worker showed the notification. Then it sends a social notice.
//
//   node scripts/make-vapid-keys.mjs > vapid.env    (once; never commit it)
//   set the two keys and VAPID_SUBJECT in the environment, then
//   npm run build && npx next start -p 3100 &
//   NODE_PATH=<global node_modules> node --env-file=.env.test.local scripts/e2e-push.mjs
import { randomUUID } from "node:crypto";
import { mkdtempSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const BASE = process.env.E2E_BASE ?? "http://localhost:3100";
const OUT = "specs/040-recordatorios-y-notificaciones/capturas";
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const email = `test-${randomUUID()}@cafam.test`;
const results = [];
const step = (name, ok, extra = "") => {
  results.push(ok);
  console.log(ok ? "ok" : "FALLO", name, extra);
};

async function run() {
  const response = await fetch(`${BASE}/api/push/run`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
  });
  return response.json();
}

/** The notifications the service worker is showing now. */
const shown = (page) =>
  page.evaluate(async () => {
    const reg = await navigator.serviceWorker.ready;
    const list = await reg.getNotifications();
    return list.map((n) => ({ title: n.title, body: n.body, data: n.data }));
  });

mkdirSync(OUT, { recursive: true });
const context = await chromium.launchPersistentContext(
  mkdtempSync(join(tmpdir(), "cafam-push-")),
  {
    channel: process.env.E2E_CHANNEL ?? "msedge",
    headless: false,
    viewport: { width: 1440, height: 900 },
  },
);
await context.grantPermissions(["notifications"], { origin: BASE });
let userId;
try {
  const page = context.pages()[0] ?? (await context.newPage());
  page.setDefaultTimeout(30_000);
  await page.goto(`${BASE}/signup`);
  await page.getByLabel("Nombre visible").fill("Ana Avisos");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Contraseña").fill("test-password-1234");
  await page.getByRole("button", { name: "Crear cuenta" }).click();
  await page.waitForURL("**/dashboard/calendar**");
  const { data: users } = await admin.auth.admin.listUsers({ perPage: 1000 });
  userId = users.users.find((u) => u.email === email).id;

  // The service worker registers on load in production.
  await page.goto(`${BASE}/dashboard/settings`);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page
    .getByRole("button", { name: "Activar en este dispositivo" })
    .click();
  await page.getByText("Este dispositivo recibe avisos.").waitFor();
  const { data: subs } = await admin
    .from("push_subscriptions")
    .select("endpoint, device")
    .eq("user_id", userId);
  step(
    "suscripción guardada",
    subs?.length === 1,
    `${subs?.[0]?.device} · ${new URL(subs?.[0]?.endpoint ?? "https://x").host}`,
  );

  await page.getByRole("button", { name: "Enviar un aviso de prueba" }).click();
  await page.getByText("Aviso enviado.").waitFor();
  await wait(3000);
  const test = await shown(page);
  step(
    "aviso de prueba",
    test.some((n) => n.title === "CaFam"),
  );

  // An event 10 minutes ahead, created in the app: its default reminder
  // (10 minutes before) is due now.
  const start = new Date(Date.now() + 10 * 60_000);
  const date = start.toLocaleDateString("sv-SE", { timeZone: "Europe/Madrid" });
  const time = start.toLocaleTimeString("es-ES", {
    timeZone: "Europe/Madrid",
    hour: "2-digit",
    minute: "2-digit",
  });
  await page.goto(
    `${BASE}/dashboard/events/new?date=${date}&start=${time}&title=Cena%20de%20prueba`,
  );
  await page.getByRole("group", { name: "Avisos" }).waitFor();
  await page.getByRole("button", { name: "Crear evento" }).click();
  await page.waitForURL(/\/dashboard\/events\/[0-9a-f-]{36}$/);
  const { data: event, error } = await admin
    .from("event_reminders")
    .select("event_id, minutes")
    .eq("event_id", page.url().split("/").pop())
    .single();
  step(
    "recordatorio por defecto",
    !error && event?.minutes?.[0] === 10,
    JSON.stringify(event?.minutes),
  );

  await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.ready;
    for (const n of await reg.getNotifications()) n.close();
  });
  const first = await run();
  const second = await run();
  await wait(4000);
  const reminder = await shown(page);
  step(
    "recordatorio enviado una vez",
    first.sent === 1 && second.sent === 0,
    `${JSON.stringify(first)} ${JSON.stringify(second)}`,
  );
  const notice = reminder.find((n) => n.title === "Cena de prueba");
  step("notificación mostrada", Boolean(notice), notice?.body ?? "");
  step(
    "abre el detalle",
    notice?.data?.url === `/dashboard/events/${event?.event_id}`,
    notice?.data?.url ?? "",
  );

  // What the notification opens (pressing a system toast cannot be scripted).
  if (notice) {
    await page.goto(`${BASE}${notice.data.url}`);
    await page.getByRole("group", { name: "Avisarme" }).waitFor();
    await wait(500);
    await page.screenshot({ path: `${OUT}/prueba-real-detalle-1440.png` });
  }
} finally {
  await context.close();
  if (userId) await admin.auth.admin.deleteUser(userId);
}
const failed = results.filter((ok) => !ok).length;
console.log(
  failed
    ? `${failed} pasos fallidos`
    : `${results.length}/${results.length} pasos`,
);
process.exit(failed ? 1 : 0);
