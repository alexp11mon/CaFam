// Spec 042, T5: the year view, the 4 days and "Más vistas" on a phone, plus
// the RNF-1 measure (changing year with the CPU 4× slower). See
// capture-kit.mjs to run it.
import { capture, BASE, wait } from "./capture-kit.mjs";

const at = (date, hour) => `${date}T${String(hour).padStart(2, "0")}:00:00Z`;

const measures = [];

await capture("042-vistas-de-ano-y-4-dias", {
  widths: [390, 768, 1440],
  async seed({ admin, user, calendar }) {
    const { data: work } = await admin
      .from("calendars")
      .insert({ owner_id: user.id, name: "Trabajo", color: "#FFD6A5" })
      .select("id")
      .single();
    const rows = [];
    // A few events every month of 2026 in both calendars.
    for (let month = 1; month <= 12; month += 1) {
      for (const day of [3, 9, 14, 22, 27]) {
        const date = `2026-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        rows.push({
          calendar_id: (day + month) % 2 ? calendar.id : work.id,
          title: day % 3 ? "Cena familiar" : "Reunión",
          starts_at: at(date, 17),
          ends_at: at(date, 18),
          created_by: user.id,
        });
      }
    }
    rows.push(
      {
        calendar_id: calendar.id,
        title: "Pádel",
        starts_at: at("2026-11-21", 9),
        ends_at: at("2026-11-21", 10),
        created_by: user.id,
      },
      {
        calendar_id: work.id,
        title: "Entrega del proyecto",
        starts_at: at("2026-11-23", 8),
        ends_at: at("2026-11-23", 11),
        created_by: user.id,
      },
      {
        calendar_id: calendar.id,
        title: "Viaje a Lisboa",
        all_day: true,
        starts_at: "2026-11-21T00:00:00Z",
        ends_at: "2026-11-23T00:00:00Z",
        created_by: user.id,
      },
      {
        calendar_id: work.id,
        title: "Clase de inglés",
        starts_at: at("2026-01-05", 18),
        ends_at: at("2026-01-05", 19),
        recurrence: "FREQ=WEEKLY;INTERVAL=1;BYDAY=MO",
        recurrence_tz: "Europe/Madrid",
        created_by: user.id,
      },
    );
    // The same keys in every row, or PostgREST sends null for the missing ones.
    const full = rows.map((row) => ({
      all_day: false,
      recurrence: null,
      recurrence_tz: null,
      ...row,
    }));
    const { error } = await admin.from("events").insert(full);
    if (error) throw error;
  },
  async shoot({ page, width, theme, save }) {
    await page.goto(`${BASE}/dashboard/calendar?view=year&date=2026-11-19`);
    await page.locator("[data-testid=year-grid] [data-dot]").first().waitFor();
    await wait(500);
    await save("anio");

    await page.goto(`${BASE}/dashboard/calendar?view=4days&date=2026-11-20`);
    await page.getByText("Entrega del proyecto").first().waitFor();
    await wait(500);
    await save("cuatro-dias");

    if (width === 390) {
      await page
        .getByRole("button", { name: /Más vistas/ })
        .locator("visible=true")
        .first()
        .click();
      await wait(400);
      await save("mas-vistas");
    }

    // RNF-1: once with the desktop and the light theme.
    if (width === 1440 && theme === "claro") {
      await page.goto(`${BASE}/dashboard/calendar?view=year&date=2026-11-19`);
      await page
        .locator("[data-testid=year-grid] [data-dot]")
        .first()
        .waitFor();
      await wait(1500); // the next year is read in idle time
      const cdp = await page.context().newCDPSession(page);
      await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
      for (const [label, expected] of [
        ["Año siguiente", "2027"],
        ["Año anterior", "2026"],
        ["Año siguiente", "2027"],
      ]) {
        const ms = await page.evaluate(
          ([label, expected]) =>
            new Promise((resolve) => {
              const link = [...document.querySelectorAll("a")].find(
                (a) =>
                  a.getAttribute("aria-label") === label &&
                  a.offsetParent !== null,
              );
              const start = performance.now();
              link.click();
              const check = () => {
                const title = [...document.querySelectorAll("h2")].find(
                  (h) => h.textContent === expected && h.offsetParent !== null,
                );
                const days = document.querySelectorAll(
                  `a[href*="date=${expected}-03-05"]`,
                );
                if (title && days.length > 0) {
                  requestAnimationFrame(() =>
                    resolve(Math.round(performance.now() - start)),
                  );
                } else requestAnimationFrame(check);
              };
              requestAnimationFrame(check);
            }),
          [label, expected],
        );
        measures.push(`${label}: ${ms} ms`);
        await wait(1500);
      }
      await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
    }
  },
});

console.log("RNF-1 (CPU 4×):", measures.join("; "));
