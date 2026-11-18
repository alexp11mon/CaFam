// Spec 041, T5: "Escribe el evento" with its preview, in the full form and in
// the quick window of the day view. See capture-kit.mjs to run it.
import { capture, BASE, wait } from "./capture-kit.mjs";

const PHRASE = "Cena con Ana el viernes a las 9 de la noche en casa de Lucía";

await capture("041-alta-en-lenguaje-natural", {
  widths: [390, 1440],
  async shoot({ page, save }) {
    await page.goto(`${BASE}/dashboard/events/new`);
    const field = page
      .getByLabel("Escribe el evento")
      .locator("visible=true")
      .first();
    await field.waitFor();
    await field.fill(PHRASE);
    await page.getByText("Cena con Ana · ").first().waitFor();
    await wait(300);
    await save("formulario-frase");
    await page
      .getByRole("button", { name: "Aplicar" })
      .locator("visible=true")
      .first()
      .click();
    await wait(300);
    await save("formulario-aplicado");

    // The quick window over a slot of the day view.
    await page.goto(`${BASE}/dashboard/calendar?view=day&date=2026-11-20`);
    const column = page.locator("[data-time-col]").first();
    await column.waitFor();
    const box = await column.boundingBox();
    await column.click({ position: { x: box.width / 2, y: 10 * 48 } });
    const quick = page.getByRole("dialog", { name: "Nuevo evento" });
    await quick.getByLabel("Escribe el evento").fill("Pádel 1h30 @mi");
    await quick.getByText(/^Pádel · /).waitFor();
    await wait(400);
    await save("alta-rapida-frase");
  },
});
