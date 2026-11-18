// Conflicts of the offline mode with two users in dev (spec 034 T12): Ana
// works without a connection on calendars and a list she shares with Luis,
// who changes the same things meanwhile; when Ana gets the network back she
// answers each conflict. Also takes the review screenshots (P9) of the
// pending marks, the indicator, a conflict and "Cambios no enviados".
//
//   npx next start -p 3100 &
//   node --env-file=.env.test.local scripts/e2e-offline-conflicts.mjs [outDir]
//
// Luis's changes are written with the admin client, as "another person".
// Both users are @cafam.test and are deleted at the end.
import { mkdirSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const BASE = process.env.E2E_BASE ?? "http://localhost:3100";
const OUT = process.argv[2] ?? "specs/034-modo-sin-conexion/capturas";
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);
const PASSWORD = "test-password-1234";
const results = [];
const users = [];

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
    const at = page.isClosed() ? "" : ` (en ${page.url().replace(BASE, "")})`;
    results.push([
      "FALLO",
      name,
      String(error).split("\n")[0].slice(0, 160) + at,
    ]);
  }
}
const must = async (query) => {
  const { data, error } = await query;
  if (error) throw error;
  return data;
};
const visible = (locator) => locator.locator("visible=true").first();
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function createUser(name) {
  const email = `test-${randomUUID()}@cafam.test`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { display_name: name, time_zone: "Europe/Madrid" },
  });
  if (error) throw error;
  users.push(data.user.id);
  return { id: data.user.id, email };
}

// Luis owns "Familia" and "Club"; Ana is an Editor of both.
async function seed() {
  const ana = await createUser("Ana");
  const luis = await createUser("Luis");
  const [familia, club] = await must(
    admin
      .from("calendars")
      .insert([
        { owner_id: luis.id, name: "Familia", color: "#FFADAD" },
        { owner_id: luis.id, name: "Club", color: "#CAFFBF" },
      ])
      .select("id, name"),
  );
  await must(
    admin.from("calendar_members").insert([
      { calendar_id: familia.id, user_id: ana.id, role: "editor" },
      { calendar_id: club.id, user_id: ana.id, role: "editor" },
    ]),
  );
  const day = new Date();
  day.setUTCHours(0, 0, 0, 0);
  const at = (days, hour) =>
    new Date(day.getTime() + days * 864e5 + hour * 36e5).toISOString();
  const event = (title, days, hour) => ({
    calendar_id: familia.id,
    title,
    starts_at: at(days, hour),
    ends_at: at(days, hour + 1),
    all_day: false,
    created_by: luis.id,
    location: "Casa",
  });
  const events = await must(
    admin
      .from("events")
      .insert([
        event("Cena", 1, 18),
        event("Dentista", 2, 9),
        event("Fútbol", 3, 17),
        event("Compra", 4, 10),
      ])
      .select("id, title"),
  );
  const id = Object.fromEntries(events.map((e) => [e.title, e.id]));
  const [note] = await must(
    admin
      .from("notes")
      .insert({
        owner_id: luis.id,
        calendar_id: familia.id,
        kind: "list",
        title: "Compra semanal",
      })
      .select("id"),
  );
  const items = await must(
    admin
      .from("note_items")
      .insert(
        ["Pan", "Leche", "Huevos"].map((text, position) => ({
          note_id: note.id,
          text,
          position,
        })),
      )
      .select("id, text"),
  );
  const item = Object.fromEntries(items.map((i) => [i.text, i.id]));
  return { ana, luis, familia, club, id, note: note.id, item };
}

const data = await seed();
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({
  channel: process.env.E2E_CHANNEL ?? "msedge",
});
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
});
let page = await context.newPage();

const shot = (name) =>
  page.screenshot({ path: join(OUT, `${name}.png`) }).catch(() => {});

const copySaved = () =>
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
          resolve(read.result[0]?.savedAt ?? null);
        };
      };
    });
  });

const storedCount = () =>
  page.evaluate(
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

async function editLocation(eventId, location) {
  await page.goto(`${BASE}/dashboard/events/${eventId}`);
  await visible(page.getByRole("button", { name: "Editar" })).click();
  await visible(page.getByLabel("Lugar")).fill(location);
  await visible(page.getByRole("button", { name: "Guardar cambios" })).click();
  await page.waitForURL("**/dashboard/calendar**");
}

async function deleteEvent(eventId) {
  await page.goto(`${BASE}/dashboard/events/${eventId}`);
  await visible(page.getByRole("button", { name: "Borrar evento" })).click();
  await page.waitForURL("**/dashboard/calendar**");
}

const sheet = () => page.getByRole("dialog", { name: "Cambios" });
async function openSheet() {
  await visible(page.locator("[data-connection-badge]")).click();
  await visible(sheet().getByRole("heading", { name: "Cambios" })).waitFor();
}
const conflict = (title) =>
  sheet().getByRole("listitem").filter({ hasText: title });

try {
  await step("Ana entra y guarda la copia", async () => {
    await page.goto(`${BASE}/login`);
    await page.getByLabel("Email").fill(data.ana.email);
    await page.getByLabel("Contraseña").fill(PASSWORD);
    await page.getByRole("button", { name: "Entrar" }).click();
    await page.waitForURL(/dashboard/);
    await page.evaluate(() => navigator.serviceWorker.ready);
    for (let i = 0; i < 30 && !(await copySaved()); i++) await wait(500);
    if (!(await copySaved())) throw new Error("no hay copia");
    await page.reload();
    await page.evaluate(() => navigator.serviceWorker.ready);
  });

  await context.setOffline(true);

  await step("sin red: cambia, borra y crea eventos", async () => {
    await editLocation(data.id.Cena, "Restaurante");
    await editLocation(data.id.Dentista, "Clínica nueva");
    await deleteEvent(data.id["Fútbol"]);
    await editLocation(data.id.Compra, "Mercado");
    await page.goto(`${BASE}/dashboard/events/new`);
    await visible(page.getByLabel("Título")).fill("Torneo");
    await visible(page.getByLabel("Calendario")).selectOption({
      label: "Club",
    });
    await visible(page.getByRole("button", { name: "Crear evento" })).click();
    await page.waitForURL("**/dashboard/calendar**");
  });

  await step("sin red: marca y cambia elementos de la lista", async () => {
    await page.goto(`${BASE}/dashboard/notes/${data.note}`);
    await visible(page.getByRole("checkbox", { name: "Pan" })).click();
    const huevos = visible(page.getByLabel("Texto de «Huevos»"));
    await huevos.fill("Huevos camperos");
    await huevos.press("Enter");
    await visible(page.getByText("Pendiente de enviar")).waitFor();
  });

  await step("cerrar y reabrir sin red conserva lo pendiente", async () => {
    await page.close();
    page = await context.newPage();
    await page.goto(`${BASE}/dashboard/calendar?view=agenda`);
    await visible(page.getByText("Torneo")).waitFor({ timeout: 15_000 });
    const marks = await page.getByText("Pendiente de enviar").count();
    if (marks < 3) throw new Error(`solo ${marks} marcas`);
    return `${marks} marcas de pendiente`;
  });

  await step("capturas de las marcas y el indicador sin red", async () => {
    for (const theme of ["light", "dark"]) {
      await page.emulateMedia({ colorScheme: theme });
      for (const [width, height] of [
        [390, 844],
        [768, 1024],
        [1440, 900],
      ]) {
        await page.setViewportSize({ width, height });
        await page.goto(`${BASE}/dashboard/calendar?view=agenda`);
        await visible(page.getByText("Torneo")).waitFor();
        await wait(400);
        await shot(
          `pendientes-${width}-${theme === "dark" ? "oscuro" : "claro"}-violeta`,
        );
      }
    }
    await page.emulateMedia({ colorScheme: "light" });
    await page.setViewportSize({ width: 390, height: 844 });
  });

  await step("Luis cambia lo mismo mientras tanto", async () => {
    await must(
      admin
        .from("events")
        .update({ location: "Casa de Luis" })
        .eq("id", data.id.Cena),
    );
    await must(admin.from("events").delete().eq("id", data.id.Dentista));
    await must(
      admin
        .from("events")
        .update({ title: "Fútbol (final)" })
        .eq("id", data.id["Fútbol"]),
    );
    await must(
      admin
        .from("note_items")
        .update({ done: true, done_at: new Date().toISOString() })
        .eq("id", data.item.Leche),
    );
    await must(
      admin
        .from("note_items")
        .update({ text: "Huevos XL" })
        .eq("id", data.item.Huevos),
    );
    // Ana is no longer in "Club": her new event there is refused (RF-47).
    await must(
      admin
        .from("calendar_members")
        .delete()
        .eq("calendar_id", data.club.id)
        .eq("user_id", data.ana.id),
    );
  });

  await context.setOffline(false);

  await step("al volver la red: aplicado, conflictos y rechazado", async () => {
    for (let i = 0; i < 60; i++) {
      const label = await page
        .locator("[data-connection-badge]")
        .first()
        .getAttribute("aria-label")
        .catch(() => null);
      // 3 events + 1 item in conflict and the refused event.
      if (label === "5 cambios pendientes") break;
      await wait(1000);
    }
    const compra = await must(
      admin.from("events").select("location").eq("id", data.id.Compra).single(),
    );
    if (compra.location !== "Mercado") throw new Error("Compra no llegó");
    const items = await must(
      admin.from("note_items").select("text, done").eq("note_id", data.note),
    );
    const done = Object.fromEntries(items.map((i) => [i.text, i.done]));
    // RF-54: two different items of the list, both applied.
    if (!done.Pan || !done.Leche) throw new Error(JSON.stringify(done));
    return JSON.stringify(done);
  });

  await step("capturas de un conflicto y de Cambios no enviados", async () => {
    for (const [accent, accentName] of [
      ["red", "violeta"],
      ["yellow", "ambar"],
    ]) {
      await must(
        admin.from("profiles").update({ accent }).eq("id", data.ana.id),
      );
      for (const theme of ["light", "dark"]) {
        await page.emulateMedia({ colorScheme: theme });
        for (const [width, height] of [
          [390, 844],
          [768, 1024],
          [1440, 900],
        ]) {
          await page.setViewportSize({ width, height });
          await page.goto(`${BASE}/dashboard/calendar?view=agenda`);
          await openSheet();
          await wait(400);
          const name = `${width}-${theme === "dark" ? "oscuro" : "claro"}-${accentName}`;
          await shot(`conflicto-${name}`);
          await sheet()
            .getByRole("heading", { name: "Cambios no enviados" })
            .scrollIntoViewIfNeeded();
          await wait(200);
          await shot(`no-enviados-${name}`);
          await page.keyboard.press("Escape");
        }
      }
    }
    await must(
      admin.from("profiles").update({ accent: "red" }).eq("id", data.ana.id),
    );
    await page.emulateMedia({ colorScheme: "light" });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${BASE}/dashboard/calendar?view=agenda`);
  });

  await step("RF-50 y RF-58: Conservar la mía", async () => {
    await openSheet();
    await conflict("Evento cambiado: Cena")
      .getByRole("button", { name: "Conservar la mía" })
      .click();
    await conflict("Evento cambiado: Cena").waitFor({ state: "detached" });
    const row = await must(
      admin.from("events").select("location").eq("id", data.id.Cena).single(),
    );
    if (row.location !== "Restaurante") throw new Error(row.location);
  });

  await step("RF-51: Volver a crearlo", async () => {
    await conflict("Dentista")
      .getByRole("button", { name: "Volver a crearlo" })
      .click();
    await conflict("Dentista").waitFor({ state: "detached" });
    const row = await must(
      admin
        .from("events")
        .select("location")
        .eq("id", data.id.Dentista)
        .single(),
    );
    if (row.location !== "Clínica nueva") throw new Error(row.location);
  });

  await step("RF-52: Borrarlo igualmente", async () => {
    await conflict("Fútbol")
      .getByRole("button", { name: "Borrarlo igualmente" })
      .click();
    await conflict("Fútbol").waitFor({ state: "detached" });
    const rows = await must(
      admin.from("events").select("id").eq("id", data.id["Fútbol"]),
    );
    if (rows.length !== 0) throw new Error("sigue existiendo");
  });

  await step(
    "RF-55 y RF-59: Conservar la suya en el mismo elemento",
    async () => {
      await conflict("Huevos")
        .getByRole("button", { name: "Conservar la suya" })
        .click();
      await conflict("Huevos").waitFor({ state: "detached" });
      const row = await must(
        admin
          .from("note_items")
          .select("text")
          .eq("id", data.item.Huevos)
          .single(),
      );
      if (row.text !== "Huevos XL") throw new Error(row.text);
    },
  );

  await step(
    "RF-47 y RF-48: el rechazado sigue en Cambios no enviados",
    async () => {
      const item = sheet().getByRole("listitem").filter({ hasText: "Torneo" });
      await item.waitFor();
      return (await item.innerText()).split("\n").slice(0, 2).join(" · ");
    },
  );

  await step(
    "RF-61 y RF-62: cerrar sesión con un cambio sin enviar",
    async () => {
      await page.keyboard.press("Escape");
      await visible(page.getByRole("button", { name: "Más" })).click();
      await visible(
        page.getByRole("button", { name: "Cerrar sesión" }),
      ).click();
      await visible(
        page.getByText(
          "Tienes 1 cambio sin enviar. Si cierras sesión, se perderán.",
        ),
      ).waitFor();
      await visible(
        page.getByRole("button", { name: "Cerrar sesión igualmente" }),
      ).click();
      await page.waitForURL("**/login**");
      const left = await storedCount();
      if (left !== 0) throw new Error(`quedan ${left} registros`);
    },
  );
} finally {
  await browser.close();
  for (const id of users) await admin.auth.admin.deleteUser(id);
}

for (const [status, name, detail] of results) {
  console.log(`${status.padEnd(5)} ${name}${detail ? ` — ${detail}` : ""}`);
}
process.exit(results.some(([status]) => status !== "ok") ? 1 : 0);
