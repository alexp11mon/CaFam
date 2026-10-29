import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ThemePicker } from "@/components/settings/theme-picker";
import type { ThemeId } from "@/lib/theme/theme";

// Spec 011, T7: the three themes in Ajustes, applied at once and undone if
// they cannot be saved (RF-1, RF-3, RF-4; plan theme-picker).
const applied = vi.hoisted(() => [] as string[]);

vi.mock("@/lib/theme/apply-theme", () => ({
  applyTheme: (theme: string) => applied.push(theme),
}));

type Result = { error?: string };

function renderPicker(
  setTheme: (theme: ThemeId) => Promise<Result> = vi.fn(async () => ({})),
  current: ThemeId = "system",
) {
  render(<ThemePicker current={current} setTheme={setTheme} />);
  return setTheme;
}

beforeEach(() => {
  applied.length = 0;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ThemePicker (RF-1)", () => {
  it("offers the three themes by name with the current one checked", () => {
    renderPicker(undefined, "dark");

    expect(
      screen.getByRole("radiogroup", { name: "Tema" }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("radio").map((radio) => radio.getAttribute("value")),
    ).toEqual(["light", "dark", "system"]);
    for (const name of ["Claro", "Oscuro", "Como el sistema"]) {
      expect(screen.getByRole("radio", { name })).toBeInTheDocument();
    }
    expect(screen.getByRole("radio", { name: "Oscuro" })).toBeChecked();
  });
});

describe("choosing a theme (RF-3, RF-4)", () => {
  it("applies it before saving it", async () => {
    const setTheme = renderPicker();

    await userEvent.click(screen.getByRole("radio", { name: "Oscuro" }));

    expect(applied).toEqual(["dark"]);
    expect(setTheme).toHaveBeenCalledWith("dark");
    expect(screen.getByRole("radio", { name: "Oscuro" })).toBeChecked();
  });

  it("goes back to the previous theme and explains it when saving fails", async () => {
    renderPicker(
      vi.fn(async () => ({
        error: "No se ha podido guardar el tema. Inténtalo de nuevo.",
      })),
      "light",
    );

    await userEvent.click(screen.getByRole("radio", { name: "Oscuro" }));

    expect(
      await screen.findByText(
        "No se ha podido guardar el tema. Inténtalo de nuevo.",
      ),
    ).toBeInTheDocument();
    expect(applied).toEqual(["dark", "light"]);
    await waitFor(() =>
      expect(screen.getByRole("radio", { name: "Claro" })).toBeChecked(),
    );
  });

  it("treats a thrown action as a connection error", async () => {
    renderPicker(
      vi.fn(async () => {
        throw new TypeError("fetch failed");
      }),
      "light",
    );

    await userEvent.click(
      screen.getByRole("radio", { name: "Como el sistema" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(/conectar/);
    expect(applied).toEqual(["system", "light"]);
  });
});
