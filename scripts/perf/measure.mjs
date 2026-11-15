// Spec 024: reproducible measurement of the calendar and the assistant on an
// emulated iPhone (Chromium, CPU 4x slower, 4G-like network). An approximation:
// the real test is an iPhone with Safari.
//
//   node scripts/perf/latency-proxy.mjs 30 &
//   NODE_OPTIONS="--import ./scripts/perf/mock-groq.mjs" GROQ_API_KEY=mock npx next start -p 3100 &
//   node --env-file=.env.test.local scripts/perf/measure.mjs [label]
//
// Writes scripts/perf/results/<label>.json and prints a table.
import { mkdirSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { gzipSync } from "node:zlib";
import { createRequire } from "node:module";
import { createClient } from "@supabase/supabase-js";

const require = createRequire(import.meta.url);
const { chromium, devices } = require("playwright");

const BASE = process.env.PERF_BASE ?? "http://localhost:3100";
const PROXY = process.env.PERF_PROXY ?? "http://127.0.0.1:54399";
const label = process.argv[2] ?? "run";
const CPU = Number(process.env.PERF_CPU ?? 4);
const NET = { latency: 100, down: (9e6 / 8) | 0, up: (2e6 / 8) | 0 };
const REPEAT = Number(process.env.PERF_REPEAT ?? 6);

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : null;
};
const round = (x) => (x == null ? null : Math.round(x));

async function seed() {
  const email = `test-${randomUUID()}@cafam.test`;
  const password = "test-password-1234";
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: "Perf", time_zone: "Europe/Madrid" },
  });
  if (error) throw error;
  const userId = data.user.id;
  const { data: own } = await admin
    .from("calendars")
    .select("id")
    .eq("owner_id", userId)
    .single();
  const extra = await admin
    .from("calendars")
    .insert([
      { owner_id: userId, name: "Trabajo", color: "#FFADAD" },
      { owner_id: userId, name: "Clase", color: "#CAFFBF" },
    ])
    .select("id");
  if (extra.error) throw extra.error;
  const calendars = [own.id, ...extra.data.map((c) => c.id)];
  const day0 = new Date();
  day0.setUTCHours(0, 0, 0, 0);
  const rows = [];
  // Three timed events a day for 7 months around today, plus weekly series.
  for (let d = -90; d <= 120; d++) {
    for (let k = 0; k < 3; k++) {
      const start = new Date(day0.getTime() + d * 864e5 + (8 + k * 4) * 36e5);
      rows.push({
        calendar_id: calendars[k],
        title: `Evento ${d} ${k}`,
        starts_at: start.toISOString(),
        ends_at: new Date(start.getTime() + 5400e3).toISOString(),
        created_by: userId,
        location: k === 0 ? "Oficina" : null,
      });
    }
  }
  for (let s = 0; s < 6; s++) {
    const start = new Date(
      day0.getTime() - 200 * 864e5 + s * 864e5 + 18 * 36e5,
    );
    rows.push({
      calendar_id: calendars[s % 3],
      title: `Serie ${s}`,
      starts_at: start.toISOString(),
      ends_at: new Date(start.getTime() + 36e5).toISOString(),
      created_by: userId,
      recurrence: "FREQ=WEEKLY",
      recurrence_tz: "Europe/Madrid",
    });
  }
  for (let i = 0; i < rows.length; i += 200) {
    const { error: e } = await admin
      .from("events")
      .insert(rows.slice(i, i + 200));
    if (e) throw e;
  }
  return { userId, email, password, events: rows.length };
}

async function proxyStats(reset = false) {
  const res = await fetch(`${PROXY}/${reset ? "__reset" : "__stats"}`);
  return reset ? null : res.json();
}

async function main() {
  const user = await seed();
  const browser = await chromium.launch();
  const context = await browser.newContext({ ...devices["iPhone 13"] });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  const out = {
    label,
    date: new Date().toISOString(),
    cpu: CPU,
    net: NET,
    seededEvents: user.events,
  };

  try {
    await page.goto(`${BASE}/login`);
    await page.getByLabel("Email").fill(user.email);
    await page.getByLabel("Contraseña").fill(user.password);
    await page.getByRole("button", { name: /Entrar|Iniciar/ }).click();
    await page.waitForURL(/dashboard\/calendar/);

    await cdp.send("Network.enable");
    await cdp.send("Network.emulateNetworkConditions", {
      offline: false,
      latency: NET.latency,
      downloadThroughput: NET.down,
      uploadThroughput: NET.up,
    });
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: CPU });

    // Requests and script bytes, per step.
    let requests = [];
    const sizes = new Map();
    cdp.on("Network.responseReceived", (e) =>
      sizes.set(e.requestId, { url: e.response.url, type: e.type, bytes: 0 }),
    );
    cdp.on("Network.loadingFinished", (e) => {
      const r = sizes.get(e.requestId);
      if (r) r.bytes = e.encodedDataLength;
    });
    page.on("request", (r) => requests.push(r.url()));
    const appRequests = () =>
      requests.filter(
        (u) => u.startsWith(BASE) && !u.includes("/_next/static/"),
      ).length;

    // PERF_NO_VT=1: without the View Transitions API, to see what it costs.
    if (process.env.PERF_NO_VT) {
      await page.addInitScript(() => {
        delete Document.prototype.startViewTransition;
      });
    }
    await page.addInitScript(() => {
      window.__perf = { long: [], cls: 0 };
      new PerformanceObserver((list) => {
        for (const e of list.getEntries()) window.__perf.long.push(e.duration);
      }).observe({ type: "longtask", buffered: true });
      new PerformanceObserver((list) => {
        for (const e of list.getEntries())
          if (!e.hadRecentInput) window.__perf.cls += e.value;
      }).observe({ type: "layout-shift", buffered: true });
    });

    // What the calendar shows now: changes when a new period is painted.
    const SIGNATURE = `(() => {
      const visible = (el) => el.getClientRects().length > 0;
      const days = [...document.querySelectorAll("[data-date],[data-allday-day]")]
        .filter(visible).slice(0, 3)
        .map((el) => el.dataset.date ?? el.dataset.alldayDay);
      return days.join(",");
    })()`;

    async function loadRoute(path, ready) {
      sizes.clear();
      requests = [];
      await proxyStats(true);
      // A first visit: nothing in the HTTP cache.
      await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
      const t0 = Date.now();
      await page.goto(`${BASE}${path}`);
      await ready();
      const ms = Date.now() - t0;
      await page.waitForLoadState("networkidle");
      await cdp.send("Network.setCacheDisabled", { cacheDisabled: false });
      const firstRequests = appRequests();
      // Queries on a normal load: without the HTTP cache Next renders twice.
      await proxyStats(true);
      await page.goto(`${BASE}${path}`);
      await ready();
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(1000);
      // Compressed bytes of every script the page asked for.
      const scripts = await page.evaluate(() =>
        performance
          .getEntriesByType("resource")
          .filter((e) => e.initiatorType === "script" || e.name.endsWith(".js"))
          .map((e) => e.name),
      );
      // `next start` does not compress; Vercel does: report both.
      let raw = 0;
      let gz = 0;
      for (const url of scripts) {
        const body = Buffer.from(await (await fetch(url)).arrayBuffer());
        raw += body.length;
        gz += gzipSync(body).length;
      }
      return {
        readyMs: ms,
        jsKb: round(raw / 1024),
        jsGzipKb: round(gz / 1024),
        jsFiles: scripts.length,
        appRequests: firstRequests,
        supabaseQueries: (await proxyStats()).total,
        supabasePaths: (await proxyStats()).paths,
      };
    }

    async function swipe(dir = -1, y = 420) {
      const from = dir < 0 ? 320 : 70;
      const to = dir < 0 ? 70 : 320;
      const touch = (type, x) =>
        cdp.send("Input.dispatchTouchEvent", {
          type,
          touchPoints: type === "touchEnd" ? [] : [{ x, y, id: 1 }],
        });
      await touch("touchStart", from);
      for (let i = 1; i <= 8; i++) {
        await touch("touchMove", from + ((to - from) * i) / 8);
        await page.waitForTimeout(12);
      }
      await touch("touchEnd", to);
    }

    async function periodChange(view) {
      await page.goto(`${BASE}/dashboard/calendar?view=${view}`);
      await page.waitForFunction(`${SIGNATURE} !== ""`);
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(1500);
      const dom = [];
      const settled = [];
      const queries = [];
      const reqs = [];
      const long = [];
      let cls = 0;
      for (let i = 0; i < REPEAT; i++) {
        await proxyStats(true);
        requests = [];
        const before = await page.evaluate(SIGNATURE);
        await page.evaluate(() => {
          window.__perf.long = [];
          window.__perf.cls = 0;
        });
        // Starts timing at the release of the finger.
        const waiter = page.evaluate(
          ([sig, before]) =>
            new Promise((done) => {
              let t0 = null;
              let domAt = null;
              addEventListener("pointerup", () => (t0 = performance.now()), {
                once: true,
                capture: true,
              });
              addEventListener("touchend", () => (t0 ??= performance.now()), {
                once: true,
                capture: true,
              });
              const tick = () => {
                const now = performance.now();
                if (
                  t0 !== null &&
                  domAt === null &&
                  eval(sig) !== before &&
                  eval(sig) !== ""
                )
                  domAt = now;
                if (domAt !== null && document.getAnimations().length === 0)
                  return done({ dom: domAt - t0, settled: now - t0 });
                if (t0 !== null && now - t0 > 15000)
                  return done({ dom: null, settled: null });
                requestAnimationFrame(tick);
              };
              requestAnimationFrame(tick);
            }),
          [SIGNATURE, before],
        );
        // Week and day: over the day header (the hour grid pans by itself before spec 024).
        await swipe(
          -1,
          view === "month" ? 420 : Number(process.env.PERF_SWIPE_Y ?? 110),
        );
        const result = await waiter;
        // Idle, as a person reading the new period (lets prefetches run).
        await page.waitForTimeout(1500);
        const perf = await page.evaluate(() => window.__perf);
        if (result.dom != null) {
          dom.push(result.dom);
          settled.push(result.settled);
        }
        queries.push((await proxyStats()).total);
        reqs.push(appRequests());
        long.push(perf.long.reduce((a, b) => a + b, 0));
        cls = Math.max(cls, perf.cls);
      }
      return {
        samples: dom.length,
        newPeriodMs: round(median(dom)),
        newPeriodMaxMs: round(Math.max(...dom)),
        settledMs: round(median(settled)),
        appRequests: median(reqs),
        supabaseQueries: median(queries),
        longTaskMs: round(median(long)),
        cls: Number(cls.toFixed(4)),
      };
    }

    out.calendarLoad = await loadRoute("/dashboard/calendar?view=month", () =>
      page.waitForFunction(`${SIGNATURE} !== ""`),
    );
    out.period = {};
    for (const view of ["month", "week", "day"])
      out.period[view] = await periodChange(view);

    // A period that is not loaded: a jump of some three months, past the window with "Ir a fecha".
    async function coldJump() {
      await page.goto(`${BASE}/dashboard/calendar?view=month`);
      await page.waitForFunction(`${SIGNATURE} !== ""`);
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(1000);
      const far = new Date(Date.now() + 100 * 864e5).toISOString().slice(0, 10);
      await page.keyboard.press("g");
      const field = page.locator('dialog[open] input[type="date"]');
      await field.fill(far);
      await proxyStats(true);
      requests = [];
      const before = await page.evaluate(SIGNATURE);
      const waiter = page.evaluate(
        ([sig, before]) =>
          new Promise((done) => {
            let t0 = null;
            let viewAt = null;
            addEventListener(
              "keydown",
              (e) => e.key === "Enter" && (t0 ??= performance.now()),
              { capture: true },
            );
            const tick = () => {
              const now = performance.now();
              if (
                t0 !== null &&
                viewAt === null &&
                eval(sig) !== before &&
                eval(sig) !== ""
              )
                viewAt = now;
              // Data: no longer busy and there are events on screen.
              const busy = document.querySelector('[aria-busy="true"]');
              const events = [
                ...document.querySelectorAll("[data-event-id]"),
              ].some((el) => el.getClientRects().length);
              if (viewAt !== null && !busy && events)
                return done({ view: viewAt - t0, data: now - t0 });
              if (t0 !== null && now - t0 > 15000)
                return done({ view: viewAt && viewAt - t0, data: null });
              requestAnimationFrame(tick);
            };
            requestAnimationFrame(tick);
          }),
        [SIGNATURE, before],
      );
      await field.press("Enter");
      const result = await waiter;
      await page.waitForTimeout(800);
      return {
        viewMs: round(result.view),
        dataMs: round(result.data),
        appRequests: appRequests(),
        supabaseQueries: (await proxyStats()).total,
      };
    }
    out.coldJump = await coldJump().catch((error) => ({
      error: String(error).slice(0, 200),
    }));

    // Opening the chat from the calendar.
    await page.goto(`${BASE}/dashboard/calendar?view=month`);
    await page.waitForFunction(`${SIGNATURE} !== ""`);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1500);
    const open = [];
    for (let i = 0; i < 3; i++) {
      const button = page
        .locator('[aria-label="Asistente"], [aria-label*="Venito"]')
        .locator("visible=true")
        .first();
      const t0 = Date.now();
      await button.tap();
      await page.locator("textarea").locator("visible=true").first().waitFor();
      open.push(Date.now() - t0);
      await page.waitForTimeout(800);
      if (i < 2) {
        const close = page
          .getByRole("button", { name: /Cerrar el chat|Cerrar el asistente/ })
          .locator("visible=true");
        if (await close.count()) await close.first().tap();
        else await page.goBack();
        await page.waitForTimeout(1000);
      }
    }
    out.chatOpen = { firstMs: open[0], repeatMs: round(median(open.slice(1))) };

    // One question (Groq mocked with a fixed delay per call: two calls).
    await proxyStats(true);
    const box = page.locator("textarea").locator("visible=true").first();
    await box.fill("¿Qué tengo hoy?");
    const answer = page.evaluate(
      () =>
        new Promise((done) => {
          const t0 = performance.now();
          const seen = new Set(
            [...document.querySelectorAll('[role="log"] *')].map(
              (el) => el.textContent,
            ),
          );
          let first = null;
          const tick = () => {
            const text =
              document.querySelector("main")?.textContent ??
              document.body.textContent ??
              "";
            const now = performance.now();
            // The first sign of life after sending that is not the question.
            if (
              first === null &&
              /Pensando|Buscando|Mirando|Consultando|escribiendo/i.test(text)
            )
              first = now - t0;
            if (/Hoy tienes varios eventos/.test(text))
              return done({ first, total: now - t0 });
            if (now - t0 > 30000) return done({ first, total: null });
            requestAnimationFrame(tick);
          };
          void seen;
          requestAnimationFrame(tick);
        }),
    );
    await box.press("Enter");
    const a = await answer;
    out.assistant = {
      mockGroqMsPerCall: Number(process.env.MOCK_GROQ_MS ?? 900),
      firstFeedbackMs: round(a.first),
      answerMs: round(a.total),
      supabaseQueries: (await proxyStats()).total,
    };

    out.assistantLoad = await loadRoute("/dashboard/assistant", () =>
      page.locator("textarea").locator("visible=true").first().waitFor(),
    );
  } finally {
    await browser.close();
    await admin.auth.admin.deleteUser(user.userId);
    await admin.from("email_outbox").delete().like("to_email", "%@cafam.test");
  }

  mkdirSync(new URL("./results/", import.meta.url), { recursive: true });
  writeFileSync(
    new URL(`./results/${label}.json`, import.meta.url),
    JSON.stringify(out, null, 2) + "\n",
  );
  console.log(JSON.stringify(out, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
