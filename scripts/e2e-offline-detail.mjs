// The event detail without a connection in a real browser (spec 035 T10):
// saved comments and thumbnails from the copy, a comment and an image added
// offline with "Pendiente de enviar", and both on the server once the
// network is back. At 390 px and at 1440 px.
//
//   npx next start -p 3100 &
//   node --env-file=.env.test.local scripts/e2e-offline-detail.mjs
//
// E2E_SHOTS=<folder> keeps a screenshot of the detail offline at each width.
// It signs up a @cafam.test user through the real form and deletes it at the end.
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { createClient } from "@supabase/supabase-js";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const BASE = process.env.E2E_BASE ?? "http://localhost:3100";
const SHOTS = process.env.E2E_SHOTS;
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);
const email = `test-${randomUUID()}@cafam.test`;
const results = [];
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const visible = (locator) => locator.locator("visible=true").first();

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

async function run(width, height, mobile) {
  const context = await browser.newContext({
    viewport: { width, height },
    isMobile: mobile,
    hasTouch: mobile,
  });
  const page = await context.newPage();
  const label = `${width} px`;
  let eventId;
  let userId;

  await step(`${label}: registro, evento y comentario con red`, async () => {
    await page.goto(`${BASE}/signup`);
    await page.getByLabel("Nombre visible").fill(`Detalle ${width}`);
    await page.getByLabel("Email").fill(`${width}-${email}`);
    await page.getByLabel("Contraseña").fill("test-password-1234");
    await page.getByRole("button", { name: "Crear cuenta" }).click();
    await page.waitForURL("**/dashboard/calendar**");
    const { data: user } = await admin
      .from("profiles")
      .select("id")
      .eq("display_name", `Detalle ${width}`)
      .single();
    userId = user.id;
    const { data: calendar } = await admin
      .from("calendars")
      .select("id")
      .eq("owner_id", userId)
      .single();
    const start = new Date();
    start.setUTCHours(start.getUTCHours() + 2, 0, 0, 0);
    const { data: event, error } = await admin
      .from("events")
      .insert({
        calendar_id: calendar.id,
        title: "Dentista",
        starts_at: start.toISOString(),
        ends_at: new Date(start.getTime() + 3_600_000).toISOString(),
        all_day: false,
        created_by: userId,
      })
      .select("id")
      .single();
    if (error) throw error;
    eventId = event.id;
    const { error: commentError } = await admin.from("event_comments").insert({
      event_id: eventId,
      author_id: userId,
      client_id: randomUUID(),
      body: "Llevar la tarjeta",
    });
    if (commentError) throw commentError;
  });

  await step(`${label}: copia en el dispositivo`, async () => {
    await page.evaluate(() => navigator.serviceWorker.ready);
    // The first copy may predate the comment, and it is only renewed every
    // 15 minutes: start from none so the app reads it whole.
    await page.evaluate(
      () =>
        new Promise((resolve) => {
          const del = indexedDB.deleteDatabase("cafam-offline");
          del.onsuccess = del.onerror = del.onblocked = () => resolve();
        }),
    );
    await page.reload();
    await page.evaluate(() => navigator.serviceWorker.ready);
    // The copy is read on opening; give it time to include the comment.
    for (let i = 0; i < 30; i++) {
      const has = await page.evaluate(
        () =>
          new Promise((resolve) => {
            const open = indexedDB.open("cafam-offline");
            open.onsuccess = () => {
              const db = open.result;
              if (!db.objectStoreNames.contains("snapshot")) {
                db.close();
                return resolve(false);
              }
              const read = db
                .transaction("snapshot")
                .objectStore("snapshot")
                .getAll();
              read.onsuccess = () => {
                db.close();
                resolve(
                  Boolean(
                    (
                      read.result[0]?.comments ??
                      read.result[0]?.snapshot?.comments
                    )?.length,
                  ),
                );
              };
            };
          }),
      );
      if (has) return;
      await wait(500);
    }
    throw new Error("la copia no tiene el comentario");
  });

  await context.setOffline(true);

  await step(`${label}: comentario guardado sin red`, async () => {
    await page.goto(`${BASE}/dashboard/events/${eventId}`);
    await visible(page.getByText("Llevar la tarjeta")).waitFor({
      timeout: 15_000,
    });
  });

  await step(`${label}: comentar sin red`, async () => {
    const box = visible(page.getByLabel("Escribe un comentario"));
    await box.fill("Voy en metro");
    // Ctrl+Intro sends (spec 014): the floating bar can cover the button at 390 px.
    await box.press("Control+Enter");
    await visible(page.getByText("Voy en metro")).waitFor();
    await visible(page.getByText("Pendiente de enviar")).waitFor();
  });

  await step(`${label}: añadir una imagen sin red`, async () => {
    const chooser = page.waitForEvent("filechooser");
    await visible(
      page.getByRole("button", { name: "Añadir imágenes" }),
    ).click();
    await (await chooser).setFiles("public/icons/icon-512.png");
    await visible(
      page.getByText(/guardada para enviar con conexión/),
    ).waitFor();
    await visible(page.getByRole("button", { name: /^Quitar/ })).waitFor();
  });

  if (SHOTS) {
    await page.screenshot({
      path: `${SHOTS}/detalle-sin-red-${width}.png`,
      fullPage: true,
    });
  }

  await context.setOffline(false);

  await step(`${label}: al volver la red llegan`, async () => {
    for (let i = 0; i < 60; i++) {
      const [{ data: comments }, { data: images }] = await Promise.all([
        admin.from("event_comments").select("body").eq("event_id", eventId),
        admin
          .from("event_images")
          .select("id")
          .eq("event_id", eventId)
          .eq("status", "ready"),
      ]);
      if (comments?.length === 2 && images?.length === 1) {
        return `${comments.length} comentarios · ${images.length} imagen`;
      }
      await wait(1000);
    }
    throw new Error("la cola no llegó al servidor en 60 s");
  });

  await context.close();
}

try {
  await run(390, 844, true);
  await run(1440, 900, false);
} finally {
  await browser.close();
  const { data } = await admin.auth.admin.listUsers({ perPage: 1000 });
  for (const user of data.users) {
    if (user.email?.endsWith(email)) await admin.auth.admin.deleteUser(user.id);
  }
}

for (const [status, name, detail] of results) {
  console.log(`${status.padEnd(5)} ${name}${detail ? ` — ${detail}` : ""}`);
}
process.exit(results.some(([status]) => status !== "ok") ? 1 : 0);
