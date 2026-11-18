// Spec 038, T3: the detail of an old event of a synced calendar says it is a
// copy that is no longer updated (RF-6). See capture-kit.mjs to run it.
import { capture, BASE, wait } from "./capture-kit.mjs";

await capture("038-sincronizacion-sin-borrar-fuera-de-ventana", {
  async seed({ admin, user }) {
    const { data: connection, error } = await admin
      .from("calendar_connections")
      .insert({
        owner_id: user.id,
        provider: "google",
        account_subject: `cap-${user.id}`,
        account_email: "capturas@gmail.test",
        can_write: true,
      })
      .select("id")
      .single();
    if (error) throw error;
    const { data: calendar } = await admin
      .from("calendars")
      .insert({ owner_id: user.id, name: "Trabajo (Google)", color: "#CAFFBF" })
      .select("id")
      .single();
    const synced = await admin.from("synced_calendars").insert({
      calendar_id: calendar.id,
      connection_id: connection.id,
      provider: "google",
      external_id: "cap-cal",
      google_access: "owner",
    });
    if (synced.error) throw synced.error;
    const { data: event } = await admin
      .from("events")
      .insert({
        calendar_id: calendar.id,
        external_id: "old-1",
        title: "Congreso en Valencia",
        location: "Palacio de Congresos",
        starts_at: "2025-03-12T08:00:00Z",
        ends_at: "2025-03-12T16:00:00Z",
        created_by: user.id,
      })
      .select("id")
      .single();
    return { eventId: event.id };
  },
  async shoot({ page, save, eventId }) {
    await page.goto(`${BASE}/dashboard/events/${eventId}`);
    await page
      .getByText(/Copia antigua/)
      .first()
      .waitFor();
    await wait(400);
    await save("detalle-copia-antigua");
  },
});
