import type { ConfirmState } from "@/lib/forms/form-state";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";
import {
  CalendarList,
  type CalendarListItem,
} from "@/components/dashboard/calendar-list";

const CALENDARS: CalendarListItem[] = [
  { id: "1", name: "Mi calendario", color: "#A0C4FF", role: "owner" },
  { id: "2", name: "Familia", color: "#16A34A", role: "editor" },
  { id: "3", name: "Fútbol", color: "#DC2626", role: "viewer" },
];

// jsdom does not implement the modal methods of <dialog>.
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function close() {
    this.removeAttribute("open");
  };
});

const leave = vi.fn<(id: string) => Promise<ConfirmState>>(async () => ({}));

describe("CalendarList", () => {
  it("shows each calendar with its name, color and translated role (RF-13)", () => {
    render(<CalendarList calendars={CALENDARS} leaveAction={leave} />);

    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(3);

    const expected = [
      ["Mi calendario", "Propietario", "#A0C4FF"],
      ["Familia", "Editor", "#16A34A"],
      ["Fútbol", "Lector", "#DC2626"],
    ];
    expected.forEach(([name, role, color], index) => {
      const item = within(items[index]!);
      expect(item.getByText(name!)).toBeInTheDocument();
      expect(item.getByText(role!)).toBeInTheDocument();
      expect(item.getByTestId("calendar-color")).toHaveStyle({
        backgroundColor: color,
      });
    });
  });

  it("keeps the order it receives (RF-45)", () => {
    render(
      <CalendarList calendars={[...CALENDARS].reverse()} leaveAction={leave} />,
    );

    const names = screen
      .getAllByRole("listitem")
      .map((item) => within(item).getByTestId("calendar-name").textContent);
    expect(names).toEqual(["Fútbol", "Familia", "Mi calendario"]);
  });

  it("offers Editar only to the owner and Categorías to owner and editor (RF-41)", () => {
    render(<CalendarList calendars={CALENDARS} leaveAction={leave} />);

    const [owner, editor, viewer] = screen.getAllByRole("listitem");

    expect(
      within(owner!).getByRole("link", { name: /Editar/ }),
    ).toHaveAttribute("href", "/dashboard/calendars/1/edit");
    expect(
      within(owner!).getByRole("link", { name: /Categorías/ }),
    ).toHaveAttribute("href", "/dashboard/calendars/1/categories");
    expect(within(editor!).queryByRole("link", { name: /Editar/ })).toBeNull();
    expect(
      within(editor!).getByRole("link", { name: /Categorías/ }),
    ).toHaveAttribute("href", "/dashboard/calendars/2/categories");
    expect(
      within(viewer!).queryByRole("link", { name: /Editar|Categorías/ }),
    ).toBeNull();
  });

  it("the owner sees Compartir y miembros and cannot leave (RF-33)", () => {
    render(<CalendarList calendars={CALENDARS} leaveAction={leave} />);

    const [owner] = screen.getAllByRole("listitem");

    expect(
      within(owner!).getByRole("link", { name: /Compartir y miembros/ }),
    ).toHaveAttribute("href", "/dashboard/calendars/1/share");
    expect(within(owner!).queryByRole("button", { name: /Salir/ })).toBeNull();
  });

  it("editor and viewer see Miembros and Salir with confirmation (RF-34)", async () => {
    render(<CalendarList calendars={CALENDARS} leaveAction={leave} />);
    const [, editor, viewer] = screen.getAllByRole("listitem");
    const user = userEvent.setup();

    expect(
      within(editor!).getByRole("link", { name: /Miembros/ }),
    ).toHaveAttribute("href", "/dashboard/calendars/2/members");
    expect(
      within(viewer!).getByRole("link", { name: /Miembros/ }),
    ).toHaveAttribute("href", "/dashboard/calendars/3/members");
    expect(
      within(viewer!).queryByRole("link", { name: /Compartir/ }),
    ).toBeNull();

    await user.click(
      within(viewer!).getByRole("button", { name: /Salir de Fútbol/ }),
    );
    expect(leave).not.toHaveBeenCalled();
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Sí, salir",
      }),
    );
    expect(leave.mock.calls[0]?.[0]).toBe("3");
  });

  it("shows the empty state with a way to create a calendar (RF-7)", () => {
    render(<CalendarList calendars={[]} leaveAction={leave} />);

    expect(
      screen.getByText("Todavía no tienes calendarios."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Crear calendario" }),
    ).toHaveAttribute("href", "/dashboard/calendars/new");
  });
});
