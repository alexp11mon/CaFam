import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prepareImage } from "@/lib/images/prepare-image";
import { IMAGE_MESSAGES } from "@/lib/images/error-messages";

// Spec 012, T7: reducing and recompressing on the device (plan D2; RF-3,
// RF-5, RF-21). jsdom has no canvas or createImageBitmap: they are simulated.
const close = vi.fn();
const drawImage = vi.fn();
const fillRect = vi.fn();
const blobs: {
  width: number;
  height: number;
  type: string;
  quality: number;
}[] = [];

function file(size: number, type = "image/jpeg", name = "foto.jpg") {
  const f = new File(["x"], name, { type });
  Object.defineProperty(f, "size", { value: size });
  return f;
}

beforeEach(() => {
  close.mockReset();
  drawImage.mockReset();
  blobs.length = 0;
  vi.stubGlobal(
    "createImageBitmap",
    vi.fn(async () => ({ width: 4032, height: 3024, close })),
  );
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
    () =>
      ({ fillStyle: "", fillRect, drawImage }) as unknown as RenderingContext,
  );
  HTMLCanvasElement.prototype.toBlob = function (
    this: HTMLCanvasElement,
    callback: BlobCallback,
    type?: string,
    quality?: number,
  ) {
    blobs.push({
      width: this.width,
      height: this.height,
      type: type ?? "",
      quality: quality ?? 0,
    });
    callback(new Blob(["jpeg"], { type }));
  };
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("prepareImage", () => {
  it("rejects a type that is not accepted without decoding it", async () => {
    const result = await prepareImage(file(100, "image/gif", "a.gif"));
    expect(result).toEqual({ error: IMAGE_MESSAGES.type });
    expect(createImageBitmap).not.toHaveBeenCalled();
  });

  it("rejects more than 20 MB before reducing (RF-21)", async () => {
    const result = await prepareImage(file(20 * 1024 * 1024 + 1));
    expect(result).toEqual({ error: IMAGE_MESSAGES.tooBig });
    expect(createImageBitmap).not.toHaveBeenCalled();
  });

  it("reduces to 2048 px and to a 400 px thumbnail, as JPEG (RF-5)", async () => {
    const result = await prepareImage(file(5_000_000));

    expect(createImageBitmap).toHaveBeenCalledWith(expect.any(File), {
      imageOrientation: "from-image",
    });
    expect(blobs).toEqual([
      { width: 2048, height: 1536, type: "image/jpeg", quality: 0.82 },
      { width: 400, height: 300, type: "image/jpeg", quality: 0.75 },
    ]);
    // Transparent pixels get an opaque background: JPEG has no alpha.
    expect(fillRect).toHaveBeenCalled();
    expect(close).toHaveBeenCalled();
    expect(result).toMatchObject({ width: 2048, height: 1536 });
    if ("full" in result) {
      expect(result.full.type).toBe("image/jpeg");
      expect(result.thumb.type).toBe("image/jpeg");
    }
  });

  it("says the browser cannot read an image it fails to decode", async () => {
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn(async () => {
        throw new Error("decode");
      }),
    );
    // jsdom has neither object URLs nor HTMLImageElement.decode.
    URL.createObjectURL = vi.fn(() => "blob:x");
    URL.revokeObjectURL = vi.fn();
    HTMLImageElement.prototype.decode = vi.fn(async () => {
      throw new Error("decode");
    });
    const result = await prepareImage(file(1000, "image/heic", "a.heic"));
    expect(result).toEqual({ error: IMAGE_MESSAGES.unreadable });
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:x");
  });
});
