// Shared helpers for the screenshot scripts of specs 038 onward: a new
// @cafam.test user signed up through /signup, an admin client to seed data,
// shots at 390 and 1440 px in light and dark, and the user deleted at the end.
//
//   npx next start -p 3100 &
//   NODE_PATH=<global node_modules> node --env-file=.env.test.local scripts/screenshots-0NN.mjs
import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { createClient } from "@supabase/supabase-js";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
export const BASE = process.env.E2E_BASE ?? "http://localhost:3100";
export const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);
export const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Signs a new user up, runs `seed({ admin, user, calendar })` and then, for
 * each width and scheme, `shoot({ page, width, theme, save })`.
 */
export async function capture(spec, { name = "Ana Capturas", seed, shoot }) {
  const out = `specs/${spec}/capturas`;
  mkdirSync(out, { recursive: true });
  const email = `test-${randomUUID()}@cafam.test`;
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
    await page.getByLabel("Nombre visible").fill(name);
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Contraseña").fill("test-password-1234");
    await page.getByRole("button", { name: "Crear cuenta" }).click();
    await page.waitForURL("**/dashboard/calendar**");
    const { data: users } = await admin.auth.admin.listUsers({ perPage: 1000 });
    const user = users.users.find((u) => u.email === email);
    const { data: calendar } = await admin
      .from("calendars")
      .select("id")
      .eq("owner_id", user.id)
      .single();
    const seeded = (await seed?.({ admin, user, calendar, page })) ?? {};
    for (const scheme of ["light", "dark"]) {
      await page.emulateMedia({ colorScheme: scheme });
      const theme = scheme === "light" ? "claro" : "oscuro";
      for (const [width, height] of [
        [390, 844],
        [1440, 900],
      ]) {
        await page.setViewportSize({ width, height });
        const save = (file) =>
          page.screenshot({ path: `${out}/${file}-${width}-${theme}.png` });
        await shoot({ page, width, theme, save, ...seeded });
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
}
