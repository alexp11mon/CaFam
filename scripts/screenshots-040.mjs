// Spec 040, T6: "Notificaciones" in Ajustes and "Avisarme" in the detail of
// an event seen by a Lector. See capture-kit.mjs to run it.
import { capture, BASE, wait } from "./capture-kit.mjs";

const soon = (hours) => {
  const date = new Date(Date.now() + hours * 3_600_000);
  date.setUTCMinutes(0, 0, 0);
  return date.toISOString();
};

let eventId;

await capture("040-recordatorios-y-notificaciones", {
  widths: [390, 768, 1440],
  async seed({ admin, user, calendar }) {
    await admin.from("push_subscriptions").insert([
      {
        user_id: user.id,
        endpoint: `https://push.example.test/${user.id}/1`,
        p256dh: "k",
        auth: "a",
        device: "Safari en iPhone",
      },
      {
        user_id: user.id,
        endpoint: `https://push.example.test/${user.id}/2`,
        p256dh: "k",
        auth: "a",
        device: "Chrome en Windows",
      },
    ]);
    const { data } = await admin
      .from("events")
      .insert({
        calendar_id: calendar.id,
        title: "Cena con los abuelos",
        location: "Calle Mayor 3",
        starts_at: soon(26),
        ends_at: soon(28),
        created_by: user.id,
      })
      .select("id")
      .single();
    eventId = data.id;
    await admin
      .from("event_reminders")
      .insert({ user_id: user.id, event_id: eventId, minutes: [30, 1440] });
  },
  async shoot({ page, save }) {
    await page.goto(`${BASE}/dashboard/settings`);
    const section = page.getByRole("region", { name: "Notificaciones" });
    await section.getByText("Dispositivos con avisos").waitFor();
    await section.scrollIntoViewIfNeeded();
    await wait(500);
    await save("ajustes-notificaciones");
    await page.goto(`${BASE}/dashboard/events/${eventId}`);
    const group = page.getByRole("group", { name: "Avisarme" });
    await group.waitFor();
    await group.scrollIntoViewIfNeeded();
    await wait(400);
    await save("detalle-avisarme");
  },
});
