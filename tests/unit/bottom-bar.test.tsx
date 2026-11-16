import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { BottomBar } from "@/components/shell/bottom-bar";
import { CreateButton } from "@/components/shell/create-fab";

// The bottom bar and the "Más" sheet (spec 005 T6: RF-18, RF-20, RF-22, plan
// D9), rewritten for the frame of spec 025 (RF-8, plan D7): two destinations
// on each side of "+".
const navigation = vi.hoisted(() => ({
  pathname: "/dashboard/calendar",
  push: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
  useRouter: () => ({ push: navigation.push }),
}));
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
  navigation.push.mockReset();
  history.replaceState(null, "", "/dashboard/calendar");
});

function renderBar(signOut = vi.fn(async () => {})) {
  render(<BottomBar signOutAction={signOut} />);
  return {
    signOut,
    nav: screen.getByRole("navigation", { name: "Principal" }),
  };
}

describe("BottomBar (spec 030 RF-5)", () => {
  it("offers the calendar, the notes, the calendars and more, in that order", () => {
    const { nav } = renderBar();

    const names = within(nav)
      .getAllByRole("listitem")
      .slice(0, 4)
      .map((item) => item.querySelector("a, button")?.textContent);
    expect(names).toEqual(["Calendario", "Notas", "Calendarios", "Más"]);
    expect(
      within(nav).getByRole("link", { name: "Calendario" }),
    ).toHaveAttribute("href", "/dashboard/calendar");
    expect(within(nav).getByRole("link", { name: "Notas" })).toHaveAttribute(
      "href",
      "/dashboard/notes",
    );
    expect(within(nav).getByRole("button", { name: "Más" })).toHaveAttribute(
      "aria-haspopup",
      "dialog",
    );
    // "+" is a floating button of its own (plan D3).
    expect(within(nav).queryByRole("link", { name: /^Nuev/ })).toBeNull();
  });

  it("floats as a pill over the content, only on a phone, clear of the home indicator", () => {
    const { nav } = renderBar();
    expect(nav).toHaveClass("fixed", "inset-x-3", "rounded-card", "tab:hidden");
    expect(nav).toHaveClass("surface-float");
    expect(nav.className).toContain(
      "bottom-[calc(0.75rem+env(safe-area-inset-bottom))]",
    );
  });

  it("marks the current section on the soft accent (RF-20)", () => {
    navigation.pathname = "/dashboard/events/new";
    const { nav } = renderBar();

    const current = within(nav).getByRole("link", { name: "Calendario" });
    expect(current).toHaveAttribute("aria-current", "page");
    expect(current.className).toContain("aria-[current=page]:bg-accent-soft");
  });
});

// Spec 030 (RF-5, RF-6, plan D3): "+" on its own.
describe("CreateButton", () => {
  it("floats over the navigation on a phone and creates an event on the calendar's date", async () => {
    history.replaceState(
      null,
      "",
      "/dashboard/calendar?view=week&date=2027-03-04",
    );
    render(<CreateButton floating />);
    const plus = screen.getByRole("link", { name: "Nuevo evento" });
    expect(plus).toHaveAttribute("href", "/dashboard/events/new");
    expect(plus).toHaveClass(
      "fixed",
      "size-14",
      "rounded-full",
      "bg-accent-gradient",
      "tab:hidden",
    );

    await userEvent.click(plus);
    expect(navigation.push).toHaveBeenCalledExactlyOnceWith(
      "/dashboard/events/new?date=2027-03-04",
    );
  });

  it("creates a note in Notas, and has its name in the top bar", async () => {
    navigation.pathname = "/dashboard/notes";
    render(<CreateButton floating={false} />);
    const button = screen.getByRole("link", { name: "Nueva nota" });
    expect(button).not.toHaveClass("fixed");
    await userEvent.click(button);
    expect(navigation.push).toHaveBeenCalledExactlyOnceWith(
      "/dashboard/notes/new",
    );
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
