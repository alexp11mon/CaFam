// Spec 045, T4: "Zona horaria" in the full form and the original hours in the
// detail. See capture-kit.mjs to run it.
import { capture, BASE, wait } from "./capture-kit.mjs";

await capture("045-zona-horaria-por-evento", {
  widths: [390, 1440],
  async seed({ admin, user, calendar }) {
    const { data } = await admin
      .from("events")
      .insert({
        calendar_id: calendar.id,
        title: "Vuelo a Nueva York",
        // 10:00 in Madrid -> 13:00 in New York (8 h of flight).
        starts_at: "2026-12-01T09:00:00Z",
        ends_at: "2026-12-01T18:00:00Z",
        start_tz: "Europe/Madrid",
        end_tz: "America/New_York",
        location: "Barajas T4",
        created_by: user.id,
      })
      .select("id")
      .single();
    return { eventId: data.id };
  },
  async shoot({ page, save, eventId }) {
    await page.goto(`${BASE}/dashboard/events/${eventId}`);
    await page.getByTestId("event-original-time").first().waitFor();
    await wait(300);
    await save("detalle-hora-original");

    await page.goto(`${BASE}/dashboard/events/${eventId}?edit=1`);
    await page
      .getByLabel("Zona de fin")
      .locator("visible=true")
      .first()
      .waitFor();
    await wait(300);
    await save("formulario-dos-zonas");

    await page.goto(`${BASE}/dashboard/events/new`);
    await page
      .getByRole("button", { name: "Cambiar zona horaria" })
      .locator("visible=true")
      .first()
      .click();
    await wait(300);
    await save("formulario-zona");
  },
});
