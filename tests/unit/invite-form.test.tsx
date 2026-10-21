import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { InviteForm, type InviteState } from "@/components/sharing/invite-form";
import type { FormAction } from "@/lib/forms/form-state";

const INITIAL: InviteState = { values: { role: "viewer", maxUses: "1" } };
const LINK = "https://app.example.com/invite/abcDEF123-_abcDEF123-_abcDEF123";

function setup(action: FormAction<InviteState>) {
  render(<InviteForm action={action} />);
}

describe("InviteForm (RF-1..RF-3)", () => {
  it("offers the Lector and Editor roles, but not Propietario", () => {
    setup(vi.fn(async () => INITIAL));

    const options = screen
      .getAllByRole("option")
      .map((option) => option.textContent);
    expect(options).toEqual(["Lector", "Editor"]);
    expect(screen.getByLabelText("Usos máximos")).toBeInTheDocument();
  });

  it("sends the role and the maximum uses", async () => {
    const action = vi.fn<FormAction<InviteState>>(async () => INITIAL);
    setup(action);
    const user = userEvent.setup();

    await user.selectOptions(screen.getByLabelText("Rol"), "editor");
    await user.clear(screen.getByLabelText("Usos máximos"));
    await user.type(screen.getByLabelText("Usos máximos"), "7");
    await user.click(screen.getByRole("button", { name: "Crear invitación" }));

    const formData = action.mock.calls[0]?.[1];
    expect(formData?.get("role")).toBe("editor");
    expect(formData?.get("maxUses")).toBe("7");
  });

  it("shows the uses error next to the field (RF-3)", async () => {
    setup(
      vi.fn(async () => ({
        fieldErrors: { maxUses: "Elige entre 1 y 20 usos." },
        values: { role: "viewer", maxUses: "21" },
      })),
    );
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Crear invitación" }));

    const field = await screen.findByLabelText("Usos máximos");
    expect(field).toHaveAccessibleDescription("Elige entre 1 y 20 usos.");
    expect(field).toHaveAttribute("aria-invalid", "true");
    expect(field).toHaveValue("21");
    expect(screen.queryByText(LINK)).not.toBeInTheDocument();
  });

  it("shows the link with a copy button after creating (RF-1, RF-2)", async () => {
    setup(
      vi.fn(async () => ({
        values: { role: "viewer", maxUses: "1" },
        inviteUrl: LINK,
      })),
    );
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Crear invitación" }));

    expect(await screen.findByText(LINK)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Copiar enlace" }),
    ).toBeInTheDocument();
  });

  it("does not show a link that was not just created", () => {
    // A reload mounts the form again with the initial state: the token is gone.
    setup(vi.fn(async () => INITIAL));

    expect(screen.queryByText(/\/invite\//)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Copiar enlace" }),
    ).not.toBeInTheDocument();
  });

  it("replaces the link with the error of the next submit", async () => {
    const action = vi
      .fn<FormAction<InviteState>>()
      .mockResolvedValueOnce({
        values: { role: "viewer", maxUses: "1" },
        inviteUrl: LINK,
      })
      .mockResolvedValueOnce({
        formError: "No tienes permiso para hacer esto.",
        values: { role: "viewer", maxUses: "1" },
      });
    setup(action);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Crear invitación" }));
    await screen.findByText(LINK);
    await user.click(screen.getByRole("button", { name: "Crear invitación" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No tienes permiso para hacer esto.",
    );
    expect(screen.queryByText(LINK)).not.toBeInTheDocument();
  });

  it("disables the button while the action is pending", async () => {
    let finish: (state: InviteState) => void = () => {};
    setup(
      vi.fn<FormAction<InviteState>>(
        () =>
          new Promise((resolve) => {
            finish = resolve;
          }),
      ),
    );
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Crear invitación" }));

    expect(
      await screen.findByRole("button", { name: "Creando…" }),
    ).toBeDisabled();
    finish(INITIAL);
    expect(
      await screen.findByRole("button", { name: "Crear invitación" }),
    ).toBeEnabled();
  });
});
