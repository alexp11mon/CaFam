import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CopyButton } from "@/components/sharing/copy-button";

const LINK = "https://app.example.com/invite/abcDEF123-_abcDEF123-_abcDEF123";

function stubClipboard(writeText: (text: string) => Promise<void>) {
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText },
    configurable: true,
  });
}

afterEach(() => {
  Reflect.deleteProperty(navigator, "clipboard");
});

describe("CopyButton (RF-2, plan R6)", () => {
  it("copies the link to the clipboard and confirms it", async () => {
    const writeText = vi.fn(async () => {});
    stubClipboard(writeText);
    render(<CopyButton text={LINK} />);

    fireEvent.click(screen.getByRole("button", { name: "Copiar enlace" }));

    expect(writeText).toHaveBeenCalledWith(LINK);
    expect(await screen.findByText("Enlace copiado.")).toHaveAttribute(
      "role",
      "status",
    );
  });

  it("leaves the text selected when the clipboard fails", async () => {
    stubClipboard(async () => {
      throw new Error("denied");
    });
    render(<CopyButton text={LINK} />);

    fireEvent.click(screen.getByRole("button", { name: "Copiar enlace" }));

    const field = await screen.findByRole("textbox", { name: "Enlace" });
    expect(field).toHaveValue(LINK);
    expect(field).toHaveAttribute("readonly");
    expect((field as HTMLInputElement).selectionStart).toBe(0);
    expect((field as HTMLInputElement).selectionEnd).toBe(LINK.length);
    expect(screen.getByRole("status")).toHaveTextContent(
      "No se ha podido copiar. Copia el enlace seleccionado.",
    );
  });

  it("falls back to the selectable text without a clipboard API", async () => {
    render(<CopyButton text={LINK} />);

    fireEvent.click(screen.getByRole("button", { name: "Copiar enlace" }));

    expect(await screen.findByRole("textbox", { name: "Enlace" })).toHaveValue(
      LINK,
    );
  });
});
