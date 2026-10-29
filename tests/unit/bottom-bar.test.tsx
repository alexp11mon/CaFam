import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { BottomBar } from "@/components/shell/bottom-bar";

// Spec 005, T6: the bottom bar and the "Más" sheet of the phone frame
// (RF-18, RF-20, RF-22; plan D9).
const navigation = vi.hoisted(() => ({ pathname: "/dashboard/calendar" }));
vi.mock("next/navigation", () => ({ usePathname: () => navigation.pathname }));
const actions = vi.hoisted(() => ({ setTheme: vi.fn(async () => ({})) }));
vi.mock("@/app/dashboard/settings/actions", () => actions);

// jsdom does not implement the modal methods of <dialog>.
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function close() {
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  };
});

beforeEach(() => {
  navigation.pathname = "/dashboard/calendar";
});

function renderBar(signOut = vi.fn(async () => {})) {
  render(<BottomBar signOutAction={signOut} />);
  return {
    signOut,
    nav: screen.getByRole("navigation", { name: "Principal" }),
  };
}

describe("BottomBar (RF-18, RF-22)", () => {
  it("offers the calendar, the list, a new event and more", () => {
    const { nav } = renderBar();

    expect(
      within(nav).getByRole("link", { name: "Calendario" }),
    ).toHaveAttribute("href", "/dashboard/calendar");
    expect(
      within(nav).getByRole("link", { name: "Mis calendarios" }),
    ).toHaveAttribute("href", "/dashboard/calendars");
    expect(within(nav).getByRole("link", { name: "+ Evento" })).toHaveAttribute(
      "href",
      "/dashboard/events/new",
    );
    expect(within(nav).getByRole("button", { name: "Más" })).toHaveAttribute(
      "aria-haspopup",
      "dialog",
    );
  });

  it("is hidden from 1024 px", () => {
    const { nav } = renderBar();

    expect(nav.className).toMatch(/lg:hidden/);
  });

  it("marks the current section (RF-20)", () => {
    navigation.pathname = "/dashboard/events/new";
    const { nav } = renderBar();

    expect(
      within(nav).getByRole("link", { name: "Calendario" }),
    ).toHaveAttribute("aria-current", "page");
  });
});

describe("Más sheet (RF-18, plan D9)", () => {
  it("opens with the other destinations and signing out", async () => {
    navigation.pathname = "/dashboard/settings";
    const { signOut } = renderBar();

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Más" }));

    const sheet = screen.getByRole("dialog", { name: "Más" });
    expect(
      within(sheet).getByRole("link", { name: "Unirme con código" }),
    ).toHaveAttribute("href", "/dashboard/join");
    expect(
      within(sheet).getByRole("link", { name: "Importar calendario" }),
    ).toHaveAttribute("href", "/dashboard/import");
    expect(
      within(sheet).getByRole("link", { name: "Ajustes" }),
    ).toHaveAttribute("aria-current", "page");

    await userEvent.click(
      within(sheet).getByRole("button", { name: "Cerrar sesión" }),
    );
    expect(signOut).toHaveBeenCalledTimes(1);
  });

  it("marks Más as current when the section lives in the sheet (RF-20)", () => {
    navigation.pathname = "/dashboard/import";
    renderBar();

    expect(screen.getByRole("button", { name: "Más" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("closes and gives the focus back to Más", async () => {
    renderBar();
    const more = screen.getByRole("button", { name: "Más" });

    await userEvent.click(more);
    await userEvent.click(screen.getByRole("button", { name: "Cerrar" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(more).toHaveFocus();
  });

  it("gives the focus back after Escape (the browser closes the dialog)", async () => {
    renderBar();
    const more = screen.getByRole("button", { name: "Más" });
    await userEvent.click(more);

    const sheet = screen.getByRole("dialog", { name: "Más" });
    sheet.removeAttribute("open");
    fireEvent(sheet, new Event("close"));

    expect(more).toHaveFocus();
  });

  it("closes when a destination is chosen", async () => {
    renderBar();
    await userEvent.click(screen.getByRole("button", { name: "Más" }));

    await userEvent.click(screen.getByRole("link", { name: "Ajustes" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

// Spec 011, T8: the theme shortcut of the phone frame (RF-6).
describe("MoreSheet theme shortcut (RF-6)", () => {
  it("is in the sheet and works with the keyboard", async () => {
    renderBar();
    await userEvent.click(screen.getByRole("button", { name: "Más" }));
    const sheet = screen.getByRole("dialog", { name: "Más" });
    const toggle = within(sheet).getByRole("button", {
      name: "Cambiar a tema oscuro",
    });

    toggle.focus();
    await userEvent.keyboard("{Enter}");

    expect(actions.setTheme).toHaveBeenCalledWith("dark");
    document.documentElement.removeAttribute("data-theme");
  });
});
