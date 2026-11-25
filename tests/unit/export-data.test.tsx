import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ExportData, EXPORT_TEXTS } from "@/components/account/export-data";
import type { AccountExport } from "@/lib/export/account-export";
import { exportEntries, imagePaths } from "@/lib/export/account-export";

// Spec 049, T5: "Descargar mis datos" in the browser (RF-12 to RF-15).
vi.mock("@/lib/images/download-image", () => ({ downloadImage: vi.fn() }));

const DATA: AccountExport = {
  profile: { name: "Ana", email: "ana@gmail.com", time_zone: "Europe/Madrid" },
  calendars: [
    {
      id: "c1",
      name: "Familia",
      description: null,
      color: "#7c3aed",
      role: "owner",
      categories: ["Cole"],
      members: [{ name: "Luis", role: "editor" }],
    },
  ],
  comments: [{ body: "Llevo pan" }],
  notes: [{ title: "Compra", items: [] }],
  images: [
    { objectId: "o1", eventId: "e1", eventTitle: "Cumple: Ana" },
    { objectId: "o2", eventId: "e1", eventTitle: "Cumple: Ana" },
  ],
};

const names = (entries: { name: string }[]) => entries.map((e) => e.name);

describe("exportEntries", () => {
  it("holds each file of RF-13 and never the ids", () => {
    const entries = exportEntries(
      DATA,
      new Map([["c1", "BEGIN:VCALENDAR"]]),
      [{ path: "imagenes/Cumple_ Ana/1.jpg", data: new Uint8Array([1]) }],
      true,
      new Date(2026, 10, 25),
    );
    expect(names(entries)).toEqual([
      "LEEME.txt",
      "perfil.json",
      "calendarios.json",
      "calendarios/Familia.ics",
      "comentarios.json",
      "notas.json",
      "imagenes/Cumple_ Ana/1.jpg",
    ]);
    const calendars = new TextDecoder().decode(entries[2]!.data);
    expect(calendars).toContain('"Luis"');
    expect(calendars).not.toContain('"c1"');
  });

  it("names the images by event and number", () => {
    expect(imagePaths(DATA.images)).toEqual([
      "imagenes/Cumple_ Ana/1.jpg",
      "imagenes/Cumple_ Ana/2.jpg",
    ]);
  });
});

describe("ExportData", () => {
  it("shows the progress and saves a cafam-<date>.zip", async () => {
    const save = vi.fn();
    const image = vi.fn(async () => new Blob([new Uint8Array([9])]));
    render(
      <ExportData
        load={async () => DATA}
        loadIcs={async () => "BEGIN:VCALENDAR"}
        image={image}
        save={save}
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Descargar mis datos" }),
    );
    expect(await screen.findByText(EXPORT_TEXTS.done)).toBeInTheDocument();
    expect(image).toHaveBeenCalledWith("o1/full.jpg");
    const [blob, name] = save.mock.calls[0]!;
    expect(name).toMatch(/^cafam-\d{4}-\d{2}-\d{2}\.zip$/);
    expect((blob as Blob).type).toBe("application/zip");
  });

  it("asks before including too many images, and can leave them out (RF-15)", async () => {
    const save = vi.fn();
    const image = vi.fn();
    const many = {
      ...DATA,
      images: Array.from({ length: 301 }, (_, i) => ({
        objectId: `o${i}`,
        eventId: "e1",
        eventTitle: "x",
      })),
    };
    render(
      <ExportData
        load={async () => many}
        loadIcs={async () => null}
        image={image}
        save={save}
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Descargar mis datos" }),
    );
    await userEvent.click(
      await screen.findByRole("button", { name: "Sin imágenes" }),
    );
    await screen.findByText(EXPORT_TEXTS.done);
    expect(image).not.toHaveBeenCalled();
    expect(save).toHaveBeenCalledOnce();
  });

  it("can be cancelled while it works", async () => {
    const save = vi.fn();
    let finish: (value: string | null) => void = () => {};
    render(
      <ExportData
        load={async () => DATA}
        loadIcs={() => new Promise((resolve) => (finish = resolve))}
        save={save}
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Descargar mis datos" }),
    );
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Calendarios: 1 de 1",
    );
    await userEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    finish("x");
    expect(await screen.findByText(EXPORT_TEXTS.cancelled)).toBeInTheDocument();
    expect(save).not.toHaveBeenCalled();
  });
});
