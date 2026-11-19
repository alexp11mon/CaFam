// Spec 044, T5: import into a calendar that exists, keep it updated from its
// link, and a real refresh against a public .ics (a link served from
// localhost is refused by the anti-SSRF check of spec 004). See capture-kit.mjs.
import { admin, capture, BASE, wait } from "./capture-kit.mjs";

const FEED =
  "https://calendar.google.com/calendar/ical/es.spain%23holiday%40group.v.calendar.google.com/public/basic.ics";

let checked = false;

async function subscription(admin, calendarId) {
  const { data } = await admin
    .from("ics_subscriptions")
    .select("state, feed_ids, last_summary, attempted_at")
    .eq("calendar_id", calendarId)
    .maybeSingle();
  return data;
}

await capture("044-importar-y-actualizar-ics", {
  widths: [390, 1440],
  async seed({ user, calendar, page }) {
    // The real import, through the form, with "Mantener actualizado".
    await page.goto(`${BASE}/dashboard/import`);
    await page.getByLabel("Enlace .ics").locator("visible=true").fill(FEED);
    await page.getByLabel("Un calendario que ya tengo").check();
    await page
      .getByRole("checkbox", { name: "Mantener actualizado desde este enlace" })
      .check();
    await page.getByRole("button", { name: "Importar calendario" }).click();
    await page.getByText(/Se han? añadido/).waitFor({ timeout: 30_000 });
    const sub = await subscription(admin, calendar.id);
    console.log("subscribed", sub?.state, sub?.feed_ids.length, "ids");
    return { calendarId: calendar.id, userId: user.id };
  },
  async shoot({ page, save, calendarId }) {
    await page.goto(`${BASE}/dashboard/import`);
    await page.getByLabel("Un calendario que ya tengo").check();
    await page
      .getByRole("checkbox", { name: "Mantener actualizado desde este enlace" })
      .check();
    await wait(300);
    await save("importar-destino");

    if (!checked) {
      checked = true;
      // Pretend the link changed: one of its events is gone from CaFam and a
      // stale one from it is still there. "Actualizar ahora" must fix both.
      const sub = await subscription(admin, calendarId);
      // One inside the window a refresh reads (today −6 to +12 months).
      const { data: inside } = await admin
        .from("events")
        .select("id, title")
        .eq("calendar_id", calendarId)
        .not("external_id", "is", null)
        .gt("starts_at", new Date().toISOString())
        .order("starts_at")
        .limit(1)
        .single();
      await admin.from("events").delete().eq("id", inside.id);
      console.log("deleted", inside.title);
      await admin.from("events").insert({
        calendar_id: calendarId,
        title: "Ya no está en el enlace",
        starts_at: "2026-12-30T09:00:00Z",
        ends_at: "2026-12-30T10:00:00Z",
        external_id: "stale@cafam.test",
      });
      await admin
        .from("ics_subscriptions")
        .update({
          feed_ids: [...sub.feed_ids, "stale@cafam.test"],
          attempted_at: "2026-01-01T00:00:00Z",
          last_read_at: new Date(Date.now() + 60_000).toISOString(),
        })
        .eq("calendar_id", calendarId);
      await page.goto(`${BASE}/dashboard/calendars`);
      const row = page
        .getByRole("listitem")
        .filter({ hasText: "Mi calendario" })
        .locator("visible=true")
        .first();
      await row.getByRole("button", { expanded: false }).first().click();
      await row.getByRole("button", { name: /Actualizar ahora/ }).click();
      await page
        .getByText("Calendario actualizado desde su enlace.")
        .waitFor({ timeout: 30_000 });
      const after = await subscription(admin, calendarId);
      console.log("refresh", JSON.stringify(after.last_summary));
      // Too soon for another one.
      await row.getByRole("button", { name: /Actualizar ahora/ }).click();
      await page.getByText(/espera unos minutos/).waitFor();
      console.log("too soon ok");
    }

    await page.goto(`${BASE}/dashboard/calendars`);
    const row = page
      .getByRole("listitem")
      .filter({ hasText: "Mi calendario" })
      .locator("visible=true")
      .first();
    await row.getByRole("button", { expanded: false }).first().click();
    await row
      .getByText(/desde un enlace/)
      .first()
      .waitFor();
    await wait(300);
    await save("mis-calendarios-enlace");
  },
});
