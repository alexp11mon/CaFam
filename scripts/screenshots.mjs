// Screenshots for the design review of P9 (constitution, amendment 10): each
// route at 390, 768 and 1440 px, light and dark, with the Coral and Sol accents.
//
//   npx next start -p 3100 &
//   node --env-file=.env.test.local scripts/screenshots.mjs <outDir> [route ...]
//
// SHOTS_SCALE (2 by default) sets the pixel ratio. SHOTS_WIDTHS, SHOTS_THEMES
// and SHOTS_ACCENTS (comma separated) narrow the
// set. It seeds a @cafam.test user with a few events and deletes it at the end.
import { mkdirSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const BASE = process.env.SHOTS_BASE ?? "http://localhost:3100";
const [outDir = "capturas", ...routes] = process.argv.slice(2);
const list = (name, fallback) => (process.env[name] ?? fallback).split(",");
const WIDTHS = list("SHOTS_WIDTHS", "390,768,1440").map(Number);
const THEMES = list("SHOTS_THEMES", "light,dark");
const ACCENTS = list("SHOTS_ACCENTS", "red,yellow");
const ROUTES = routes.length ? routes : ["/dashboard/calendar?view=month"];
const HEIGHT = { 390: 844, 768: 1024, 1440: 900 };
const ACCENT_NAME = {
  red: "coral",
  yellow: "sol",
  blue: "mar",
  green: "alga",
  purple: "lavanda",
  gray: "roca",
};

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

async function seed() {
  const email = `test-${randomUUID()}@cafam.test`;
  const password = "test-password-1234";
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: "Alex", time_zone: "Europe/Madrid" },
  });
  if (error) throw error;
  const userId = data.user.id;
  const { data: own } = await admin
    .from("calendars")
    .select("id")
    .eq("owner_id", userId)
    .single();
  const { data: extra } = await admin
    .from("calendars")
    .insert([
      { owner_id: userId, name: "Trabajo", color: "#FFADAD" },
      { owner_id: userId, name: "Clase", color: "#CAFFBF" },
    ])
    .select("id");
  const calendars = [own.id, ...extra.map((c) => c.id)];
  const day0 = new Date();
  day0.setUTCHours(0, 0, 0, 0);
  const titles = [
    "Dentista",
    "Turno de mañana",
    "Inglés",
    "Cena con Marta",
    "Fútbol de Pablo",
    "Reunión de equipo",
    "Compra",
    "Gimnasio",
  ];
  const rows = [];
  for (let d = -20; d <= 40; d++) {
    for (let k = 0; k < 3; k++) {
      if ((d * 7 + k * 3) % 4 === 0) continue;
      const start = new Date(day0.getTime() + d * 864e5 + (8 + k * 4) * 36e5);
      rows.push({
        calendar_id: calendars[(d + k + 60) % 3],
        title: titles[(d * 3 + k + 80) % titles.length],
        starts_at: start.toISOString(),
        ends_at: new Date(start.getTime() + 5400e3).toISOString(),
        all_day: false,
        created_by: userId,
        location: k === 1 ? "Oficina" : null,
      });
    }
  }
  rows.push({
    calendar_id: calendars[0],
    title: "Puente",
    starts_at: new Date(day0.getTime() + 3 * 864e5).toISOString(),
    ends_at: new Date(day0.getTime() + 6 * 864e5).toISOString(),
    all_day: true,
    created_by: userId,
  });
  const { error: insertError } = await admin.from("events").insert(rows);
  if (insertError) throw insertError;
  return { userId, email, password };
}

const slug = (route) =>
  route
    .replace(/^\/+/, "")
    .replace(/[?&=/]+/g, "-")
    .replace(/-+$/, "") || "inicio";

const user = await seed();
const browser = await chromium.launch();
try {
  mkdirSync(outDir, { recursive: true });
  for (const accent of ACCENTS) {
    await admin.from("profiles").update({ accent }).eq("id", user.userId);
    for (const theme of THEMES) {
      await admin.from("profiles").update({ theme }).eq("id", user.userId);
      for (const width of WIDTHS) {
        const context = await browser.newContext({
          viewport: { width, height: HEIGHT[width] ?? 900 },
          deviceScaleFactor: Number(process.env.SHOTS_SCALE ?? 2),
          colorScheme: theme === "dark" ? "dark" : "light",
          isMobile: width < 500,
          hasTouch: width < 800,
        });
        const page = await context.newPage();
        await page.goto(`${BASE}/login`);
        await page.getByLabel("Email").fill(user.email);
        await page.getByLabel("Contraseña").fill(user.password);
        await page.getByRole("button", { name: "Entrar" }).click();
        await page.waitForURL(/dashboard/);
        for (const route of ROUTES) {
          await page.goto(`${BASE}${route}`);
          await page.waitForLoadState("networkidle");
          await page.waitForTimeout(400);
          const file = join(
            outDir,
            `${slug(route)}-${width}-${theme === "dark" ? "oscuro" : "claro"}-${ACCENT_NAME[accent] ?? accent}.png`,
          );
          await page.screenshot({ path: file });
          console.log(file);
        }
        await context.close();
      }
    }
  }
} finally {
  await browser.close();
  await admin.auth.admin.deleteUser(user.userId);
  await admin.from("email_outbox").delete().like("to_email", "%@cafam.test");
}
