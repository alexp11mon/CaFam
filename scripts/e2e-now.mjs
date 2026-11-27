// "Ahora" in a real browser (spec 054 T9): a mother who is a viewer of her
// son's calendars, an aunt seen only through availability and six more people
// with three calendars each (8 people, RNF performance). Checks the home
// screen, the cards, the @modal window (R1), "only" (RF-17), the setting
// (RF-24), measures the paint with data and takes the screenshots of P9.
//
//   npx next start -p 3100 &
//   node --env-file=.env.test.local scripts/e2e-now.mjs [shotsDir]
//
// It seeds @cafam.test users and deletes them at the end.
import { mkdirSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const BASE = process.env.E2E_BASE ?? "http://localhost:3100";
const SHOTS = process.argv[2];
const PASSWORD = "test-password-1234";
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);
const results = [];
const users = [];

async function step(name, run) {
  try {
    const detail = await run();
    results.push(["ok", name, detail ?? ""]);
  } catch (error) {
    results.push(["FALLO", name, String(error).split("\n")[0].slice(0, 240)]);
  }
}

const must = ({ data, error }) => {
  if (error) throw error;
  return data;
};

async function user(name) {
  const email = `test-${randomUUID()}@cafam.test`;
  const { user } = must(
    await admin.auth.admin.createUser({
      email,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { display_name: name, time_zone: "Europe/Madrid" },
    }),
  );
  users.push(user.id);
  const own = must(
    await admin.from("calendars").select("id").eq("owner_id", user.id).single(),
  );
  return { id: user.id, email, calendar: own.id };
}

const at = (minutes) => new Date(Date.now() + minutes * 60_000).toISOString();

async function seed() {
  const mother = await user("Madre");
  const son = await user("Hijo");
  const aunt = await user("Tía");
  const others = [];
  for (const name of ["Pablo", "Lucía", "Mario", "Sara", "Iván", "Nora"]) {
    others.push(await user(name));
  }
  const members = [];
  const events = [];
  for (const person of [son, ...others]) {
    const extra = must(
      await admin
        .from("calendars")
        .insert([
          { owner_id: person.id, name: "Cole", color: "#FFADAD" },
          { owner_id: person.id, name: "Deporte", color: "#CAFFBF" },
        ])
        .select("id"),
    );
    const calendars = [person.calendar, ...extra.map((c) => c.id)];
    for (const id of calendars) {
      members.push({ calendar_id: id, user_id: mother.id, role: "viewer" });
    }
    // A day of events around now on each calendar.
    calendars.forEach((id, k) => {
      for (let h = -6; h <= 30; h += 3) {
        events.push({
          calendar_id: id,
          title: `Plan ${h + k}`,
          starts_at: at(h * 60 + k * 50 + 20),
          ends_at: at(h * 60 + k * 50 + 80),
          created_by: person.id,
        });
      }
    });
  }
  events.push(
    {
      calendar_id: son.calendar,
      title: "Mates",
      location: "Aula 3",
      starts_at: at(-30),
      ends_at: at(15),
      created_by: son.id,
    },
    {
      calendar_id: aunt.calendar,
      title: "Médico",
      location: "Clínica",
      starts_at: at(-15),
      ends_at: at(45),
      created_by: aunt.id,
    },
  );
  // The aunt shares nothing Mother can see but consents (spec 020).
  members.push({
    calendar_id: mother.calendar,
    user_id: aunt.id,
    role: "editor",
  });
  must(await admin.from("calendar_members").insert(members));
  must(await admin.from("events").insert(events));
  must(
    await admin.from("profiles").update({ share_busy: true }).eq("id", aunt.id),
  );
  must(
    await admin
      .from("person_preferences")
      .insert({ user_id: mother.id, person_id: aunt.id, show_busy: true }),
  );
  must(
    await admin.from("profiles").update({ home: "now" }).eq("id", mother.id),
  );
  return { mother, son, aunt };
}

const visible = (locator) => locator.locator("visible=true").first();

const browser = await chromium.launch({
  channel: process.env.E2E_CHANNEL ?? "msedge",
});
try {
  const { mother } = await seed();
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();

  await step("entrar abre Ahora (RF-25)", async () => {
    await page.goto(`${BASE}/login`);
    await page.getByLabel("Email").fill(mother.email);
    await page.getByLabel("Contraseña").fill(PASSWORD);
    await page.getByRole("button", { name: "Entrar" }).click();
    await page.waitForURL("**/dashboard/now", { timeout: 20_000 });
  });

  await step(
    "tarjetas: yo primero, en curso y ocupado (RF-2, RF-7, RF-13)",
    async () => {
      const regions = page.locator("main section[aria-labelledby]");
      await visible(page.getByRole("region", { name: "Hijo" })).waitFor();
      const names = await regions.locator("h2").allTextContents();
      if (names[0] !== "Madre (tú)")
        throw new Error(`orden ${names.join(", ")}`);
      if (names.length !== 9) throw new Error(`${names.length} tarjetas`);
      const son = visible(page.getByRole("region", { name: "Hijo" }));
      await son.getByRole("link", { name: "Mates" }).waitFor();
      await son
        .getByText(/^Mi calendario · Aula 3 · hasta las \d\d:\d\d$/)
        .waitFor();
      const aunt = visible(page.getByRole("region", { name: "Tía" }));
      await aunt.getByText(/^Ocupado hasta las \d\d:\d\d$/).waitFor();
      if (await aunt.getByText("Médico").count())
        throw new Error("título visible");
      return names.join(", ");
    },
  );

  await step("un evento se abre en la ventana @modal (RF-16, R1)", async () => {
    const son = visible(page.getByRole("region", { name: "Hijo" }));
    await son.getByRole("link", { name: "Mates" }).click();
    await page.waitForURL(/\/dashboard\/events\//);
    await visible(page.getByRole("dialog")).waitFor();
    // The board stays under the window: the route was intercepted.
    if (!(await page.getByRole("region", { name: "Hijo" }).count()))
      throw new Error("página completa, no ventana");
    await page.goBack();
    await page.waitForURL("**/dashboard/now");
  });

  await step("el nombre abre el día con solo esa persona (RF-17)", async () => {
    await visible(page.getByRole("region", { name: "Hijo" }))
      .getByRole("link", { name: "Hijo" })
      .click();
    await page.waitForURL(/view=day.*only=/);
    await visible(page.getByText("Viendo solo a Hijo")).waitFor();
    await visible(page.getByRole("button", { name: "Ver todos" })).click();
    await page.getByText("Viendo solo a Hijo").waitFor({ state: "detached" });
    if (page.url().includes("only=")) throw new Error(page.url());
  });

  await step(
    "barra inferior: Ahora, Calendario, Notas, Más (RF-23, D6)",
    async () => {
      const nav = visible(page.getByRole("navigation", { name: "Principal" }));
      const names = await nav.locator("li > a, li > button").allTextContents();
      return names.join(" · ");
    },
  );

  await step("pantalla de inicio en Ajustes (RF-24, RF-26)", async () => {
    await page.goto(`${BASE}/dashboard/settings`);
    const select = visible(page.getByLabel("Pantalla de inicio"));
    if ((await select.inputValue()) !== "now") throw new Error("no es now");
    await select.selectOption("calendar");
    await visible(page.getByText("Guardado.")).waitFor();
    await page.goto(`${BASE}/dashboard`);
    await page.waitForURL("**/dashboard/calendar**");
    const { home } = must(
      await admin.from("profiles").select("home").eq("id", mother.id).single(),
    );
    must(
      await admin.from("profiles").update({ home: "now" }).eq("id", mother.id),
    );
    return `guardado: ${home}`;
  });

  await step("medida con 8 personas y CPU 4x (RNF, R2)", async () => {
    const cdp = await context.newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    const time = async (path) => {
      const runs = [];
      for (let i = 0; i < 4; i++) {
        const t0 = Date.now();
        await page.goto(`${BASE}${path}`, { waitUntil: "commit" });
        await visible(page.getByRole("region", { name: "Hijo" }))
          .getByRole("link", { name: "Mates" })
          .waitFor();
        runs.push(Date.now() - t0);
      }
      // The first one warms the cache.
      return runs.slice(1);
    };
    const direct = await time("/dashboard/now");
    const home = await time("/dashboard");
    // A 307 from the proxy, not a redirect after the page's JS (R2).
    const response = await page.goto(`${BASE}/dashboard`);
    const server = response?.request().redirectedFrom()
      ? "servidor"
      : "cliente";
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
    return `/dashboard/now ${direct.join("/")} ms · /dashboard ${home.join("/")} ms (redirección en el ${server})`;
  });

  await step("escritorio: pestaña Ahora y varias columnas", async () => {
    const desk = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      storageState: await context.storageState(),
    });
    const deskPage = await desk.newPage();
    await deskPage.goto(`${BASE}/dashboard/now`);
    await visible(deskPage.getByRole("link", { name: "Ahora" })).waitFor();
    const current = await visible(
      deskPage.getByRole("link", { name: "Ahora" }),
    ).getAttribute("aria-current");
    if (current !== "page") throw new Error(`aria-current ${current}`);
    const scroll = await deskPage.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    if (scroll) throw new Error("scroll horizontal");
    await desk.close();
  });

  if (SHOTS) {
    await step(
      "capturas 390/768/1440, claro y oscuro, Violeta y Ámbar",
      async () => {
        mkdirSync(SHOTS, { recursive: true });
        const state = await context.storageState();
        let count = 0;
        for (const accent of ["red", "yellow"]) {
          for (const theme of ["light", "dark"]) {
            must(
              await admin
                .from("profiles")
                .update({ accent, theme })
                .eq("id", mother.id),
            );
            for (const width of [390, 768, 1440]) {
              const shot = await browser.newContext({
                viewport: {
                  width,
                  height: { 390: 844, 768: 1024 }[width] ?? 900,
                },
                deviceScaleFactor: 2,
                colorScheme: theme,
                isMobile: width < 500,
                hasTouch: width < 800,
                storageState: {
                  ...state,
                  cookies: [
                    ...state.cookies.filter((c) => c.name !== "cafam-theme"),
                    {
                      name: "cafam-theme",
                      value: theme,
                      domain: "localhost",
                      path: "/",
                      expires: -1,
                      httpOnly: false,
                      secure: false,
                      sameSite: "Lax",
                    },
                  ],
                },
              });
              const shotPage = await shot.newPage();
              await shotPage.goto(`${BASE}/dashboard/now`);
              await visible(
                shotPage.getByRole("region", { name: "Hijo" }),
              ).waitFor();
              await shotPage.waitForTimeout(500);
              const name = `ahora-${width}-${theme === "dark" ? "oscuro" : "claro"}-${accent === "red" ? "violeta" : "ambar"}.png`;
              await shotPage.screenshot({ path: join(SHOTS, name) });
              count += 1;
              await shot.close();
            }
          }
        }
        return `${count} capturas en ${SHOTS}`;
      },
    );
  }
  await context.close();
} finally {
  await browser.close();
  for (const id of users) await admin.auth.admin.deleteUser(id);
  await admin.from("email_outbox").delete().like("to_email", "%@cafam.test");
}

for (const [status, name, detail] of results) {
  console.log(`${status.padEnd(5)} ${name}${detail ? ` — ${detail}` : ""}`);
}
if (results.some(([status]) => status !== "ok")) process.exitCode = 1;
