import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AccentPicker } from "@/components/settings/accent-picker";
import type { AccentId } from "@/lib/theme/accents";

// Spec 005, T7: choosing the accent applies it at once and undoes it if it
// cannot be saved (RF-6, RF-7, RF-12; plan accent-picker).
type Result = { error?: string };

function renderPicker(
  setAccent: (accent: AccentId) => Promise<Result> = vi.fn(async () => ({})),
  current: AccentId = "red",
) {
  const { container } = render(
    <div data-app-frame="" data-accent={current}>
      <AccentPicker current={current} setAccent={setAccent} />
    </div>,
  );
  const frame = container.querySelector<HTMLElement>("[data-app-frame]")!;
  return { setAccent, frame };
}

describe("AccentPicker (RF-6)", () => {
  it("offers the six accents by name with the current one checked", () => {
    renderPicker(undefined, "purple");

    const group = screen.getByRole("radiogroup", { name: "Color de acento" });
    expect(group).toBeInTheDocument();
    expect(
      screen.getAllByRole("radio").map((radio) => radio.getAttribute("value")),
    ).toEqual(["red", "blue", "green", "yellow", "purple", "gray"]);
    for (const name of [
      "Rojo",
      "Azul",
      "Verde",
      "Amarillo",
      "Morado",
      "Gris",
    ]) {
      expect(screen.getByRole("radio", { name })).toBeInTheDocument();
    }
    expect(screen.getByRole("radio", { name: "Morado" })).toBeChecked();
  });
});

describe("choosing an accent (RF-7, RF-8)", () => {
  it("repaints the frame before the save answers, then saves", async () => {
    let finish: (result: Result) => void = () => {};
    const setAccent = vi.fn(
      () => new Promise<Result>((resolve) => (finish = resolve)),
    );
    const { frame } = renderPicker(setAccent);

    await userEvent.click(screen.getByRole("radio", { name: "Verde" }));

    expect(frame).toHaveAttribute("data-accent", "green");
    expect(setAccent).toHaveBeenCalledWith("green");
    finish({});
    await waitFor(() =>
      expect(screen.getByRole("radio", { name: "Verde" })).toBeChecked(),
    );
    expect(frame).toHaveAttribute("data-accent", "green");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("works with the keyboard", async () => {
    const { setAccent, frame } = renderPicker();

    await userEvent.tab();
    expect(screen.getByRole("radio", { name: "Rojo" })).toHaveFocus();
    await userEvent.keyboard("{ArrowRight}");

    expect(screen.getByRole("radio", { name: "Azul" })).toBeChecked();
    expect(frame).toHaveAttribute("data-accent", "blue");
    expect(setAccent).toHaveBeenCalledWith("blue");
  });
});

describe("when saving fails (RF-12)", () => {
  it("goes back to the previous accent and says why", async () => {
    const setAccent = vi.fn(async () => ({
      error: "No se ha podido guardar el color. Inténtalo de nuevo.",
    }));
    const { frame } = renderPicker(setAccent, "blue");

    await userEvent.click(screen.getByRole("radio", { name: "Amarillo" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No se ha podido guardar el color. Inténtalo de nuevo.",
    );
    expect(screen.getByRole("radio", { name: "Azul" })).toBeChecked();
    expect(frame).toHaveAttribute("data-accent", "blue");
  });

  it("treats a thrown error as a connection failure", async () => {
    const setAccent = vi.fn(async (): Promise<Result> => {
      throw new TypeError("fetch failed");
    });
    const { frame } = renderPicker(setAccent);

    await userEvent.click(screen.getByRole("radio", { name: "Gris" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No se ha podido conectar",
    );
    expect(frame).toHaveAttribute("data-accent", "red");
  });
});
