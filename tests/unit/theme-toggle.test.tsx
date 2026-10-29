import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeToggle } from "@/components/shell/theme-toggle";
import { ToastProvider } from "@/components/ui/toast";
import { THEME_COOKIE } from "@/lib/theme/theme";

// Spec 011, T8: the frame shortcut flips light and dark from what is on
// screen and saves it like Ajustes (RF-6; plan theme-toggle, D14).
const actions = vi.hoisted(() => ({
  setTheme: vi.fn<(theme: string) => Promise<{ error?: string }>>(
    async () => ({}),
  ),
}));
vi.mock("@/app/dashboard/settings/actions", () => actions);

const html = document.documentElement;
let systemDark = false;

beforeEach(() => {
  systemDark = false;
  actions.setTheme.mockClear();
  actions.setTheme.mockImplementation(async () => ({}));
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query.includes("dark") && systemDark,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
});

afterEach(() => {
  vi.unstubAllGlobals();
  html.removeAttribute("data-theme");
  document.cookie = `${THEME_COOKIE}=; max-age=0; path=/`;
});

function renderToggle() {
  render(
    <ToastProvider>
      <ThemeToggle className="row" />
    </ToastProvider>,
  );
}

describe("ThemeToggle (RF-6)", () => {
  it("offers the dark theme on the light one and saves it", async () => {
    renderToggle();

    await userEvent.click(
      screen.getByRole("button", { name: "Cambiar a tema oscuro" }),
    );

    expect(html.dataset.theme).toBe("dark");
    expect(actions.setTheme).toHaveBeenCalledWith("dark");
    expect(
      await screen.findByRole("button", { name: "Cambiar a tema claro" }),
    ).toBeInTheDocument();
  });

  it("reads the system theme when nothing was picked", () => {
    systemDark = true;
    renderToggle();

    expect(
      screen.getByRole("button", { name: "Cambiar a tema claro" }),
    ).toBeInTheDocument();
  });

  it("follows a theme changed elsewhere (Ajustes)", async () => {
    renderToggle();

    await act(async () => html.setAttribute("data-theme", "dark"));

    expect(
      await screen.findByRole("button", { name: "Cambiar a tema claro" }),
    ).toBeInTheDocument();
  });

  it("goes back and says so when saving fails", async () => {
    actions.setTheme.mockImplementation(async () => ({
      error: "No se ha podido guardar el tema. Inténtalo de nuevo.",
    }));
    renderToggle();

    await userEvent.click(
      screen.getByRole("button", { name: "Cambiar a tema oscuro" }),
    );

    expect(
      await screen.findByText(
        "No se ha podido guardar el tema. Inténtalo de nuevo.",
      ),
    ).toBeInTheDocument();
    // Back to what the device had: the system theme, without the attribute.
    expect(html.hasAttribute("data-theme")).toBe(false);
  });

  it("works with the keyboard", async () => {
    renderToggle();

    await userEvent.tab();
    expect(
      screen.getByRole("button", { name: "Cambiar a tema oscuro" }),
    ).toHaveFocus();
    await userEvent.keyboard("{Enter}");

    expect(actions.setTheme).toHaveBeenCalledWith("dark");
  });
});
