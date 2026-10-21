import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  JoinCodeForm,
  type JoinCodeState,
} from "@/components/sharing/join-code-form";
import type { FormAction } from "@/lib/forms/form-state";

const INITIAL: JoinCodeState = { values: { code: "", pin: "" } };

async function fillAndSubmit() {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("ID del calendario"), "abcd2345");
  await user.type(screen.getByLabelText("PIN"), "000000");
  await user.click(screen.getByRole("button", { name: "Unirme" }));
}

describe("JoinCodeForm (RF-19..RF-22)", () => {
  it("sends the ID and the PIN", async () => {
    const action = vi.fn<FormAction<JoinCodeState>>(async () => INITIAL);
    render(<JoinCodeForm action={action} />);

    await fillAndSubmit();

    const formData = action.mock.calls[0]?.[1];
    expect(formData?.get("code")).toBe("abcd2345");
    expect(formData?.get("pin")).toBe("000000");
  });

  it("shows the incorrect message as an alert and keeps the ID but not the PIN (RF-20)", async () => {
    render(
      <JoinCodeForm
        action={vi.fn(async () => ({
          formError: "ID o PIN incorrectos.",
          values: { code: "ABCD2345", pin: "" },
        }))}
      />,
    );

    await fillAndSubmit();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "ID o PIN incorrectos.",
    );
    expect(screen.getByLabelText("ID del calendario")).toHaveValue("ABCD2345");
    expect(screen.getByLabelText("PIN")).toHaveValue("");
  });

  it("shows the block message as an alert (RF-21)", async () => {
    render(
      <JoinCodeForm
        action={vi.fn(async () => ({
          formError:
            "Demasiados intentos. Espera 15 minutos y vuelve a probar.",
          values: { code: "ABCD2345", pin: "" },
        }))}
      />,
    );

    await fillAndSubmit();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Espera 15 minutos",
    );
  });

  it("shows missing-field errors next to the field", async () => {
    render(
      <JoinCodeForm
        action={vi.fn(async () => ({
          fieldErrors: { code: "Escribe el ID del calendario." },
          values: { code: "", pin: "" },
        }))}
      />,
    );

    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Unirme" }));

    expect(
      await screen.findByLabelText("ID del calendario"),
    ).toHaveAccessibleDescription("Escribe el ID del calendario.");
  });

  it("disables the button while the action is pending", async () => {
    let finish: (state: JoinCodeState) => void = () => {};
    render(
      <JoinCodeForm
        action={vi.fn<FormAction<JoinCodeState>>(
          () =>
            new Promise((resolve) => {
              finish = resolve;
            }),
        )}
      />,
    );

    await fillAndSubmit();

    expect(
      await screen.findByRole("button", { name: "Uniéndote…" }),
    ).toBeDisabled();
    finish(INITIAL);
    expect(await screen.findByRole("button", { name: "Unirme" })).toBeEnabled();
  });
});
