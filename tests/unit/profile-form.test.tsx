import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ProfileForm } from "@/components/account/profile-form";
import type { ProfileState } from "@/lib/account/form-state";

// Spec 006, T16: name and time zone in Ajustes (RF-13 to RF-15).
const INITIAL = { displayName: "Ana", timeZone: "Europe/Madrid" };
const ZONES = ["America/Bogota", "Europe/Madrid"];

describe("ProfileForm (RF-13 to RF-15)", () => {
  it("shows the current name and time zone", () => {
    render(
      <ProfileForm action={vi.fn()} initial={INITIAL} timeZones={ZONES} />,
    );

    expect(screen.getByLabelText("Nombre")).toHaveValue("Ana");
    expect(screen.getByLabelText("Zona horaria")).toHaveValue("Europe/Madrid");
  });

  it("keeps a current zone that is not in the list", () => {
    render(
      <ProfileForm
        action={vi.fn()}
        initial={{ displayName: "Ana", timeZone: "Asia/Tokyo" }}
        timeZones={ZONES}
      />,
    );

    expect(screen.getByLabelText("Zona horaria")).toHaveValue("Asia/Tokyo");
  });

  it("links the field error to its input (RF-15)", async () => {
    const action = vi.fn(async (): Promise<ProfileState> => ({
      values: { displayName: "", timeZone: "Europe/Madrid" },
      fieldErrors: { displayName: "Introduce tu nombre." },
    }));
    render(<ProfileForm action={action} initial={INITIAL} timeZones={ZONES} />);

    await userEvent.click(
      screen.getByRole("button", { name: "Guardar perfil" }),
    );

    const message = await screen.findByText("Introduce tu nombre.");
    expect(screen.getByLabelText("Nombre")).toHaveAttribute(
      "aria-describedby",
      message.id,
    );
  });

  it("confirms the save", async () => {
    const action = vi.fn(async (): Promise<ProfileState> => ({
      values: INITIAL,
      saved: true,
    }));
    render(<ProfileForm action={action} initial={INITIAL} timeZones={ZONES} />);

    await userEvent.click(
      screen.getByRole("button", { name: "Guardar perfil" }),
    );

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Perfil guardado.",
    );
  });

  it("disables the button while saving", async () => {
    const action = vi.fn(() => new Promise<ProfileState>(() => {}));
    render(<ProfileForm action={action} initial={INITIAL} timeZones={ZONES} />);

    await userEvent.click(
      screen.getByRole("button", { name: "Guardar perfil" }),
    );

    expect(
      await screen.findByRole("button", { name: "Guardando…" }),
    ).toBeDisabled();
  });
});
