import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { MemberList, type MemberItem } from "@/components/sharing/member-list";
import type { ConfirmState } from "@/lib/forms/form-state";

// jsdom does not implement the modal methods of <dialog>.
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function close() {
    this.removeAttribute("open");
  };
});

const MEMBERS: MemberItem[] = [
  { userId: "owner", name: "Marta", role: "owner" },
  { userId: "ana", name: "Ana", role: "editor" },
  { userId: "luis", name: "Luis", role: "viewer" },
];

function setup(currentUserId: string) {
  const changeRole = vi.fn<
    (
      userId: string,
      prev: ConfirmState,
      formData: FormData,
    ) => Promise<ConfirmState>
  >(async () => ({}));
  const expel = vi.fn<(userId: string) => Promise<ConfirmState>>(
    async () => ({}),
  );
  const leave = vi.fn<() => Promise<ConfirmState>>(async () => ({}));
  render(
    <MemberList
      members={MEMBERS}
      currentUserId={currentUserId}
      changeRoleAction={changeRole}
      expelAction={expel}
      leaveAction={leave}
    />,
  );
  return { changeRole, expel, leave };
}

function row(name: string) {
  return within(
    screen
      .getAllByRole("listitem")
      .find((item) => within(item).queryByText(name)) as HTMLElement,
  );
}

describe("MemberList (RF-24..RF-28)", () => {
  it("everyone sees names and roles, owner included, and no email (RF-24)", () => {
    setup("luis");

    expect(row("Marta").getByText("Propietario")).toBeInTheDocument();
    expect(row("Ana").getByText("Editor")).toBeInTheDocument();
    expect(row("Luis").getByText("Lector")).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/@/);
  });

  it("the owner can change roles and expel others, not themselves", () => {
    setup("owner");

    expect(row("Ana").getByLabelText("Rol de Ana")).toHaveValue("editor");
    expect(row("Luis").getByLabelText("Rol de Luis")).toHaveValue("viewer");
    expect(
      row("Ana").getByRole("button", { name: "Expulsar a Ana" }),
    ).toBeInTheDocument();
    expect(row("Marta").queryByRole("button")).toBeNull();
    expect(row("Marta").queryByRole("combobox")).toBeNull();
    expect(screen.queryByRole("button", { name: "Salir" })).toBeNull();
  });

  it("the owner saves a new role for a member (RF-25)", async () => {
    const { changeRole } = setup("owner");
    const user = userEvent.setup();

    await user.selectOptions(
      row("Luis").getByLabelText("Rol de Luis"),
      "editor",
    );
    await user.click(
      row("Luis").getByRole("button", { name: "Guardar rol de Luis" }),
    );

    expect(changeRole.mock.calls[0]?.[0]).toBe("luis");
    expect(changeRole.mock.calls[0]?.[2].get("role")).toBe("editor");
  });

  it("the owner confirms before expelling (RF-26)", async () => {
    const { expel } = setup("owner");
    const user = userEvent.setup();

    await user.click(
      row("Ana").getByRole("button", { name: "Expulsar a Ana" }),
    );
    const dialog = screen.getByRole("dialog");
    expect(expel).not.toHaveBeenCalled();
    await user.click(
      within(dialog).getByRole("button", { name: "Sí, expulsar" }),
    );

    expect(expel.mock.calls[0]?.[0]).toBe("ana");
  });

  it("a non-owner has no controls over others and can leave with confirmation (RF-27)", async () => {
    const { leave } = setup("ana");
    const user = userEvent.setup();

    expect(screen.queryByRole("combobox")).toBeNull();
    expect(screen.queryByRole("button", { name: /Expulsar/ })).toBeNull();

    await user.click(screen.getByRole("button", { name: "Salir" }));
    expect(leave).not.toHaveBeenCalled();
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Sí, salir",
      }),
    );
    expect(leave).toHaveBeenCalledTimes(1);
  });

  it("shows the error of a role change (RF-28)", async () => {
    const changeRole = vi.fn(async () => ({
      formError: "No tienes permiso para hacer esto.",
    }));
    render(
      <MemberList
        members={MEMBERS}
        currentUserId="owner"
        changeRoleAction={changeRole}
        expelAction={vi.fn(async () => ({}))}
        leaveAction={vi.fn(async () => ({}))}
      />,
    );

    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Guardar rol de Luis" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No tienes permiso para hacer esto.",
    );
  });
});
