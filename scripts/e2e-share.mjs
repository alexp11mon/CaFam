// Spec 047, T5: sharing and the icon in a real Edge. Signs a user up, checks
// the manifest (share_target, shortcuts), shares an .ics, an image and a
// text to /share-target the way Android does (a multipart POST that the
// service worker answers), and checks the number of the icon.
//
//   npm run build && npx next start -p 3100 &
//   NODE_PATH=<global node_modules> node --env-file=.env.test.local scripts/e2e-share.mjs
import { randomUUID } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
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
const results = [];
const step = (name, ok, extra = "") => {
  results.push(ok);
  console.log(ok ? "ok" : "FALLO", name, extra);
};

/** A share as Android sends it: a form posted to /share-target. */
const share = (page, { text = "", file = null }) =>
  page.evaluate(
    ({ text, file }) => {
      const form = document.createElement("form");
      form.method = "POST";
      form.action = "/share-target";
      form.enctype = "multipart/form-data";
      const field = document.createElement("input");
      field.name = "text";
      field.value = text;
      form.append(field);
      if (file) {
        const input = document.createElement("input");
        input.type = "file";
        input.name = "files";
        const data = new DataTransfer();
        data.items.add(
          new File([new Uint8Array(file.bytes)], file.name, {
            type: file.type,
          }),
        );
        input.files = data.files;
        form.append(input);
      }
      document.body.append(form);
      form.submit();
    },
    { text, file },
  );

const ICS = [
  "BEGIN:VCALENDAR",
  "VERSION:2.0",
  "BEGIN:VEVENT",
  "UID:e2e-share@cafam",
  "DTSTART:20261210T180000Z",
  "DTEND:20261210T190000Z",
  "SUMMARY:Cena compartida",
  "END:VEVENT",
  "END:VCALENDAR",
].join("\r\n");

const context = await chromium.launchPersistentContext(
  mkdtempSync(join(tmpdir(), "cafam-share-")),
  {
    channel: process.env.E2E_CHANNEL ?? "msedge",
    headless: false,
    viewport: { width: 1440, height: 900 },
  },
);
// Records what reaches the Badging API.
await context.addInitScript(() => {
  window.__badges = [];
  if (!("setAppBadge" in navigator)) return;
  const set = navigator.setAppBadge.bind(navigator);
  const clear = navigator.clearAppBadge.bind(navigator);
  navigator.setAppBadge = (n) => (window.__badges.push(n), set(n));
  navigator.clearAppBadge = () => (window.__badges.push(0), clear());
});
let userId;
try {
  const page = context.pages()[0] ?? (await context.newPage());
  page.setDefaultTimeout(30_000);

  const manifest = await (await fetch(`${BASE}/manifest.webmanifest`)).json();
  step(
    "manifest: share_target y accesos directos",
    manifest.share_target?.action === "/share-target" &&
      manifest.shortcuts?.length === 4,
    manifest.shortcuts?.map((s) => s.name).join(", "),
  );

  await page.goto(`${BASE}/signup`);
  await page.getByLabel("Nombre visible").fill("Ana Comparte");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Contraseña").fill("test-password-1234");
  await page.getByRole("button", { name: "Crear cuenta" }).click();
  await page.waitForURL("**/dashboard/calendar**");
  const { data: users } = await admin.auth.admin.listUsers({ perPage: 1000 });
  userId = users.users.find((u) => u.email === email).id;
  await page.evaluate(() => navigator.serviceWorker.ready);
  // The first load is not controlled yet: one more makes it so.
  await page.reload();

  // An event later today for the badge.
  const { data: own } = await admin
    .from("calendars")
    .select("id")
    .eq("owner_id", userId)
    .single();
  const start = new Date(Date.now() + 30 * 60_000);
  const sameDay =
    start.toLocaleDateString("sv-SE", { timeZone: "Europe/Madrid" }) ===
    new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Madrid" });
  await admin.from("events").insert({
    calendar_id: own.id,
    title: "Hoy",
    starts_at: start.toISOString(),
    ends_at: new Date(start.getTime() + 15 * 60_000).toISOString(),
    all_day: false,
    created_by: userId,
  });
  await page.goto(`${BASE}/dashboard/calendar`);
  await page.waitForTimeout(3000);
  const badges = await page.evaluate(() => window.__badges);
  step(
    "número del icono",
    sameDay ? badges.includes(1) : badges.length > 0,
    JSON.stringify(badges),
  );

  await share(page, {
    file: {
      name: "cena.ics",
      type: "text/calendar",
      bytes: [...Buffer.from(ICS)],
    },
  });
  await page.waitForURL("**/dashboard/import?shared=**");
  await page.getByText("Archivo compartido: cena.ics").waitFor();
  step("un .ics abre Importar con el archivo", true);
  await page.getByRole("button", { name: "Importar calendario" }).click();
  await page
    .getByRole("status")
    .filter({ hasText: /1 evento/ })
    .waitFor();
  step("y se importa al pulsar", true);

  await page.goto(`${BASE}/dashboard/calendar`);
  await share(page, {
    file: { name: "foto.png", type: "image/png", bytes: [137, 80, 78, 71] },
  });
  await page.waitForURL("**/dashboard/share?id=**");
  await page.getByText("¿Qué hago con esta imagen?").waitFor();
  step("una imagen pregunta qué hacer", true);

  await share(page, { text: "Pádel el viernes a las 19" });
  await page.waitForURL("**/dashboard/events/new?text=**");
  const phrase = await page
    .getByLabel("Escribe el evento")
    .filter({ visible: true })
    .inputValue();
  step(
    "un texto abre el alta con la frase",
    phrase.startsWith("Pádel"),
    phrase,
  );
} finally {
  await context.close();
  if (userId) await admin.auth.admin.deleteUser(userId);
}
const failed = results.filter((ok) => !ok).length;
console.log(failed ? `${failed} fallos` : "todo bien");
process.exit(failed ? 1 : 0);
