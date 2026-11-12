import { act, fireEvent, render, screen, within } from "@testing-library/react";
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
      "Asistente",
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

  it("closes on the backdrop", async () => {
    const { drawer } = await openDrawer();
    fireEvent.click(drawer);
    expect(drawer).not.toHaveAttribute("open");
  });
});

// Spec 021, T17: the drawer follows the finger (RF-30, RF-32, RF-33).
describe("NavDrawer under a finger", () => {
  const frame = () =>
    act(
      () =>
        new Promise<void>((resolve) => requestAnimationFrame(() => resolve())),
    );
  const touch = (
    type: "pointerDown" | "pointerMove" | "pointerUp",
    el: Element,
    x: number,
  ) =>
    fireEvent[type](el, {
      pointerType: "touch",
      pointerId: 1,
      clientX: x,
      clientY: 300,
    });

  async function slide(from: number, to: number) {
    const { drawer } = await openDrawer();
    drawer.getBoundingClientRect = () => ({ width: 300 }) as DOMRect;
    touch("pointerDown", drawer, from);
    touch("pointerMove", drawer, to);
    await frame();
    return drawer;
  }

  it("follows a slide to the left and opens again under half its width", async () => {
    const drawer = await slide(250, 150);
    expect(drawer.style.translate).toBe("-100px 0px");
    expect(drawer).toHaveAttribute("data-following");
    touch("pointerUp", drawer, 150);
    expect(drawer).toHaveAttribute("open");
    expect(drawer.style.translate).toBe("");
    expect(drawer).not.toHaveAttribute("data-following");
  });

  it("closes past half its width", async () => {
    const drawer = await slide(250, 80);
    touch("pointerUp", drawer, 80);
    expect(drawer).not.toHaveAttribute("open");
    expect(drawer.style.translate).toBe("");
  });

  it("goes no more than 64 px to the right, with a rubber band", async () => {
    const drawer = await slide(100, 400);
    const offset = parseFloat(drawer.style.translate);
    expect(offset).toBeGreaterThan(0);
    expect(offset).toBeLessThan(64);
    touch("pointerUp", drawer, 400);
    expect(drawer).toHaveAttribute("open");
  });
});

// Spec 023, T12: without a keyboard there was no control to leave the drawer
// (RF-22).
describe("NavDrawer close button", () => {
  it("closes the drawer", async () => {
    const { drawer } = await openDrawer();

    await userEvent.click(
      within(drawer).getByRole("button", { name: "Cerrar" }),
    );

    expect(drawer).not.toHaveAttribute("open");
  });
});
