// Spec 046, T4: the trash (list, confirmation and empty). See capture-kit.mjs
// to run it.
import { admin, capture, BASE, wait } from "./capture-kit.mjs";

const DAY = 86_400_000;
const ago = (days) => new Date(Date.now() - days * DAY).toISOString();
const later = (days) => new Date(Date.now() + days * DAY).toISOString();

await capture("046-papelera-y-deshacer", {
  widths: [390, 768, 1440],
  async seed({ user, calendar }) {
    // Same keys in every row: PostgREST fills the missing ones with null.
    const base = {
      calendar_id: calendar.id,
      deleted_by: user.id,
      all_day: false,
      occurrences: null,
    };
    const { data, error } = await admin
      .from("event_trash")
      .insert([
        {
          ...base,
          kind: "event",
          title: "Dentista",
          starts_at: "2026-12-03T09:00:00Z",
          ends_at: "2026-12-03T10:00:00Z",
          created_at: ago(2),
          expires_at: later(28),
        },
        {
          ...base,
          kind: "series",
          title: "Clase de inglés",
          starts_at: "2026-09-14T16:00:00Z",
          ends_at: "2026-09-14T17:30:00Z",
          occurrences: 24,
          created_at: ago(5),
          expires_at: later(25),
        },
        {
          ...base,
          kind: "occurrence",
          title: "Cumpleaños de la abuela",
          starts_at: "2026-11-21T00:00:00Z",
          ends_at: "2026-11-22T00:00:00Z",
          all_day: true,
          created_at: ago(0),
          expires_at: later(30),
        },
      ])
      .select("id");
    if (error) throw error;
    return { ids: data.map((row) => row.id) };
  },
  async shoot({ page, save, ids }) {
    await page.goto(`${BASE}/dashboard/trash`);
    await page.getByText("Clase de inglés").first().waitFor();
    await wait(300);
    await save("lista");

    await page
      .getByRole("button", { name: /^Vaciar la papelera de/ })
      .locator("visible=true")
      .first()
      .click();
    await wait(300);
    await save("confirmar-vaciar");
    await page.keyboard.press("Escape");

    // Expired for a moment: the empty trash, then back.
    await admin
      .from("event_trash")
      .update({ expires_at: ago(1) })
      .in("id", ids);
    await page.goto(`${BASE}/dashboard/trash`);
    await page.getByText("La papelera está vacía").first().waitFor();
    await wait(300);
    await save("vacia");
    await admin
      .from("event_trash")
      .update({ expires_at: later(28) })
      .in("id", ids);
  },
});
