// CaFam without a connection in a real browser (spec 034 T9, T12): sign up,
// let the app save its copy, cut the network, open the calendar, a note and
// an event from the copy, create a note and an event, and get the network
// back so the queue reaches the server.
//
//   npx next start -p 3100 &
//   node --env-file=.env.test.local scripts/e2e-offline.mjs
//
// It signs up a @cafam.test user through the real form and deletes it at the
// end. Edge of the system (AGENTS.md: Playwright without its own browsers).
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
const results = [];

async function step(name, run) {
  try {
    const detail = await run();
    results.push(["ok", name, detail ?? ""]);
  } catch (error) {
    if (process.env.E2E_SHOTS) {
      await page
        .screenshot({ path: `${process.env.E2E_SHOTS}/${results.length}.png` })
        .catch(() => {});
    }
    results.push(["FALLO", name, String(error).split("\n")[0].slice(0, 200)]);
  }
}

const visible = (locator) => locator.locator("visible=true").first();
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const browser = await chromium.launch({
  channel: process.env.E2E_CHANNEL ?? "msedge",
});
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
});
const page = await context.newPage();

const copySaved = () =>
  page.evaluate(async () => {
    // Opening a database that does not exist yet would create it empty.
    const names = (await indexedDB.databases()).map((db) => db.name);
    if (!names.includes("cafam-offline")) return null;
    return new Promise((resolve) => {
      const open = indexedDB.open("cafam-offline");
      open.onerror = () => resolve(null);
      open.onsuccess = () => {
        const db = open.result;
        // Closed at once: an open connection would block the app's upgrade.
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
          resolve(read.result[0]?.savedAt ?? null);
        };
      };
    });
  });

try {
  await step("registro", async () => {
    await page.goto(`${BASE}/signup`);
    await page.getByLabel("Nombre visible").fill("Prueba sin red");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Contraseña").fill("test-password-1234");
    await page.getByRole("button", { name: "Crear cuenta" }).click();
    await page.waitForURL("**/dashboard/calendar**");
  });

  await step("copia y service worker", async () => {
    await page.evaluate(() => navigator.serviceWorker.ready);
    for (let i = 0; i < 30 && !(await copySaved()); i++) await wait(500);
    const saved = await copySaved();
    if (!saved) throw new Error("no hay copia en IndexedDB");
    // The page loaded before the worker: once more so it controls it.
    await page.reload();
    await page.evaluate(() => navigator.serviceWorker.ready);
    return `copia de ${saved}`;
  });

  await step("evento con red", async () => {
    const { data: user } = await admin
      .from("profiles")
      .select("id")
      .eq("display_name", "Prueba sin red")
      .single();
    const { data: calendar } = await admin
      .from("calendars")
      .select("id")
      .eq("owner_id", user.id)
      .single();
    const start = new Date();
    start.setUTCHours(start.getUTCHours() + 2, 0, 0, 0);
    const { error } = await admin.from("events").insert({
      calendar_id: calendar.id,
      title: "Dentista",
      starts_at: start.toISOString(),
      ends_at: new Date(start.getTime() + 3_600_000).toISOString(),
      all_day: false,
      created_by: user.id,
    });
    if (error) throw error;
    // The page reads it and joins it to the copy.
    await page.reload();
    await visible(page.getByText("Dentista")).waitFor();
  });

  await context.setOffline(true);

  // Plan R10: a link of the app with the network does not hang.
  await step("enlace sin red desde la app con red", async () => {
    await visible(
      page.getByRole("navigation", { name: "Principal" }).getByRole("link", {
        name: /Notas/,
      }),
    ).click();
    await page.waitForURL("**/dashboard/notes", { timeout: 15_000 });
    await visible(page.getByRole("heading", { name: "Notas" })).waitFor();
  });

  await step("calendario sin red", async () => {
    await page.goto(`${BASE}/dashboard/calendar?view=week`);
    // The frame of the app, not the screen without a copy.
    await visible(page.getByRole("navigation", { name: "Principal" })).waitFor({
      timeout: 15_000,
    });
    await visible(
      page.getByRole("button", { name: /Sin conexión · datos/ }),
    ).waitFor();
    return new URL(page.url()).pathname + new URL(page.url()).search;
  });

  // Spec 054 RF-21: "Ahora" from the copy, with the app's offline notice.
  await step("Ahora sin red", async () => {
    await page.goto(`${BASE}/dashboard/now`);
    const card = visible(
      page.getByRole("region", { name: "Prueba sin red (tú)" }),
    );
    await card.waitFor({ timeout: 15_000 });
    await card.getByRole("link", { name: "Dentista" }).waitFor();
    await visible(
      page.getByRole("button", { name: /Sin conexión · datos/ }),
    ).waitFor();
  });

  await step("vista y periodo sin red", async () => {
    const views = visible(page.getByRole("list", { name: "Vistas" }));
    await views.getByRole("link", { name: "Mes" }).click();
    await visible(page.getByRole("button", { name: "Mes siguiente" })).click();
    await visible(page.getByRole("button", { name: "Mes siguiente" })).click();
    const url = new URL(page.url());
    if (url.searchParams.get("view") !== "month") {
      throw new Error(`sigue en ${url.search}`);
    }
    return url.search;
  });

  await step("fuera del rango", async () => {
    await page.goto(`${BASE}/dashboard/calendar?view=month&date=2028-06-01`);
    await visible(
      page.getByText("Estas fechas no están disponibles sin conexión"),
    ).waitFor();
  });

  await step("detalle sin red", async () => {
    await page.goto(`${BASE}/dashboard/calendar?view=agenda`);
    await visible(page.getByText("Dentista")).click();
    await page.waitForURL(/\/dashboard\/events\//);
    await visible(page.getByRole("heading", { name: "Dentista" })).waitFor();
  });

  await step("destinos y cerrar sesión deshabilitados sin red", async () => {
    await visible(page.getByRole("button", { name: "Más" })).click();
    await visible(
      page.getByRole("link", { name: "Ajustes: Necesita conexión" }),
    ).waitFor();
    const signOut = visible(
      page.getByRole("button", { name: /Cerrar sesión/ }),
    );
    if (!(await signOut.isDisabled()))
      throw new Error("se puede cerrar sesión");
    await page.keyboard.press("Escape");
  });

  await step("una pantalla que necesita red", async () => {
    await page.goto(`${BASE}/dashboard/settings`);
    await visible(page.getByText("Necesita conexión")).waitFor();
  });

  // Spec 039 RF-10: the search works on the device's copy.
  await step("buscar sin red", async () => {
    await page.goto(`${BASE}/dashboard/search?q=dentis`);
    await visible(
      page.getByText("Buscando solo en los datos de este dispositivo", {
        exact: false,
      }),
    ).waitFor({ timeout: 15_000 });
    await visible(page.getByRole("link", { name: /Dentista/ })).waitFor();
  });

  await step("nota nueva sin red", async () => {
    await page.goto(`${BASE}/dashboard/notes/new`);
    await visible(page.getByLabel("Título (opcional)")).fill("Lista sin red");
    await visible(page.getByRole("button", { name: /Crear/ })).click();
    await page.waitForURL(/\/dashboard\/notes\/[0-9a-f-]{36}/);
    await visible(page.getByText("Pendiente de enviar")).waitFor();
    return new URL(page.url()).pathname;
  });

  await step("evento nuevo sin red", async () => {
    await page.goto(`${BASE}/dashboard/events/new`);
    await visible(page.getByLabel("Título")).fill("Cena sin red");
    await visible(page.getByRole("button", { name: "Crear evento" })).click();
    await page.waitForURL("**/dashboard/calendar**");
    await page.goto(`${BASE}/dashboard/calendar?view=agenda`);
    await visible(page.getByText("Cena sin red")).waitFor();
  });

  await step("hoja de cambios desde el indicador", async () => {
    await visible(
      page.getByRole("button", { name: /Sin conexión · datos.*pendiente/ }),
    ).click();
    const sheet = page.getByRole("dialog", { name: "Cambios" });
    await sheet.getByText(/cambios pendientes: se enviarán/).waitFor();
    await page.keyboard.press("Escape");
  });

  await context.setOffline(false);

  await step("al volver la red llega todo", async () => {
    const { data: user } = await admin
      .from("profiles")
      .select("id")
      .eq("display_name", "Prueba sin red")
      .single();
    for (let i = 0; i < 60; i++) {
      const [{ data: notes }, { data: events }] = await Promise.all([
        admin.from("notes").select("title").eq("owner_id", user.id),
        admin.from("events").select("title").eq("created_by", user.id),
      ]);
      if (notes?.length && events?.length > 1) {
        return `${notes.map((n) => n.title)} · ${events.map((e) => e.title)}`;
      }
      await wait(1000);
    }
    throw new Error("la cola no llegó al servidor en 60 s");
  });

  await step("vuelve a la página real", async () => {
    await page.waitForURL((url) => !url.pathname.startsWith("/offline"));
    await visible(page.getByText("Cena sin red")).waitFor({ timeout: 15_000 });
  });

  await step("cerrar sesión no deja nada en el dispositivo", async () => {
    await visible(page.getByRole("button", { name: "Más" })).click();
    await visible(page.getByRole("button", { name: "Cerrar sesión" })).click();
    await page.waitForURL("**/login**");
    const left = await page.evaluate(
      () =>
        new Promise((resolve) => {
          const open = indexedDB.open("cafam-offline");
          open.onsuccess = () => {
            const db = open.result;
            const stores = [...db.objectStoreNames];
            const tx = db.transaction(stores);
            let count = 0;
            for (const name of stores) {
              tx.objectStore(name).count().onsuccess = (event) => {
                count += event.target.result;
              };
            }
            tx.oncomplete = () => {
              db.close();
              resolve(count);
            };
          };
        }),
    );
    if (left !== 0) throw new Error(`quedan ${left} registros`);
  });
} finally {
  await browser.close();
  const { data } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const extra = (process.env.E2E_DELETE ?? "").split(",").filter(Boolean);
  for (const user of data.users) {
    if (user.email === email || extra.includes(user.email)) {
      await admin.auth.admin.deleteUser(user.id);
    }
  }
}

for (const [status, name, detail] of results) {
  console.log(`${status.padEnd(5)} ${name}${detail ? ` — ${detail}` : ""}`);
}
process.exit(results.some(([status]) => status !== "ok") ? 1 : 0);
