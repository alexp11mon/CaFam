import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { DisconnectDialog } from "@/components/connections/disconnect-dialog";

// Spec 007, T10: what disconnecting affects and the keep-or-delete choice
// (RF-27 to RF-29).
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function close() {
    this.removeAttribute("open");
  };
});

const CALENDARS = [
  { name: "Trabajo", sharedWith: 0 },
  { name: "Familia", sharedWith: 3 },
  { name: "Cole", sharedWith: 1 },
];

async function open(calendars = CALENDARS, action = vi.fn(async () => ({}))) {
  const user = userEvent.setup();
  render(
    <DisconnectDialog
      email="ana@gmail.com"
      calendars={calendars}
      action={action}
    />,
  );
  await user.click(screen.getByRole("button", { name: "Desconectar" }));
  return { user, dialog: screen.getByRole("dialog"), action };
}

describe("DisconnectDialog (RF-27)", () => {
  it("counts the calendars and names the shared ones with how many people", async () => {
    const { dialog } = await open();

    expect(dialog).toHaveTextContent("3 calendarios");
    expect(dialog).toHaveTextContent("«Familia», con 3 personas");
    expect(dialog).toHaveTextContent("«Cole», con 1 persona");
    expect(dialog).not.toHaveTextContent("«Trabajo», con");
  });

  it("offers keep or delete with nothing chosen", async () => {
    const { dialog } = await open();

    const keep = within(dialog).getByRole("radio", { name: /conservar/i });
    const remove = within(dialog).getByRole("radio", { name: /borrar/i });
    expect(keep).not.toBeChecked();
    expect(remove).not.toBeChecked();
    expect(keep).toBeRequired();
  });

  it("sends the choice", async () => {
    const { user, dialog, action } = await open();

    await user.click(within(dialog).getByRole("radio", { name: /borrar/i }));
    await user.click(
      within(dialog).getByRole("button", { name: "Sí, desconectar" }),
    );

    const data = (action.mock.calls[0] as unknown[])[1] as FormData;
    expect(data.get("decision")).toBe("delete");
  });

  it("still works without synced calendars", async () => {
    const { dialog } = await open([]);
    expect(dialog).toHaveTextContent(/no trae ningún calendario/i);
    expect(within(dialog).queryByRole("radio")).not.toBeInTheDocument();
  });
});
