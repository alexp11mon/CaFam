import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { HomeSetting } from "@/components/settings/home-setting";

// Spec 054 T7: "Pantalla de inicio" in Ajustes (RF-24, RF-26).
describe("HomeSetting", () => {
  it("offers Calendario and Ahora and saves at once", async () => {
    const save = vi.fn(async () => ({}));
    render(<HomeSetting current="calendar" save={save} />);
    const select = screen.getByLabelText("Pantalla de inicio");
    expect(select).toHaveValue("calendar");
    expect(
      screen.getAllByRole("option").map((option) => option.textContent),
    ).toEqual(["Calendario", "Ahora"]);

    await userEvent.selectOptions(select, "now");
    expect(save).toHaveBeenCalledWith("now");
    expect(await screen.findByRole("status")).toHaveTextContent("Guardado.");
    expect(select).toHaveValue("now");
  });

  it("goes back and says why when saving fails", async () => {
    const save = vi.fn(async () => ({
      error: "No se ha podido guardar. Inténtalo de nuevo.",
    }));
    render(<HomeSetting current="now" save={save} />);
    const select = screen.getByLabelText("Pantalla de inicio");
    await userEvent.selectOptions(select, "calendar");
    expect(
      await screen.findByText("No se ha podido guardar. Inténtalo de nuevo."),
    ).toBeVisible();
    await waitFor(() => expect(select).toHaveValue("now"));
  });

  it("goes back on a lost connection", async () => {
    const save = vi.fn(async () => {
      throw new Error("offline");
    });
    render(<HomeSetting current="calendar" save={save} />);
    const select = screen.getByLabelText("Pantalla de inicio");
    await userEvent.selectOptions(select, "now");
    await waitFor(() => expect(select).toHaveValue("calendar"));
  });
});
