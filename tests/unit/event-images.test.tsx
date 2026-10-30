import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { EventImages } from "@/components/images/event-images";
import type { EventImage } from "@/lib/images/queries";

// Spec 012, T10: thumbnails in the detail and the full-screen viewer (RF-9 to
// RF-11, RF-13 to RF-15, RF-25, RF-26).
const h = vi.hoisted(() => ({
  downloadImage: vi.fn(),
  deleteImage: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("@/lib/images/download-image", () => ({
  downloadImage: h.downloadImage,
}));
vi.mock("@/app/dashboard/events/image-actions", () => ({
  deleteImage: h.deleteImage,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: h.refresh }),
}));

const IMAGES: EventImage[] = [
  {
    id: "i1",
    objectId: "o1",
    width: 2048,
    height: 1536,
    createdAt: "2026-11-01T10:00:00Z",
    author: "Ana",
    canDelete: false,
  },
  {
    id: "i2",
    objectId: "o2",
    width: 1536,
    height: 2048,
    createdAt: "2026-11-01T11:30:00Z",
    author: "Cuenta borrada",
    canDelete: true,
  },
  {
    id: "i3",
    objectId: "o3",
    width: 400,
    height: 400,
    createdAt: "2026-11-02T09:00:00Z",
    author: "Bea",
    canDelete: false,
  },
];

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function close() {
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  };
});

beforeEach(() => {
  h.downloadImage.mockReset();
  h.downloadImage.mockImplementation(
    async (path: string) => new Blob([path], { type: "image/jpeg" }),
  );
  h.deleteImage.mockReset();
  h.deleteImage.mockResolvedValue({});
  h.refresh.mockReset();
  let n = 0;
  URL.createObjectURL = vi.fn(() => `blob:url-${n++}`);
  URL.revokeObjectURL = vi.fn();
});

afterEach(() => {
  vi.restoreAllMocks();
});

function setup(images = IMAGES) {
  return render(
    <EventImages
      images={images}
      title="Cumpleaños de Ana"
      timeZone="Europe/Madrid"
    />,
  );
}

describe("EventImages", () => {
  it("shows nothing without images", () => {
    const { container } = setup([]);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the thumbnails in order with their alt text (RF-9, RF-14)", async () => {
    setup();
    const thumbs = await screen.findAllByRole("img");
    expect(thumbs.map((img) => img.getAttribute("alt"))).toEqual([
      "Cumpleaños de Ana, imagen 1 de 3",
      "Cumpleaños de Ana, imagen 2 de 3",
      "Cumpleaños de Ana, imagen 3 de 3",
    ]);
    expect(h.downloadImage).toHaveBeenCalledWith("o1/thumb.jpg");
    expect(h.downloadImage).not.toHaveBeenCalledWith("o1/full.jpg");
  });

  it("frees the downloaded images when it goes away", async () => {
    const { unmount } = setup();
    await screen.findAllByRole("img");
    unmount();
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(3);
  });

  it("marks an image that cannot be downloaded (RF-25, RF-26)", async () => {
    h.downloadImage.mockImplementation(async (path: string) =>
      path.startsWith("o2") ? null : new Blob(["x"]),
    );
    setup();
    expect(await screen.findByText("No disponible")).toBeInTheDocument();
  });
});

describe("ImageViewer", () => {
  async function open(index: number) {
    setup();
    const buttons = await screen.findAllByRole("button", {
      name: /^Ver Cumpleaños de Ana, imagen/,
    });
    await userEvent.click(buttons[index]);
    return screen.getByRole("dialog");
  }

  it("opens on the pressed image with author and date (RF-10, RF-11)", async () => {
    const dialog = await open(1);
    expect(dialog).toHaveAttribute("open");
    expect(within(dialog).getByText("Imagen 2 de 3")).toBeInTheDocument();
    expect(within(dialog).getByText(/Cuenta borrada/)).toBeInTheDocument();
    expect(within(dialog).getByText(/1 nov 2026, 12:30/)).toBeInTheDocument();
    await waitFor(() =>
      expect(h.downloadImage).toHaveBeenCalledWith("o2/full.jpg"),
    );
  });

  it("moves with the buttons, the arrow keys and a swipe (RF-10)", async () => {
    const dialog = await open(0);
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Siguiente" }),
    );
    expect(within(dialog).getByText("Imagen 2 de 3")).toBeInTheDocument();
    fireEvent.keyDown(dialog, { key: "ArrowRight" });
    expect(within(dialog).getByText("Imagen 3 de 3")).toBeInTheDocument();
    fireEvent.keyDown(dialog, { key: "ArrowRight" });
    expect(within(dialog).getByText("Imagen 3 de 3")).toBeInTheDocument();
    fireEvent.keyDown(dialog, { key: "ArrowLeft" });
    expect(within(dialog).getByText("Imagen 2 de 3")).toBeInTheDocument();
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Anterior" }),
    );
    expect(within(dialog).getByText("Imagen 1 de 3")).toBeInTheDocument();

    const stage = within(dialog).getByTestId("viewer-stage");
    fireEvent.pointerDown(stage, { clientX: 300, pointerType: "touch" });
    fireEvent.pointerUp(stage, { clientX: 100, pointerType: "touch" });
    expect(within(dialog).getByText("Imagen 2 de 3")).toBeInTheDocument();
    fireEvent.pointerDown(stage, { clientX: 100, pointerType: "touch" });
    fireEvent.pointerUp(stage, { clientX: 300, pointerType: "touch" });
    expect(within(dialog).getByText("Imagen 1 de 3")).toBeInTheDocument();
  });

  it("closes with Cerrar and with Escape (RF-10)", async () => {
    let dialog = await open(0);
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Cerrar" }),
    );
    expect(dialog).not.toHaveAttribute("open");

    const buttons = screen.getAllByRole("button", {
      name: /^Ver Cumpleaños de Ana, imagen/,
    });
    await userEvent.click(buttons[0]);
    dialog = screen.getByRole("dialog");
    // jsdom fires no cancel on Escape: the browser closes the dialog itself.
    fireEvent(dialog, new Event("cancel", { cancelable: true }));
    expect(dialog).not.toHaveAttribute("open");
  });

  it("downloads the stored image with a readable name (RF-13)", async () => {
    const dialog = await open(1);
    const link = await within(dialog).findByRole("link", { name: "Descargar" });
    expect(link).toHaveAttribute("download", "Cumpleaños de Ana-2.jpg");
    expect(link.getAttribute("href")).toMatch(/^blob:/);
    // One link only, also after moving to another image.
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Siguiente" }),
    );
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Anterior" }),
    );
    await waitFor(() =>
      expect(
        within(dialog).getAllByRole("link", { name: "Descargar" }),
      ).toHaveLength(1),
    );
  });

  it("offers Borrar only when allowed and deletes after confirming (RF-15)", async () => {
    let dialog = await open(0);
    expect(
      within(dialog).queryByRole("button", { name: "Borrar imagen" }),
    ).toBeNull();
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Siguiente" }),
    );
    dialog = screen.getAllByRole("dialog")[0];
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Borrar imagen" }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Sí, borrar" }));
    await waitFor(() => expect(h.deleteImage).toHaveBeenCalledWith("i2"));
    await waitFor(() => expect(h.refresh).toHaveBeenCalled());
  });

  it("shows the reason when deleting fails", async () => {
    h.deleteImage.mockResolvedValue({
      error: "No tienes permiso para hacer esto.",
    });
    await open(1);
    await userEvent.click(
      screen.getByRole("button", { name: "Borrar imagen" }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Sí, borrar" }));
    expect(
      await screen.findByText("No tienes permiso para hacer esto."),
    ).toBeInTheDocument();
    expect(h.refresh).not.toHaveBeenCalled();
  });
});
