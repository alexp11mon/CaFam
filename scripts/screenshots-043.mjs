// Spec 043, T4: export and subscription link, plus a real check of both
// routes (a download with the session and the public feed without it).
// See capture-kit.mjs to run it.
import { capture, BASE, wait } from "./capture-kit.mjs";

let checked = false;

await capture("043-exportar-y-suscripcion-ics", {
  widths: [390, 1440],
  async seed({ admin, user, calendar }) {
    await admin.from("events").insert([
      {
        calendar_id: calendar.id,
        created_by: user.id,
        title: "Cena, en casa; con todos",
        location: "Casa de Lucía",
        starts_at: "2026-11-20T19:00:00Z",
        ends_at: "2026-11-20T21:00:00Z",
      },
      {
        calendar_id: calendar.id,
        created_by: user.id,
        title: "Clase de inglés",
        starts_at: "2026-11-05T17:00:00Z",
        ends_at: "2026-11-05T18:00:00Z",
        recurrence: "FREQ=WEEKLY;INTERVAL=1;BYDAY=TH",
        recurrence_tz: "Europe/Madrid",
      },
    ]);
    return { calendarId: calendar.id };
  },
  async shoot({ page, save, width, calendarId }) {
    await page.goto(`${BASE}/dashboard/calendars/${calendarId}/share`);
    await page
      .getByRole("button", { name: /Crear (enlace|uno nuevo)/ })
      .click();
    const field = page.getByRole("textbox", { name: "Enlace de suscripción" });
    await field.waitFor();
    const url = await field.inputValue();
    await page
      .getByRole("link", { name: "Abrir en Google Calendar" })
      .evaluate((el) => el.scrollIntoView({ block: "center" }));
    await wait(300);
    await save("compartir-suscripcion");

    if (!checked) {
      checked = true;
      // The public feed, without cookies.
      const feed = await fetch(url);
      const text = await feed.text();
      console.log(
        "feed",
        feed.status,
        feed.headers.get("content-type"),
        feed.headers.get("cache-control"),
        feed.headers.get("x-robots-tag"),
        text.includes("RRULE:FREQ=WEEKLY") &&
          text.includes("SUMMARY:Cena\\, en casa\\; con todos"),
      );
      const bad = await fetch(
        url.replace(/[A-Za-z0-9_-]{43}\.ics$/, "x".repeat(43) + ".ics"),
      );
      console.log("bad token", bad.status, (await bad.text()).length);
      // The download, with the session of the page.
      const download = await page.request.get(
        `${BASE}/api/ics/export?calendar=${calendarId}`,
      );
      console.log(
        "export",
        download.status(),
        download.headers()["content-disposition"],
        (await download.text()).includes("BEGIN:VCALENDAR"),
      );
    }

    await page.goto(`${BASE}/dashboard/calendars`);
    const row = page
      .getByRole("listitem")
      .filter({ hasText: "Mi calendario" })
      .locator("visible=true")
      .first();
    await row.getByRole("button", { expanded: false }).first().click();
    await row.getByRole("link", { name: /Exportar .*\(\.ics\)/ }).waitFor();
    await wait(300);
    await save("mis-calendarios-exportar");

    if (width >= 1024) {
      await page.goto(`${BASE}/dashboard/calendar?view=month&date=2026-11-20`);
      await page
        .getByRole("link", { name: "Exportar los visibles" })
        .evaluate((el) => el.scrollIntoView({ block: "center" }));
      await wait(400);
      await save("filtros-exportar");
    }
  },
});
