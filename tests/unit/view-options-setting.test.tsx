import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ViewOptionsSetting } from "@/components/settings/view-options-setting";

// Spec 019, T5: "Mostrar fines de semana" and the default duration in Ajustes (RF-23, RF-30).
function setup(result: { error?: string } = {}) {
  const saveWeekends = vi.fn(async () => result);
  const saveDuration = vi.fn(async () => result);
  render(
    <ViewOptionsSetting
      showWeekends
      duration={60}
      saveWeekends={saveWeekends}
      saveDuration={saveDuration}
    />,
  );
  return { saveWeekends, saveDuration };
}

describe("ViewOptionsSetting", () => {
  it("saves the weekends switch at once", async () => {
    const { saveWeekends } = setup();
    const box = screen.getByRole("switch", {
      name: "Mostrar fines de semana",
    });
    expect(box).toBeChecked();

    await userEvent.click(box);

    expect(saveWeekends).toHaveBeenCalledWith(false);
    expect(box).not.toBeChecked();
  });

  it("saves the duration of a new event", async () => {
    const { saveDuration } = setup();
    const select = screen.getByLabelText("Duración de un evento nuevo");
    expect(select).toHaveValue("60");
    expect(
      screen.getAllByRole("option").map((option) => option.textContent),
    ).toEqual(["15 min", "30 min", "45 min", "1 h", "1 h 30 min", "2 h"]);

    await userEvent.selectOptions(select, "30");

    expect(saveDuration).toHaveBeenCalledWith(30);
  });

  it("goes back and says why if saving fails", async () => {
    setup({ error: "No se ha podido guardar. Inténtalo de nuevo." });
    const box = screen.getByRole("switch", {
      name: "Mostrar fines de semana",
    });

    await userEvent.click(box);

    expect(
      await screen.findByText("No se ha podido guardar. Inténtalo de nuevo."),
    ).toBeVisible();
    expect(box).toBeChecked();
  });
});
