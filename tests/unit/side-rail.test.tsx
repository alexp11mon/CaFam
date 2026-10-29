import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SideRail } from "@/components/shell/side-rail";

// Spec 005, T6: the narrow side rail of the desktop frame (RF-16, RF-20, RF-51).
const navigation = vi.hoisted(() => ({ pathname: "/dashboard/calendar" }));
vi.mock("next/navigation", () => ({ usePathname: () => navigation.pathname }));

beforeEach(() => {
  navigation.pathname = "/dashboard/calendar";
});

function renderRail(signOut = vi.fn(async () => {})) {
  render(<SideRail signOutAction={signOut} />);
  return {
    signOut,
    nav: screen.getByRole("navigation", { name: "Principal" }),
  };
}

describe("SideRail (RF-16)", () => {
  it("shows the brand and every destination by name", () => {
    const { nav } = renderRail();

    expect(within(nav).getByRole("link", { name: /CaFam/ })).toHaveAttribute(
      "href",
      "/dashboard/calendar",
    );
    for (const [name, href] of [
      ["Calendario", "/dashboard/calendar"],
      ["Mis calendarios", "/dashboard/calendars"],
      ["Unirme con código", "/dashboard/join"],
      ["Importar calendario", "/dashboard/import"],
      ["Ajustes", "/dashboard/settings"],
    ]) {
      expect(within(nav).getByRole("link", { name })).toHaveAttribute(
        "href",
        href,
      );
    }
    expect(
      within(nav).getByRole("button", { name: "Cerrar sesión" }),
    ).toBeInTheDocument();
  });

  it("marks the current section (RF-20)", () => {
    navigation.pathname = "/dashboard/calendars/0f6c/share";
    const { nav } = renderRail();

    expect(
      within(nav).getByRole("link", { name: "Mis calendarios" }),
    ).toHaveAttribute("aria-current", "page");
    expect(
      within(nav).getByRole("link", { name: "Calendario" }),
    ).not.toHaveAttribute("aria-current");
  });

  it("signs out through the form", async () => {
    const { signOut, nav } = renderRail();

    await userEvent.click(
      within(nav).getByRole("button", { name: "Cerrar sesión" }),
    );

    expect(signOut).toHaveBeenCalledTimes(1);
  });

  it("is hidden below 1024 px", () => {
    const { nav } = renderRail();

    expect(nav.className).toMatch(/(^|\s)hidden(\s|$)/);
    expect(nav.className).toMatch(/lg:flex/);
  });
});
