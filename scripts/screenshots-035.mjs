// Screenshots of spec 035 (T12): the detail without a connection (gallery
// with a pending image, a saved and a pending comment) and the "Cambios"
// sheet with a series conflict, at 390, 768 and 1440 px, light and dark.
//
//   npx next start -p 3100 &
//   NODE_PATH=<global playwright> node --env-file=.env.test.local scripts/screenshots-035.mjs
//
// Into specs/035-sin-conexion-fase-2/capturas/. The @cafam.test user is
// deleted at the end.
import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { createClient } from "@supabase/supabase-js";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const BASE = process.env.E2E_BASE ?? "http://localhost:3100";
const OUT = "specs/035-sin-conexion-fase-2/capturas";
mkdirSync(OUT, { recursive: true });
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);
const email = `test-${randomUUID()}@cafam.test`;
const visible = (locator) => locator.locator("visible=true").first();
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const BASE_FIELDS = {
  title: "Inglés",
  calendarId: "c1",
  allDay: false,
  startsAt: "2026-11-23T17:00:00Z",
  endsAt: "2026-11-23T18:00:00Z",
  description: null,
  location: "EOI",
  color: null,
  categoryId: null,
};

const browser = await chromium.launch({
  channel: process.env.E2E_CHANNEL ?? "msedge",
});
try {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  page.setDefaultTimeout(20_000);

  await page.goto(`${BASE}/signup`);
  await page.getByLabel("Nombre visible").fill("Ana Capturas");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Contraseña").fill("test-password-1234");
  await page.getByRole("button", { name: "Crear cuenta" }).click();
  await page.waitForURL("**/dashboard/calendar**");

  const { data: user } = await admin
    .from("profiles")
    .select("id")
    .eq("display_name", "Ana Capturas")
    .single();
  const { data: calendar } = await admin
    .from("calendars")
    .select("id")
    .eq("owner_id", user.id)
    .single();
  const start = new Date();
  start.setUTCDate(start.getUTCDate() + 1);
  start.setUTCHours(16, 0, 0, 0);
  const { data: event } = await admin
    .from("events")
    .insert({
      calendar_id: calendar.id,
      title: "Cumpleaños de Lucía",
      location: "Casa de los abuelos",
      starts_at: start.toISOString(),
      ends_at: new Date(start.getTime() + 7_200_000).toISOString(),
      all_day: false,
      created_by: user.id,
    })
    .select("id")
    .single();
  await admin.from("event_comments").insert({
    event_id: event.id,
    author_id: user.id,
    client_id: randomUUID(),
    body: "¿Alguien lleva la tarta?",
  });

  // A whole copy with the comment, and a series conflict to show.
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
  await page.evaluate(
    ({ base }) =>
      new Promise((resolve, reject) => {
        const open = indexedDB.open("cafam-offline");
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const tx = open.result.transaction("conflicts", "readwrite");
          tx.objectStore("conflicts").put(
            {
              changeId: "k1",
              change: {
                type: "series.update",
                id: "s1",
                scope: "all",
                base: { fields: base },
                data: { ...base, location: "Biblioteca municipal" },
                repeat: "none",
              },
              server: {
                ...base,
                startsAt: "2026-11-23T17:30:00Z",
                recurrence: "FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,WE",
                loss: { exceptions: 2, images: 1, comments: 3 },
              },
            },
            "k1",
          );
          tx.oncomplete = () => {
            open.result.close();
            resolve();
          };
        };
      }),
    { base: BASE_FIELDS },
  );

  await context.setOffline(true);
  const detail = `${BASE}/dashboard/events/${event.id}`;
  await page.goto(detail);
  await visible(page.getByText("¿Alguien lleva la tarta?")).waitFor();
  const box = visible(page.getByLabel("Escribe un comentario"));
  await box.fill("Yo llevo la tarta y las velas");
  await box.press("Control+Enter");
  await visible(page.getByText("Yo llevo la tarta y las velas")).waitFor();
  const chooser = page.waitForEvent("filechooser");
  await visible(page.getByRole("button", { name: "Añadir imágenes" })).click();
  await (await chooser).setFiles("public/icons/icon-512.png");
  await visible(page.getByRole("button", { name: /^Quitar/ })).waitFor();

  for (const scheme of ["light", "dark"]) {
    await page.emulateMedia({ colorScheme: scheme });
    const theme = scheme === "light" ? "claro" : "oscuro";
    for (const [width, height] of [
      [390, 844],
      [768, 1024],
      [1440, 900],
    ]) {
      await page.setViewportSize({ width, height });
      await page.goto(detail);
      await visible(page.getByText("Yo llevo la tarta y las velas")).waitFor();
      await wait(800);
      await page.screenshot({
        path: `${OUT}/detalle-sin-red-${width}-${theme}.png`,
        fullPage: true,
      });
      await visible(
        page.getByRole("button", { name: /cambios pendientes/ }),
      ).click();
      await page
        .getByRole("dialog", { name: "Cambios" })
        .getByText("Se perderán 2 cambios")
        .waitFor();
      await wait(600);
      await page.screenshot({
        path: `${OUT}/conflicto-serie-${width}-${theme}.png`,
      });
      await page.keyboard.press("Escape");
      console.log("ok", width, theme);
    }
  }
} finally {
  await browser.close();
  const { data } = await admin.auth.admin.listUsers({ perPage: 1000 });
  for (const user of data.users) {
    if (user.email === email) await admin.auth.admin.deleteUser(user.id);
  }
}
