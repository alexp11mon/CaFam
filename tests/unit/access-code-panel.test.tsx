import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";
import {
  AccessCodePanel,
  type AccessCodeState,
} from "@/components/sharing/access-code-panel";
import type { ConfirmState, FormAction } from "@/lib/forms/form-state";

// jsdom does not implement the modal methods of <dialog>.
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function close() {
    this.removeAttribute("open");
  };
});

const INITIAL: AccessCodeState = { values: { role: "viewer", pin: "" } };

function setup(
  code: React.ComponentProps<typeof AccessCodePanel>["code"],
  save: FormAction<AccessCodeState> = vi.fn(async () => INITIAL),
) {
  const disable = vi.fn<() => Promise<ConfirmState>>(async () => ({}));
  render(
    <AccessCodePanel code={code} saveAction={save} disableAction={disable} />,
  );
  return { save, disable };
}

describe("AccessCodePanel (RF-14..RF-18)", () => {
  it("without an active code offers role and PIN to activate it (RF-14)", () => {
    setup(null);

    expect(screen.getByLabelText("Rol")).toBeInTheDocument();
    expect(screen.getByLabelText("PIN")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Activar código" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Desactivar" }),
    ).not.toBeInTheDocument();
  });

  it("sends role and PIN when activating", async () => {
    const { save } = setup(null);
    const user = userEvent.setup();

    await user.selectOptions(screen.getByLabelText("Rol"), "editor");
    await user.type(screen.getByLabelText("PIN"), "482915");
    await user.click(screen.getByRole("button", { name: "Activar código" }));

    const formData = (save as ReturnType<typeof vi.fn>).mock.calls[0]?.[1];
    expect(formData.get("role")).toBe("editor");
    expect(formData.get("pin")).toBe("482915");
  });

  it("with an active code shows the ID and the role, never the PIN (RF-16)", () => {
    setup({ publicCode: "ABCD2345", role: "editor", enabled: true });

    expect(screen.getByText("ABCD2345")).toBeInTheDocument();
    expect(screen.getByText("Rol de quien se une: Editor")).toBeInTheDocument();
    expect(screen.getByLabelText("PIN")).toHaveValue("");
    expect(screen.getByText(/nadie puede volver a verlo/i)).toBeInTheDocument();
  });

  it("changes the PIN of an active code (RF-17)", async () => {
    const { save } = setup({
      publicCode: "ABCD2345",
      role: "viewer",
      enabled: true,
    });
    const user = userEvent.setup();

    await user.type(screen.getByLabelText("PIN"), "7351902846");
    await user.click(screen.getByRole("button", { name: "Cambiar PIN" }));

    const formData = (save as ReturnType<typeof vi.fn>).mock.calls[0]?.[1];
    expect(formData.get("pin")).toBe("7351902846");
  });

  it("shows the PIN error next to the field and does not keep the PIN (RF-15)", async () => {
    setup(
      null,
      vi.fn(async () => ({
        fieldErrors: { pin: "El PIN debe tener entre 6 y 10 dígitos." },
        values: { role: "viewer", pin: "" },
      })),
    );
    const user = userEvent.setup();

    await user.type(screen.getByLabelText("PIN"), "12345");
    await user.click(screen.getByRole("button", { name: "Activar código" }));

    const field = await screen.findByLabelText("PIN");
    expect(field).toHaveAccessibleDescription(
      "El PIN debe tener entre 6 y 10 dígitos.",
    );
    expect(field).toHaveAttribute("aria-invalid", "true");
    expect(field).toHaveValue("");
  });

  it("asks for confirmation before disabling (RF-18)", async () => {
    const { disable } = setup({
      publicCode: "ABCD2345",
      role: "viewer",
      enabled: true,
    });
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Desactivar" }));
    const dialog = screen.getByRole("dialog");
    expect(disable).not.toHaveBeenCalled();

    await user.click(
      within(dialog).getByRole("button", { name: "Sí, desactivar" }),
    );
    expect(disable).toHaveBeenCalledTimes(1);
  });

  it("a disabled code asks for a new PIN to activate it again (RF-18)", () => {
    setup({ publicCode: "ABCD2345", role: "viewer", enabled: false });

    expect(screen.getByText(/desactivado/i)).toBeInTheDocument();
    expect(screen.getByText(/PIN nuevo/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Activar código" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Desactivar" }),
    ).not.toBeInTheDocument();
  });
});
