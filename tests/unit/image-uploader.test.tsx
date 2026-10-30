import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ImageUploader } from "@/components/images/image-uploader";

// Spec 012, T9: adding images from the event detail, with progress, cancel
// and retry (RF-1, RF-2, RF-4, RF-6, RF-8, RF-20, RF-24).
const EVENT = "5b8f6c2e-3f0a-4d8e-9a51-2a8f1d7c9e10";

const h = vi.hoisted(() => ({
  refresh: vi.fn(),
  reserveImages: vi.fn(),
  confirmImage: vi.fn(),
  cancelImage: vi.fn(),
  prepareImage: vi.fn(),
  uploadObject: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: h.refresh }),
}));
vi.mock("@/app/dashboard/events/image-actions", () => ({
  reserveImages: h.reserveImages,
  confirmImage: h.confirmImage,
  cancelImage: h.cancelImage,
}));
vi.mock("@/lib/images/prepare-image", () => ({
  prepareImage: h.prepareImage,
}));
vi.mock("@/lib/images/upload-object", () => ({
  uploadObject: h.uploadObject,
}));
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      getSession: async () => ({
        data: { session: { access_token: "token" } },
      }),
    },
  }),
}));

function photo(name: string) {
  return new File(["x"], name, { type: "image/jpeg" });
}

function input(container: HTMLElement) {
  return container.querySelector<HTMLInputElement>('input[type="file"]')!;
}

beforeEach(() => {
  for (const mock of Object.values(h)) mock.mockReset();
  h.prepareImage.mockImplementation(async () => ({
    full: new Blob(["full-bytes"], { type: "image/jpeg" }),
    thumb: new Blob(["th"], { type: "image/jpeg" }),
    width: 2048,
    height: 1536,
  }));
  h.reserveImages.mockImplementation(
    async (_event: string, specs: unknown[]) => ({
      ids: specs.map((_, i) => `id-${i}`),
    }),
  );
  h.uploadObject.mockResolvedValue("ok");
  h.confirmImage.mockResolvedValue({});
  h.cancelImage.mockResolvedValue({});
});

describe("ImageUploader", () => {
  it("offers Añadir imágenes with a file field for camera and gallery (RF-1, RF-2)", () => {
    const { container } = render(<ImageUploader eventId={EVENT} />);
    expect(
      screen.getByRole("button", { name: "Añadir imágenes" }),
    ).toBeInTheDocument();
    const field = input(container);
    expect(field.accept).toBe("image/*");
    expect(field.multiple).toBe(true);
    expect(field.hasAttribute("capture")).toBe(false);
  });

  it("reserves, uploads thumbnail and full image, confirms and refreshes once", async () => {
    const { container } = render(<ImageUploader eventId={EVENT} />);
    await userEvent.upload(input(container), [photo("a.jpg"), photo("b.jpg")]);

    await waitFor(() => expect(h.refresh).toHaveBeenCalledTimes(1));
    expect(h.reserveImages).toHaveBeenCalledWith(EVENT, [
      { bytes: 12, width: 2048, height: 1536 },
      { bytes: 12, width: 2048, height: 1536 },
    ]);
    const paths = h.uploadObject.mock.calls.map(([options]) => options.path);
    expect(paths.sort()).toEqual([
      "id-0/full.jpg",
      "id-0/thumb.jpg",
      "id-1/full.jpg",
      "id-1/thumb.jpg",
    ]);
    expect(h.uploadObject.mock.calls[0][0].accessToken).toBe("token");
    expect(h.confirmImage).toHaveBeenCalledWith("id-0");
    expect(h.confirmImage).toHaveBeenCalledWith("id-1");
  });

  it("shows the progress of each image and cancels it (RF-6)", async () => {
    let progress: (loaded: number, total: number) => void = () => {};
    let finish: (value: string) => void = () => {};
    h.uploadObject.mockImplementation(
      ({ onProgress, signal }) =>
        new Promise((resolve) => {
          progress = onProgress;
          finish = resolve;
          signal.addEventListener("abort", () => resolve("aborted"));
        }),
    );
    const { container } = render(<ImageUploader eventId={EVENT} />);
    await userEvent.upload(input(container), [photo("playa.jpg")]);

    const bar = await screen.findByRole("progressbar", {
      name: "Subiendo playa.jpg",
    });
    progress(6, 2);
    await waitFor(() => expect(bar).toHaveAttribute("aria-valuenow", "50"));

    await userEvent.click(
      screen.getByRole("button", { name: "Cancelar playa.jpg" }),
    );
    expect(h.cancelImage).toHaveBeenCalledWith("id-0");
    expect(screen.queryByText("playa.jpg")).not.toBeInTheDocument();
    finish("ok");
    expect(h.confirmImage).not.toHaveBeenCalled();
  });

  it("marks a network failure with Reintentar without touching the others (RF-24)", async () => {
    h.uploadObject.mockImplementation(async ({ path }) =>
      path.startsWith("id-0") ? "network" : "ok",
    );
    const { container } = render(<ImageUploader eventId={EVENT} />);
    await userEvent.upload(input(container), [photo("a.jpg"), photo("b.jpg")]);

    const row = (await screen.findByText("a.jpg")).closest("li")!;
    expect(
      await within(row).findByText("No se ha podido subir la imagen."),
    ).toBeInTheDocument();
    await waitFor(() => expect(h.confirmImage).toHaveBeenCalledWith("id-1"));
    expect(screen.queryByText("b.jpg")).not.toBeInTheDocument();

    h.uploadObject.mockResolvedValue("ok");
    await userEvent.click(
      within(row).getByRole("button", { name: "Reintentar" }),
    );
    await waitFor(() => expect(h.confirmImage).toHaveBeenCalledWith("id-0"));
    await waitFor(() =>
      expect(screen.queryByText("a.jpg")).not.toBeInTheDocument(),
    );
  });

  it("says how many fit and drops the rest (RF-20)", async () => {
    h.reserveImages.mockImplementation(
      async (_e: string, specs: unknown[]) => ({
        ids: specs.slice(0, 10).map((_, i) => `id-${i}`),
      }),
    );
    const { container } = render(<ImageUploader eventId={EVENT} />);
    const files = Array.from({ length: 12 }, (_, i) => photo(`f${i}.jpg`));
    await userEvent.upload(input(container), files);

    expect(
      await screen.findByText(
        "Solo caben 10 imágenes más en este evento. No se han añadido las demás.",
      ),
    ).toBeInTheDocument();
    expect(h.reserveImages.mock.calls[0][1]).toHaveLength(10);
    await waitFor(() => expect(h.confirmImage).toHaveBeenCalledTimes(10));
    expect(
      h.uploadObject.mock.calls.some(([o]) => o.path.startsWith("id-10")),
    ).toBe(false);
  });

  it("shows the reason when nothing can be reserved", async () => {
    h.reserveImages.mockResolvedValue({
      error: "Este evento ya tiene 10 imágenes.",
    });
    const { container } = render(<ImageUploader eventId={EVENT} />);
    await userEvent.upload(input(container), [photo("a.jpg")]);
    expect(
      await screen.findByText("Este evento ya tiene 10 imágenes."),
    ).toBeInTheDocument();
    expect(h.uploadObject).not.toHaveBeenCalled();
  });

  it("explains an image that cannot be prepared", async () => {
    h.prepareImage.mockResolvedValue({ error: "La imagen pesa más de 20 MB." });
    const { container } = render(<ImageUploader eventId={EVENT} />);
    await userEvent.upload(input(container), [photo("grande.jpg")]);
    const row = (await screen.findByText("grande.jpg")).closest("li")!;
    expect(
      within(row).getByText("La imagen pesa más de 20 MB."),
    ).toBeInTheDocument();
    expect(h.reserveImages).not.toHaveBeenCalled();
    await userEvent.click(within(row).getByRole("button", { name: "Quitar" }));
    expect(screen.queryByText("grande.jpg")).not.toBeInTheDocument();
  });
});
