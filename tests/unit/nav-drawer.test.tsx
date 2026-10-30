import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { CalendarHeaderProvider } from "@/components/shell/calendar-header";
import { TopBar } from "@/components/shell/top-bar";

// Spec 016, T5: the drawer of the phone header (RF-12..RF-16).
const navigation = vi.hoisted(() => ({ pathname: "/dashboard/calendars" }));
vi.mock("next/navigation", () => ({ usePathname: () => navigation.pathname }));
vi.mock("@/app/dashboard/settings/actions", () => ({
  setTheme: vi.fn(async () => ({})),
}));

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function close() {
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  };
});

async function openDrawer() {
  render(
    <CalendarHeaderProvider>
      <TopBar displayName="Ana" signOutAction={vi.fn(async () => {})} />
    </CalendarHeaderProvider>,
  );
  const menu = screen.getByRole("button", { name: "Menú" });
  await userEvent.click(menu);
  return { menu, drawer: screen.getByRole("dialog", { name: "CaFam" }) };
}

describe("NavDrawer", () => {
  it("offers the destinations, the theme and signing out", async () => {
    const { drawer } = await openDrawer();

    const links = within(drawer)
      .getAllByRole("link")
      .map((link) => link.textContent);
    expect(links).toEqual([
      "Calendario",
      "Mis calendarios",
      "Cuentas conectadas",
      "Unirme con código",
      "Importar calendario",
      "Ajustes",
    ]);
    expect(
      within(drawer).getByRole("link", { name: "Mis calendarios" }),
    ).toHaveAttribute("aria-current", "page");
    expect(
      within(drawer).getByRole("button", { name: "Cerrar sesión" }),
    ).toBeInTheDocument();
    expect(within(drawer).getByRole("button", { name: /tema/i })).toBeTruthy();
  });

  it("leaves the calendar link to the views on the calendar page", async () => {
    navigation.pathname = "/dashboard/calendar";
    const { drawer } = await openDrawer();

    expect(
      within(drawer).queryByRole("link", { name: "Calendario" }),
    ).toBeNull();
    navigation.pathname = "/dashboard/calendars";
  });

  it("closes when a destination is chosen and gives the focus back", async () => {
    const { menu, drawer } = await openDrawer();

    fireEvent.click(within(drawer).getByRole("link", { name: "Ajustes" }));

    expect(drawer).not.toHaveAttribute("open");
    expect(menu).toHaveFocus();
  });

  it("closes on Escape and gives the focus back (RF-15, RF-16)", async () => {
    const { menu, drawer } = await openDrawer();

    // jsdom does not close a dialog on Escape: the browser's cancel does it.
    drawer.dispatchEvent(new Event("cancel", { cancelable: true }));
    (drawer as HTMLDialogElement).close();

    expect(drawer).not.toHaveAttribute("open");
    expect(menu).toHaveFocus();
  });

  it("closes on the backdrop and when slid to the left", async () => {
    const { drawer } = await openDrawer();
    fireEvent.click(drawer);
    expect(drawer).not.toHaveAttribute("open");

    await userEvent.click(screen.getByRole("button", { name: "Menú" }));
    fireEvent.pointerDown(drawer, {
      pointerType: "touch",
      clientX: 250,
      clientY: 300,
    });
    fireEvent.pointerUp(drawer, {
      pointerType: "touch",
      clientX: 120,
      clientY: 310,
    });
    expect(drawer).not.toHaveAttribute("open");
  });
});
