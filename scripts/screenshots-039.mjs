// Spec 039, T4: the search with upcoming and past results, a hidden calendar
// and a matching comment, plus the empty state. See capture-kit.mjs to run it.
import { capture, BASE, wait } from "./capture-kit.mjs";

const day = (offset, hour) => {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + offset);
  date.setUTCHours(hour, 0, 0, 0);
  return date.toISOString();
};

await capture("039-busqueda-de-eventos", {
  widths: [390, 768, 1440],
  accents: ["red", "yellow"],
  async seed({ admin, user, calendar }) {
    const { data: work } = await admin
      .from("calendars")
      .insert({ owner_id: user.id, name: "Trabajo", color: "#FFD6A5" })
      .select("id")
      .single();
    await admin
      .from("calendar_preferences")
      .insert({ user_id: user.id, calendar_id: work.id, visible: false });
    const rows = [
      [calendar.id, "Dentista", "Clínica Sonrisas", 2, 8],
      [calendar.id, "Dentista con Lucía", "Clínica Sonrisas", 20, 15],
      [work.id, "Revisión anual", null, -30, 9],
    ];
    const ids = [];
    for (const [calendarId, title, location, offset, hour] of rows) {
      const { data } = await admin
        .from("events")
        .insert({
          calendar_id: calendarId,
          title,
          location,
          starts_at: day(offset, hour),
          ends_at: day(offset, hour + 1),
          created_by: user.id,
        })
        .select("id")
        .single();
      ids.push(data.id);
    }
    await admin.from("event_comments").insert({
      event_id: ids[2],
      author_id: user.id,
      body: "Al final pedí cita con el dentista de la empresa para el martes",
      client_id: crypto.randomUUID(),
    });
  },
  async shoot({ page, save }) {
    await page.goto(`${BASE}/dashboard/search?q=dentista`);
    await page.getByRole("region", { name: "Próximos" }).waitFor();
    await wait(500);
    await save("busqueda");
    await page.goto(`${BASE}/dashboard/search?q=zzzz`);
    await page.getByText(/Prueba con otra palabra/).waitFor();
    await wait(400);
    await save("busqueda-vacia");
  },
});
