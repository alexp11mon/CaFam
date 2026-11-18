// RNF-2 and RNF-3 of spec 034 (T12): a user with 2,000 events in the range
// of the copy and 500 notes of 20 items. Measures what the copy takes in
// IndexedDB and how long the app takes to paint the calendar without a
// connection with the CPU 4x slower.
//
//   npx next start -p 3100 &
//   node --env-file=.env.test.local scripts/perf/offline-measure.mjs
//
// The @cafam.test user is deleted at the end.
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { createClient } from "@supabase/supabase-js";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const BASE = process.env.E2E_BASE ?? "http://localhost:3100";
const RUNS = 5;
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);
const must = async (query) => {
  const { data, error } = await query;
  if (error) throw error;
  return data;
};
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const email = `test-${randomUUID()}@cafam.test`;
const password = "test-password-1234";
const { data: created, error } = await admin.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
  user_metadata: { display_name: "Medida", time_zone: "Europe/Madrid" },
});
if (error) throw error;
const userId = created.user.id;

let browser;
try {
  const [calendar] = await must(
    admin.from("calendars").select("id").eq("owner_id", userId),
  );
  // 2,000 events from 25 days ago to 85 days ahead, inside the copy's range.
  const day = new Date();
  day.setUTCHours(0, 0, 0, 0);
  const events = Array.from({ length: 2000 }, (_, i) => {
    const starts = new Date(
      day.getTime() + ((i % 110) - 25) * 864e5 + (8 + (i % 12)) * 36e5,
    );
    return {
      calendar_id: calendar.id,
      title: `Evento ${i + 1}`,
      starts_at: starts.toISOString(),
      ends_at: new Date(starts.getTime() + 36e5).toISOString(),
      all_day: false,
      created_by: userId,
      location: "Calle Mayor 12",
      description: "Una descripción de longitud normal para el evento.",
    };
  });
  for (let i = 0; i < events.length; i += 500) {
    await must(admin.from("events").insert(events.slice(i, i + 500)));
  }
  const notes = await must(
    admin
      .from("notes")
      .insert(
        Array.from({ length: 500 }, (_, i) => ({
          owner_id: userId,
          kind: "list",
          title: `Lista ${i + 1}`,
        })),
      )
      .select("id"),
  );
  const items = notes.flatMap((note) =>
    Array.from({ length: 20 }, (_, position) => ({
      note_id: note.id,
      text: `Elemento ${position + 1} de la lista`,
      position,
    })),
  );
  for (let i = 0; i < items.length; i += 1000) {
    await must(admin.from("note_items").insert(items.slice(i, i + 1000)));
  }

  browser = await chromium.launch({
    channel: process.env.E2E_CHANNEL ?? "msedge",
  });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  await page.goto(`${BASE}/login`);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Contraseña").fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL(/dashboard/);
  await page.evaluate(() => navigator.serviceWorker.ready);

  // The copy as stored: structured clones are close to their JSON size.
  const readCopy = () =>
    page.evaluate(async () => {
      const names = (await indexedDB.databases()).map((db) => db.name);
      if (!names.includes("cafam-offline")) return null;
      return new Promise((resolve) => {
        const open = indexedDB.open("cafam-offline");
        open.onsuccess = () => {
          const db = open.result;
          if (!db.objectStoreNames.contains("snapshot")) {
            db.close();
            return resolve(null);
          }
          const read = db
            .transaction("snapshot")
            .objectStore("snapshot")
            .getAll();
          read.onsuccess = () => {
            db.close();
            const copy = read.result[0];
            resolve(
              copy
                ? {
                    bytes: new Blob([JSON.stringify(copy)]).size,
                    events: copy.events.length,
                    notes: copy.notes.length,
                  }
                : null,
            );
          };
        };
      });
    });
  let copy = null;
  for (let i = 0; i < 120 && !copy; i++) {
    copy = await readCopy();
    if (!copy) await wait(500);
  }
  if (!copy) throw new Error("no hay copia");
  const estimate = await page.evaluate(() => navigator.storage.estimate());
  console.log(
    `RNF-3: copia de ${copy.events} eventos y ${copy.notes} notas = ${(copy.bytes / 1048576).toFixed(2)} MB en JSON; ` +
      `uso total del origen ${(estimate.usage / 1048576).toFixed(2)} MB (incluye la caché del service worker)`,
  );

  await page.reload();
  await page.evaluate(() => navigator.serviceWorker.ready);
  await context.setOffline(true);
  const cdp = await context.newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  // When the first event appears, in the document's own clock.
  await context.addInitScript(() => {
    new MutationObserver((_, observer) => {
      if (document.querySelector("[data-event-id]")) {
        window.__firstEvent = performance.now();
        observer.disconnect();
      }
    }).observe(document, { childList: true, subtree: true });
  });
  const times = [];
  for (let i = 0; i < RUNS; i++) {
    const start = Date.now();
    await page.goto(`${BASE}/dashboard/calendar?view=agenda`);
    await page
      .locator("[data-event-id]")
      .locator("visible=true")
      .first()
      .waitFor({ timeout: 30_000 });
    times.push(Date.now() - start);
    const parts = await page.evaluate(() => {
      const nav = performance.getEntriesByType("navigation")[0];
      const scripts = performance
        .getEntriesByType("resource")
        .filter((entry) => entry.name.endsWith(".js"));
      return {
        redirect: Math.round(nav.startTime),
        html: Math.round(nav.responseEnd),
        scripts: Math.round(Math.max(...scripts.map((e) => e.responseEnd))),
        domContentLoaded: Math.round(nav.domContentLoadedEventEnd),
        firstEvent: Math.round(window.__firstEvent),
      };
    });
    if (process.env.BREAKDOWN) console.log(JSON.stringify(parts));
  }
  if (process.env.PROFILE) {
    // Self time per function of one more opening (build with --no-mangling).
    await cdp.send("Profiler.enable");
    await cdp.send("Profiler.start");
    await page.goto(`${BASE}/dashboard/calendar?view=agenda`);
    await page.locator("[data-event-id]").first().waitFor({ timeout: 30_000 });
    const { profile } = await cdp.send("Profiler.stop");
    const self = new Map();
    const gap = profile.timeDeltas;
    profile.samples.forEach((id, i) => {
      const node = profile.nodes.find((n) => n.id === id);
      const { functionName, url, lineNumber } = node.callFrame;
      const key = `${functionName || "(anónima)"} ${url.split("/").pop()}:${lineNumber}`;
      self.set(key, (self.get(key) ?? 0) + (gap[i] ?? 0) / 1000);
    });
    for (const [key, ms] of [...self]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 30)) {
      console.log(`${ms.toFixed(0).padStart(6)} ms  ${key}`);
    }
  }
  times.sort((a, b) => a - b);
  console.log(
    `RNF-2: calendario sin red con la CPU 4x: ${times.join(", ")} ms (mediana ${times[Math.floor(RUNS / 2)]} ms)`,
  );
} finally {
  await browser?.close();
  await admin.auth.admin.deleteUser(userId);
}
