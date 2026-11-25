import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { TransferDialog } from "@/components/sharing/transfer-dialog";

// Spec 049, T3: the owner picks a member and writes the calendar's name to
// give it away (RF-7, "Riesgos").
beforeAll(() => {
  HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
    this.open = true;
  };
  HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
    this.open = false;
  };
});

const MEMBERS = [
  { userId: "u1", name: "Ana", role: "editor" as const },
  { userId: "u2", name: "Luis", role: "viewer" as const },
];

describe("TransferDialog", () => {
  it("confirms only once the name is written, saying who gets it", async () => {
    const action = vi.fn<(state: object, data: FormData) => Promise<object>>(
      async () => ({}),
    );
    render(
      <TransferDialog
        calendarName="Familia"
        members={MEMBERS}
        action={action}
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Traspasar a otro miembro" }),
    );
    const confirm = screen.getByRole("button", { name: "Sí, traspasar" });
    expect(confirm).toBeDisabled();
    expect(
      screen.getByText(/Ana pasará a tener la propiedad de «Familia»/),
    ).toBeInTheDocument();

    await userEvent.selectOptions(
      screen.getByLabelText("Nuevo propietario"),
      "u2",
    );
    expect(screen.getByText(/Luis pasará a tener/)).toBeInTheDocument();
    await userEvent.type(
      screen.getByLabelText("Escribe «Familia» para confirmar"),
      "Famil",
    );
    expect(confirm).toBeDisabled();
    await userEvent.type(
      screen.getByLabelText("Escribe «Familia» para confirmar"),
      "ia",
    );
    expect(confirm).toBeEnabled();
    await userEvent.click(confirm);
    const data = action.mock.calls[0]![1];
    expect(data.get("newOwner")).toBe("u2");
    expect(data.get("confirmName")).toBe("Familia");
  });
});
