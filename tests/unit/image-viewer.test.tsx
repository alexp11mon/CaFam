import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { ImageViewer } from "@/components/images/image-viewer";
import type { EventImage } from "@/lib/images/queries";

// Spec 021, T17: the image follows the finger, with a rubber band at the
// ends (RF-30..RF-33).
vi.mock("@/lib/images/download-image", () => ({
  downloadImage: async () => new Blob(["x"], { type: "image/jpeg" }),
}));
vi.mock("@/app/dashboard/events/image-actions", () => ({
  deleteImage: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const image = (id: string): EventImage => ({
  id,
  objectId: `o-${id}`,
  width: 400,
  height: 300,
  createdAt: "2026-11-01T10:00:00Z",
  author: "Ana",
  canDelete: false,
});
const THREE = [image("a"), image("b"), image("c")];

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function close() {
    this.removeAttribute("open");
  };
  URL.createObjectURL = () => "blob:x";
  URL.revokeObjectURL = () => {};
});

const frame = () =>
  act(
    () =>
      new Promise<void>((resolve) => requestAnimationFrame(() => resolve())),
  );
const touch = (
  type: "pointerDown" | "pointerMove" | "pointerUp",
  el: Element,
  x: number,
) =>
  fireEvent[type](el, {
    pointerType: "touch",
    pointerId: 1,
    clientX: x,
    clientY: 300,
  });

async function slide(from: number, to: number, start = 0, images = THREE) {
  render(
    <ImageViewer
      images={images}
      start={start}
      title="Cena"
      timeZone="Europe/Madrid"
      onClose={vi.fn()}
    />,
  );
  const stage = screen.getByTestId("viewer-stage");
  stage.getBoundingClientRect = () => ({ width: 400 }) as DOMRect;
  touch("pointerDown", stage, from);
  touch("pointerMove", stage, to);
  await frame();
  return stage;
}

const counter = () => within(screen.getByRole("dialog")).getByText(/^Imagen/);

describe("ImageViewer under a finger", () => {
  it("follows the finger and comes back under a quarter of its width", async () => {
    const stage = await slide(300, 240);
    expect(stage.style.translate).toBe("-60px 0px");
    touch("pointerUp", stage, 240);
    expect(counter()).toHaveTextContent("Imagen 1 de 3");
    expect(stage.style.translate).toBe("");
  });

  it("changes past a quarter, the new one entering from the other side", async () => {
    const stage = await slide(300, 150);
    touch("pointerUp", stage, 150);
    expect(counter()).toHaveTextContent("Imagen 2 de 3");
    expect(stage.style.translate).toBe("");
    expect(stage.querySelector("[data-enter-from]")).toHaveAttribute(
      "data-enter-from",
      "right",
    );

    touch("pointerDown", stage, 100);
    touch("pointerMove", stage, 250);
    touch("pointerUp", stage, 250);
    expect(counter()).toHaveTextContent("Imagen 1 de 3");
    expect(stage.querySelector("[data-enter-from]")).toHaveAttribute(
      "data-enter-from",
      "left",
    );
  });

  it("bands at the first and the last image (RF-32)", async () => {
    const first = await slide(100, 400);
    const offset = parseFloat(first.style.translate);
    expect(offset).toBeGreaterThan(0);
    expect(offset).toBeLessThan(64);
    touch("pointerUp", first, 400);
    expect(counter()).toHaveTextContent("Imagen 1 de 3");
  });

  it("bands both ways with a single image", async () => {
    const stage = await slide(400, 100, 0, [image("a")]);
    const offset = parseFloat(stage.style.translate);
    expect(offset).toBeLessThan(0);
    expect(offset).toBeGreaterThan(-64);
  });

  it("bands at the last image", async () => {
    const stage = await slide(400, 100, 2);
    expect(parseFloat(stage.style.translate)).toBeGreaterThan(-64);
    touch("pointerUp", stage, 100);
    expect(counter()).toHaveTextContent("Imagen 3 de 3");
  });
});
