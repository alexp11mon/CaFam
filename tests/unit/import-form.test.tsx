import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ImportForm } from "@/components/import/import-form";
import type { FormAction } from "@/lib/forms/form-state";
import { MAX_BYTES } from "@/lib/ics/limits";
import type { ImportState } from "@/lib/ics/import-state";

const EMPTY: ImportState = {
  values: { url: "", file: "", name: "", color: "" },
};

function setup(action: FormAction<ImportState> = vi.fn(async () => EMPTY)) {
  render(<ImportForm action={action} />);
  return action;
}

const submit = () =>
  screen.getByRole("button", { name: /Importar|Importando/ });

describe("ImportForm fields (RF-1, RF-2, RF-8, RF-10)", () => {
  it("offers link, file, name and color", () => {
    setup();

    expect(screen.getByLabelText("Enlace .ics")).toBeInTheDocument();
    expect(screen.getByLabelText("Archivo .ics")).toHaveAttribute(
      "type",
      "file",
    );
    expect(
      screen.getByLabelText("Nombre del calendario (opcional)"),
    ).toBeInTheDocument();
    expect(screen.getByRole("radiogroup")).toBeInTheDocument();
    expect(submit()).toHaveTextContent("Importar calendario");
  });

  it("sends the link, the name and the color", async () => {
    const action = setup(vi.fn<FormAction<ImportState>>(async () => EMPTY));
    const user = userEvent.setup();

    await user.type(
      screen.getByLabelText("Enlace .ics"),
      "webcal://calendar.example.com/a.ics",
    );
    await user.type(
      screen.getByLabelText("Nombre del calendario (opcional)"),
      "Clases",
    );
    await user.click(submit());

    const formData = (action as ReturnType<typeof vi.fn>).mock
      .calls[0]?.[1] as FormData;
    expect(formData.get("url")).toBe("webcal://calendar.example.com/a.ics");
    expect(formData.get("name")).toBe("Clases");
    expect(formData.get("color")).toBe("#2563EB");
  });

  it("takes the chosen file and submits the form", async () => {
    const action = setup(vi.fn<FormAction<ImportState>>(async () => EMPTY));
    const user = userEvent.setup();
    const file = new File(["BEGIN:VCALENDAR"], "mi-calendario.ics", {
      type: "text/calendar",
    });
    const input = screen.getByLabelText("Archivo .ics") as HTMLInputElement;

    await user.upload(input, file);
    await user.click(submit());

    // jsdom builds FormData from its own file list, which user-event bypasses:
    // the file reaching the action is checked in the browser demo (T9).
    expect(input.files?.[0]?.name).toBe("mi-calendario.ics");
    expect(input).toHaveAttribute("name", "file");
    expect(action).toHaveBeenCalledTimes(1);
  });
});

describe("ImportForm errors", () => {
  it("shows the source error next to the link field", async () => {
    setup(
      vi.fn(async () => ({
        fieldErrors: { url: "Indica un enlace o sube un archivo, no los dos." },
        values: { url: "", file: "", name: "", color: "" },
      })),
    );

    await userEvent.setup().click(submit());

    // The field exists before the action answers: wait for the error itself.
    await screen.findByText("Indica un enlace o sube un archivo, no los dos.");
    const field = screen.getByLabelText("Enlace .ics");
    expect(field).toHaveAccessibleDescription(
      "Indica un enlace o sube un archivo, no los dos.",
    );
    expect(field).toHaveAttribute("aria-invalid", "true");
  });

  it("shows an import failure as an alert and keeps what was typed", async () => {
    setup(
      vi.fn(async () => ({
        formError:
          "No se ha podido leer el enlace. Comprueba que es público y vuelve a intentarlo.",
        values: {
          url: "https://calendar.example.com/a.ics",
          file: "",
          name: "Clases",
          color: "",
        },
      })),
    );
    const user = userEvent.setup();
    await user.type(
      screen.getByLabelText("Enlace .ics"),
      "https://calendar.example.com/a.ics",
    );

    await user.click(submit());

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No se ha podido leer el enlace",
    );
    expect(screen.getByLabelText("Enlace .ics")).toHaveValue(
      "https://calendar.example.com/a.ics",
    );
    expect(
      screen.getByLabelText("Nombre del calendario (opcional)"),
    ).toHaveValue("Clases");
  });

  it("warns about a file over 2 MB before sending anything (RF-26)", async () => {
    const action = setup(vi.fn<FormAction<ImportState>>(async () => EMPTY));
    const user = userEvent.setup();
    const big = new File([new Uint8Array(MAX_BYTES + 1)], "big.ics");

    await user.upload(screen.getByLabelText("Archivo .ics"), big);

    expect(screen.getByLabelText("Archivo .ics")).toHaveAccessibleDescription(
      "El archivo supera el límite de 2 MB.",
    );
    expect(submit()).toBeDisabled();
    await user.click(submit());
    expect(action).not.toHaveBeenCalled();
  });

  it("clears the warning when a valid file is chosen", async () => {
    setup();
    const user = userEvent.setup();
    const input = screen.getByLabelText("Archivo .ics");

    await user.upload(
      input,
      new File([new Uint8Array(MAX_BYTES + 1)], "big.ics"),
    );
    await user.upload(input, new File(["BEGIN:VCALENDAR"], "ok.ics"));

    expect(input).not.toHaveAccessibleDescription(
      "El archivo supera el límite de 2 MB.",
    );
    expect(submit()).toBeEnabled();
  });
});

describe("ImportForm progress (RF-31, RF-32)", () => {
  it("disables the button and says it is working while the import runs", async () => {
    let finish: (state: ImportState) => void = () => {};
    const action = vi.fn<FormAction<ImportState>>(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    setup(action);
    const user = userEvent.setup();

    await user.type(
      screen.getByLabelText("Enlace .ics"),
      "https://a.example.com/x.ics",
    );
    await user.click(submit());

    expect(
      await screen.findByRole("button", { name: "Importando…" }),
    ).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Importando…" }));
    expect(action).toHaveBeenCalledTimes(1);

    finish(EMPTY);
    expect(
      await screen.findByRole("button", { name: "Importar calendario" }),
    ).toBeEnabled();
  });

  it("shows the summary when the import finishes", async () => {
    setup(
      vi.fn(async () => ({
        values: { url: "", file: "", name: "", color: "" },
        result: {
          calendarId: "11111111-1111-4111-8111-111111111111",
          created: 12,
          skipped: 0,
          cutSeries: 1,
        },
      })),
    );

    await userEvent.setup().click(submit());

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Calendario creado con 12 eventos.",
    );
    expect(
      screen.getByRole("link", { name: "Abrir calendario" }),
    ).toBeInTheDocument();
  });
});
