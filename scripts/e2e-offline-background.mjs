// Sending with the app closed (spec 035 T12, RF-41 to RF-43) in Edge on the
// desktop: a comment and an event change made offline, the page closed, the
// network back with no page open, and then the server has them; opening the
// app again says "N cambios sincronizados".
//
//   npx next start -p 3100 &
//   NODE_PATH=<global playwright> node --env-file=.env.test.local scripts/e2e-offline-background.mjs
//
// The @cafam.test user is deleted at the end.
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { createClient } from "@supabase/supabase-js";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const BASE = process.env.E2E_BASE ?? "http://localhost:3100";
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);
const email = `test-${randomUUID()}@cafam.test`;
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const visible = (locator) => locator.locator("visible=true").first();
const results = [];

async function step(name, run) {
  try {
    results.push(["ok", name, (await run()) ?? ""]);
  } catch (error) {
    results.push(["FALLO", name, String(error).split("\n")[0].slice(0, 200)]);
  }
}

const browser = await chromium.launch({
  channel: process.env.E2E_CHANNEL ?? "msedge",
});
const context = await browser.newContext({
  viewport: { width: 1280, height: 900 },
});
let page = await context.newPage();
page.setDefaultTimeout(20_000);
let eventId;

try {
  await step("registro y evento con red", async () => {
    await page.goto(`${BASE}/signup`);
    await page.getByLabel("Nombre visible").fill("Envío cerrado");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Contraseña").fill("test-password-1234");
    await page.getByRole("button", { name: "Crear cuenta" }).click();
    await page.waitForURL("**/dashboard/calendar**");
    const { data: user } = await admin
      .from("profiles")
      .select("id")
      .eq("display_name", "Envío cerrado")
      .single();
    const { data: calendar } = await admin
      .from("calendars")
      .select("id")
      .eq("owner_id", user.id)
      .single();
    const start = new Date();
    start.setUTCHours(start.getUTCHours() + 3, 0, 0, 0);
    const { data: event, error } = await admin
      .from("events")
      .insert({
        calendar_id: calendar.id,
        title: "Reunión",
        starts_at: start.toISOString(),
        ends_at: new Date(start.getTime() + 3_600_000).toISOString(),
        all_day: false,
        created_by: user.id,
      })
      .select("id")
      .single();
    if (error) throw error;
    eventId = event.id;
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.evaluate(
      () =>
        new Promise((resolve) => {
          const del = indexedDB.deleteDatabase("cafam-offline");
          del.onsuccess = del.onerror = del.onblocked = () => resolve();
        }),
    );
    await page.reload();
    await page.evaluate(() => navigator.serviceWorker.ready);
    await wait(4000);
  });

  await context.setOffline(true);

  await step("comentario sin red", async () => {
    await page.goto(`${BASE}/dashboard/events/${eventId}`);
    const box = visible(page.getByLabel("Escribe un comentario"));
    await box.fill("Enviado con la app cerrada");
    await box.press("Control+Enter");
    await visible(page.getByText("Pendiente de enviar")).waitFor();
    // The sync tag was asked for when the change was queued (RF-41).
    return String(
      await page.evaluate(async () => {
        const registration = await navigator.serviceWorker.ready;
        return registration.sync
          ? (await registration.sync.getTags()).join(",")
          : "sin Background Sync";
      }),
    );
  });

  await step("cerrar la app y volver la red", async () => {
    await page.close();
    await context.setOffline(false);
    for (let i = 0; i < 90; i++) {
      const { data } = await admin
        .from("event_comments")
        .select("body")
        .eq("event_id", eventId);
      if (data?.some((row) => row.body === "Enviado con la app cerrada")) {
        return `llegó en ${i} s sin ninguna página abierta`;
      }
      await wait(1000);
    }
    throw new Error("no llegó en 90 s con la app cerrada");
  });

  await step("al abrir, el aviso", async () => {
    page = await context.newPage();
    await page.goto(`${BASE}/dashboard/calendar`);
    await visible(page.getByText(/1 cambio sincronizado/)).waitFor();
  });
} finally {
  await browser.close();
  const { data } = await admin.auth.admin.listUsers({ perPage: 1000 });
  for (const user of data.users) {
    if (user.email === email) await admin.auth.admin.deleteUser(user.id);
  }
}

for (const [status, name, detail] of results) {
  console.log(`${status.padEnd(5)} ${name}${detail ? ` — ${detail}` : ""}`);
}
process.exit(results.some(([status]) => status !== "ok") ? 1 : 0);
