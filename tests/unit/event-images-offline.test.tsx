import { render, screen, waitFor, within } from "@testing-library/react";
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
import { ImageUploader } from "@/components/images/image-uploader";
import { ToastProvider } from "@/components/ui/toast";
import { IMAGE_MESSAGES } from "@/lib/images/error-messages";
import type { EventImage } from "@/lib/images/queries";
import { resetConnection, startWatching } from "@/lib/offline/connection";
import { forgetConnection, putThumb } from "@/lib/offline/db";
import { OFFLINE_MESSAGES } from "@/lib/offline/messages";
import { clearQueue, getQueueState } from "@/lib/offline/queue-store";
import { memoryIndexedDb } from "./memory-indexeddb";

// Spec 035 T10: the gallery, the viewer and adding images without a
// connection (RF-30 to RF-37).
const h = vi.hoisted(() => ({
  downloadImage: vi.fn(),
  deleteImage: vi.fn(),
}));
vi.mock("@/lib/images/download-image", () => ({
  downloadImage: h.downloadImage,
}));
vi.mock("@/app/dashboard/events/image-actions", () => ({
  deleteImage: h.deleteImage,
}));
vi.mock("@/app/dashboard/events/quick-actions", () => ({
  undoAction: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));
vi.mock("@/lib/images/prepare-image", () => ({
  prepareImage: vi.fn(async () => ({
    full: new Blob(["full"], { type: "image/jpeg" }),
    thumb: new Blob(["thumb"], { type: "image/jpeg" }),
    width: 800,
    height: 600,
  })),
}));

const EVENT = "ev-1";
const image = (n: number): EventImage => ({
  id: `i${n}`,
  objectId: `o${n}`,
  width: 800,
  height: 600,
  createdAt: "2026-11-01T10:00:00Z",
  author: "Ana",
  canDelete: true,
});

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function close() {
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  };
});

beforeEach(async () => {
  vi.stubGlobal("indexedDB", memoryIndexedDb());
  forgetConnection();
  await clearQueue();
  h.downloadImage.mockReset();
  h.deleteImage.mockReset();
  let n = 0;
  URL.createObjectURL = vi.fn(() => `blob:url-${n++}`);
  URL.revokeObjectURL = vi.fn();
  startWatching();
  window.dispatchEvent(new Event("offline"));
});
afterEach(() => {
  resetConnection();
  vi.unstubAllGlobals();
});

const changes = () => getQueueState().queue.map((entry) => entry.change);

function gallery(images: EventImage[]) {
  return render(
    <ToastProvider>
      <EventImages
        images={images}
        title="Cena"
        timeZone="Europe/Madrid"
        eventId={EVENT}
      />
      <ImageUploader eventId={EVENT} saved={images.length} />
    </ToastProvider>,
  );
}

const picker = () =>
  document.querySelector<HTMLInputElement>('input[type="file"]')!;

const files = (n: number) =>
  Array.from(
    { length: n },
    (_, i) => new File([`f${i}`], `f${i}.jpg`, { type: "image/jpeg" }),
  );

describe("gallery and viewer offline (RF-30, RF-31, RF-37)", () => {
  it("shows the saved thumbnail and, without the full image, says why", async () => {
    await putThumb("i1", new Blob(["t"], { type: "image/jpeg" }));
    gallery([image(1)]);

    const thumb = await screen.findByRole("img", {
      name: "Cena, imagen 1 de 1",
    });
    expect(thumb).toHaveAttribute("src", expect.stringMatching(/^blob:/));
    expect(h.downloadImage).not.toHaveBeenCalled();

    await userEvent.click(
      screen.getByRole("button", { name: "Ver Cena, imagen 1 de 1" }),
    );
    expect(
      await screen.findByText(OFFLINE_MESSAGES.fullImageNeedsNetwork),
    ).toBeVisible();
  });

  it("deletes an image into the queue with its Deshacer", async () => {
    gallery([image(1)]);
    await userEvent.click(
      screen.getByRole("button", { name: "Ver Cena, imagen 1 de 1" }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Borrar imagen" }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Sí, borrar" }));

    expect(h.deleteImage).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(changes()).toEqual([
        { type: "image.delete", id: "i1", eventId: EVENT },
      ]),
    );
    expect(
      screen.queryByRole("button", { name: "Ver Cena, imagen 1 de 1" }),
    ).toBeNull();

    const toast = await screen.findByText(OFFLINE_MESSAGES.imageDeleted);
    await userEvent.click(
      within(toast.closest("[data-toast]") ?? document.body).getByRole(
        "button",
        { name: "Deshacer" },
      ),
    );
    await waitFor(() => expect(changes()).toEqual([]));
    expect(
      screen.getByRole("button", { name: "Ver Cena, imagen 1 de 1" }),
    ).toBeVisible();
  });
});

describe("adding images offline (RF-32 to RF-35)", () => {
  it("keeps them as pending, and Quitar takes one away", async () => {
    gallery([]);
    await userEvent.upload(picker(), files(2));

    expect(
      await screen.findByText(OFFLINE_MESSAGES.imagesKept(2)),
    ).toBeVisible();
    expect(screen.getAllByText("Pendiente de enviar")).toHaveLength(2);
    expect(changes().map((change) => change.type)).toEqual([
      "image.add",
      "image.add",
    ]);

    await userEvent.click(
      screen.getAllByRole("button", { name: /^Quitar/ })[0],
    );
    await waitFor(() => expect(changes()).toHaveLength(1));
    expect(
      await screen.findByText(OFFLINE_MESSAGES.imageRemoved),
    ).toBeVisible();
  });

  it("stops at 10 per event counting the saved ones", async () => {
    gallery(Array.from({ length: 9 }, (_, i) => image(i + 1)));
    await userEvent.upload(picker(), files(3));
    expect(await screen.findByText(IMAGE_MESSAGES.eventFull)).toBeVisible();
    expect(changes()).toHaveLength(1);
  });

  it("stops at 20 waiting on the device", async () => {
    const { unmount } = gallery([]);
    unmount();
    const { addImagesOffline } = await import("@/lib/offline/image-actions");
    await addImagesOffline("other-1", files(10), 0);
    await addImagesOffline("other-2", files(8), 0);

    gallery([]);
    await userEvent.upload(picker(), files(3));
    expect(
      await screen.findByText(OFFLINE_MESSAGES.pendingImagesFull),
    ).toBeVisible();
    expect(changes()).toHaveLength(20);
  });
});
