// Spec 024: how much the blur behind the glass surfaces and the view
// transitions cost while scrolling and changing period (emulated iPhone, CPU
// 4x). Headless Chromium rasterizes in software, so read the numbers as a
// relative comparison, not as iPhone frame times.
//   node --env-file=.env.test.local scripts/perf/paint.mjs
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { createClient } from "@supabase/supabase-js";

const require = createRequire(import.meta.url);
const { chromium, devices } = require("playwright");
const BASE = process.env.PERF_BASE ?? "http://localhost:3100";
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY,
  {
    auth: { persistSession: false, autoRefreshToken: false },
  },
);

const email = `test-${randomUUID()}@cafam.test`;
const password = "test-password-1234";
const { data } = await admin.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
  user_metadata: { display_name: "Paint" },
});
const { data: own } = await admin
  .from("calendars")
  .select("id")
  .eq("owner_id", data.user.id)
  .single();
const rows = [];
const day0 = new Date();
day0.setUTCHours(0, 0, 0, 0);
for (let d = -20; d <= 50; d++)
  for (let k = 0; k < 3; k++) {
    const start = new Date(day0.getTime() + d * 864e5 + (8 + k * 4) * 36e5);
    rows.push({
      calendar_id: own.id,
      title: `Evento ${d} ${k}`,
      starts_at: start.toISOString(),
      ends_at: new Date(start.getTime() + 5400e3).toISOString(),
      created_by: data.user.id,
    });
  }
await admin.from("events").insert(rows);

const browser = await chromium.launch();
try {
  const context = await browser.newContext({ ...devices["iPhone 13"] });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await page.goto(`${BASE}/login`);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Contraseña").fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL(/dashboard\/calendar/);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });

  async function scrollFrames(view, css) {
    await page.goto(`${BASE}/dashboard/calendar?view=${view}`);
    await page.waitForLoadState("networkidle");
    if (css) await page.addStyleTag({ content: css });
    await page.waitForTimeout(800);
    return page.evaluate(async () => {
      const target =
        [...document.querySelectorAll("[data-grid-scroll]")].find(
          (el) => el.getClientRects().length,
        ) ?? document.scrollingElement;
      const frames = [];
      let last = performance.now();
      const t0 = last;
      await new Promise((done) => {
        const tick = () => {
          const now = performance.now();
          frames.push(now - last);
          last = now;
          target.scrollTop += 24;
          if (now - t0 < 2500) requestAnimationFrame(tick);
          else done();
        };
        requestAnimationFrame(tick);
      });
      frames.sort((a, b) => a - b);
      const blurred = [...document.querySelectorAll("*")].filter((el) => {
        const f = getComputedStyle(el).backdropFilter;
        return f && f !== "none" && el.getClientRects().length;
      }).length;
      return {
        frames: frames.length,
        medianMs: +frames[Math.floor(frames.length / 2)].toFixed(1),
        p95Ms: +frames[Math.floor(frames.length * 0.95)].toFixed(1),
        over33ms: frames.filter((f) => f > 33).length,
        blurredSurfaces: blurred,
      };
    });
  }
  const NO_BLUR =
    "*,*::before,*::after{backdrop-filter:none!important;-webkit-backdrop-filter:none!important}";
  const out = {};
  for (const view of ["agenda", "week"]) {
    out[view] = {
      asIs: await scrollFrames(view),
      withoutBlur: await scrollFrames(view, NO_BLUR),
    };
  }
  console.log(JSON.stringify(out, null, 2));
} finally {
  await browser.close();
  await admin.auth.admin.deleteUser(data.user.id);
  await admin.from("email_outbox").delete().like("to_email", "%@cafam.test");
}
