import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import OfflinePage from "@/app/offline/page";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorScreen } from "@/components/ui/error-screen";
import { IconButton } from "@/components/ui/icon-button";
import { LinkButton } from "@/components/ui/link-button";
import { Select } from "@/components/ui/select";
import { Sheet } from "@/components/ui/sheet";
import { TextArea } from "@/components/ui/text-area";
import { TextField } from "@/components/ui/text-field";

// Spec 025, T4: the base components of the Orilla identity (RF-6, RNF-2).
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function close() {
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  };
});

describe("buttons", () => {
  it("the primary one carries the gradient of the accent, 44 px tall and never a pill (spec 030 RF-9)", () => {
    render(<Button>Guardar</Button>);
    const button = screen.getByRole("button", { name: "Guardar" });
    expect(button).toHaveClass(
      "bg-accent-gradient",
      "text-on-accent",
      "min-h-11",
      "rounded-control",
    );
    expect(button).not.toHaveClass("rounded-full");
  });

  it("offers secondary, quiet and danger, also as links", () => {
    render(
      <>
        <Button variant="secondary">Cancelar</Button>
        <Button variant="quiet">Ahora no</Button>
        <Button variant="danger">Borrar</Button>
        <LinkButton href="/dashboard/calendar" variant="secondary">
          Volver
        </LinkButton>
      </>,
    );
    expect(screen.getByRole("button", { name: "Cancelar" })).toHaveClass(
      "bg-paper",
      "border-line",
    );
    expect(screen.getByRole("button", { name: "Ahora no" })).not.toHaveClass(
      "border",
    );
    expect(screen.getByRole("button", { name: "Borrar" })).toHaveClass(
      "text-danger",
    );
    expect(screen.getByRole("link", { name: "Volver" })).toHaveClass(
      "min-h-11",
      "rounded-control",
    );
  });

  it("an icon button is round, 44 px and named", () => {
    render(
      <IconButton label="Cerrar">
        <svg />
      </IconButton>,
    );
    expect(screen.getByRole("button", { name: "Cerrar" })).toHaveClass(
      "size-11",
      "rounded-full",
    );
  });
});

describe("fields", () => {
  it("never go below 16 px, so iOS does not zoom in (amendment 11)", () => {
    render(
      <>
        <TextField label="Título" name="title" />
        <TextArea label="Notas" name="notes" />
        <Select label="Calendario" name="calendar">
          <option>Casa</option>
        </Select>
      </>,
    );
    for (const name of ["Título", "Notas", "Calendario"]) {
      const field = screen.getByLabelText(name);
      expect(field).toHaveClass("text-base", "rounded-control");
      expect(field.className).not.toMatch(/\btext-(?:xs|sm)\b/);
    }
    expect(screen.getByLabelText("Título")).toHaveClass("min-h-11");
  });
});

describe("Chip", () => {
  it("is a pill of 44 px that says when it is the choice", () => {
    render(
      <>
        <Chip selected>Semana</Chip>
        <Chip>¿Qué tengo hoy?</Chip>
      </>,
    );
    const chosen = screen.getByRole("button", { name: "Semana" });
    expect(chosen).toHaveClass("rounded-full", "min-h-11");
    expect(chosen).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.getByRole("button", { name: "¿Qué tengo hoy?" }),
    ).not.toHaveAttribute("aria-pressed");
  });
});

describe("Card and EmptyState", () => {
  it("a card is a surface at rest with the card radius", () => {
    render(<Card data-testid="card">Hola</Card>);
    expect(screen.getByTestId("card")).toHaveClass("surface", "rounded-card");
  });

  it("an empty state says what it means and offers one thing to do", () => {
    render(
      <EmptyState
        title="Todavía no hay notas"
        art={<svg data-testid="art" />}
        action={<Button>Crear nota</Button>}
      >
        Apunta aquí tus listas.
      </EmptyState>,
    );
    expect(screen.getByText("Todavía no hay notas")).toBeInTheDocument();
    expect(screen.getByText("Apunta aquí tus listas.")).toBeInTheDocument();
    expect(screen.getByTestId("art").parentElement).toHaveAttribute(
      "aria-hidden",
      "true",
    );
    expect(
      screen.getByRole("button", { name: "Crear nota" }),
    ).toBeInTheDocument();
  });
});

describe("Venito in the empty and broken moments (spec 027 RF-7)", () => {
  it("draws Venito in an empty state unless told otherwise", () => {
    const { container, rerender } = render(<EmptyState title="Nada aquí" />);
    expect(container.querySelector('[data-venito="idle"]')).not.toBeNull();
    rerender(<EmptyState title="Nada aquí" art={null} />);
    expect(container.querySelector("[data-venito]")).toBeNull();
  });

  it("is confused on an error screen", () => {
    const { container } = render(
      <ErrorScreen title="Algo ha fallado" text="Prueba otra vez.">
        <Button>Reintentar</Button>
      </ErrorScreen>,
    );
    expect(container.querySelector('[data-venito="confused"]')).not.toBeNull();
    expect(
      screen.getByRole("heading", { name: "Algo ha fallado" }),
    ).toBeInTheDocument();
  });

  // Without a copy on the device (spec 034 RF-12).
  it("naps on the offline page", async () => {
    const { container } = render(<OfflinePage />);
    expect(
      await screen.findByRole("heading", { name: "Sin conexión" }),
    ).toBeInTheDocument();
    expect(container.querySelector('[data-venito="sleeping"]')).not.toBeNull();
  });
});

describe("Sheet", () => {
  function setup(open = true) {
    const onClose = vi.fn();
    const view = render(
      <Sheet open={open} onClose={onClose} title="Filtros" footer={<p>Pie</p>}>
        <p>Contenido</p>
      </Sheet>,
    );
    return { onClose, ...view };
  }

  it("opens as a named modal dialog from the bottom", () => {
    setup();
    const sheet = screen.getByRole("dialog", { name: "Filtros" });
    expect(sheet).toHaveAttribute("open");
    expect(sheet).toHaveAttribute("data-sheet");
    expect(sheet).toHaveClass("surface-float", "rounded-t-card");
    expect(screen.getByText("Contenido")).toBeInTheDocument();
    expect(screen.getByText("Pie")).toBeInTheDocument();
  });

  it("closes with its button, the backdrop and Escape", async () => {
    const { onClose } = setup();
    const sheet = screen.getByRole("dialog", { name: "Filtros" });

    await userEvent.click(screen.getByRole("button", { name: "Cerrar" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    // The backdrop is the dialog itself.
    await userEvent.click(sheet);
    expect(onClose).toHaveBeenCalledTimes(2);
    // Escape: the browser closes the dialog and tells.
    sheet.dispatchEvent(new Event("close"));
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it("does not close when its content is pressed", async () => {
    const { onClose } = setup();
    await userEvent.click(screen.getByText("Contenido"));
    expect(onClose).not.toHaveBeenCalled();
  });

  it("follows `open` and never stays open once unmounted (Activity)", () => {
    const { rerender, unmount } = setup(false);
    const sheet = document.querySelector("dialog")!;
    expect(sheet).not.toHaveAttribute("open");
    rerender(
      <Sheet open onClose={() => {}} title="Filtros">
        <p>Contenido</p>
      </Sheet>,
    );
    expect(sheet).toHaveAttribute("open");
    unmount();
    expect(sheet).not.toHaveAttribute("open");
  });
});
