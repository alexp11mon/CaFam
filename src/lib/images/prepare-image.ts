import { IMAGE_MESSAGES } from "./error-messages";
import { fitWithin } from "./fit";
import {
  FULL_QUALITY,
  FULL_SIDE,
  MAX_SOURCE_BYTES,
  THUMB_QUALITY,
  THUMB_SIDE,
  isAcceptedType,
} from "./limits";

export type PreparedImage =
  | { full: Blob; thumb: Blob; width: number; height: number }
  | { error: string };

type Source = CanvasImageSource & { width: number; height: number };

// Browser only. Re-encoding through a canvas keeps the pixels and drops every
// metadata, location included (spec 012 plan D2; RF-3, RF-5, RF-21).
export async function prepareImage(file: File): Promise<PreparedImage> {
  if (!isAcceptedType(file.type, file.name)) {
    return { error: IMAGE_MESSAGES.type };
  }
  if (file.size > MAX_SOURCE_BYTES) return { error: IMAGE_MESSAGES.tooBig };

  const decoded = await decode(file);
  if (!decoded) return { error: IMAGE_MESSAGES.unreadable };
  try {
    const full = await render(decoded.source, FULL_SIDE, FULL_QUALITY);
    const thumb = await render(decoded.source, THUMB_SIDE, THUMB_QUALITY);
    if (!full || !thumb) return { error: IMAGE_MESSAGES.unreadable };
    return { full: full.blob, thumb: thumb.blob, ...full.size };
  } finally {
    decoded.release();
  }
}

/** createImageBitmap applies the EXIF orientation; an <img> is the fallback (plan R2). */
async function decode(
  file: File,
): Promise<{ source: Source; release: () => void } | null> {
  try {
    const bitmap = await createImageBitmap(file, {
      imageOrientation: "from-image",
    });
    return { source: bitmap, release: () => bitmap.close() };
  } catch {
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      const source = Object.assign(img, {
        width: img.naturalWidth,
        height: img.naturalHeight,
      });
      return { source, release: () => URL.revokeObjectURL(url) };
    } catch {
      URL.revokeObjectURL(url);
      return null;
    }
  }
}

async function render(source: Source, max: number, quality: number) {
  const size = fitWithin(source.width, source.height, max);
  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  const context = canvas.getContext("2d");
  if (!context) return null;
  // JPEG has no alpha: transparent pixels would turn black.
  context.fillStyle = "#FFFFFF";
  context.fillRect(0, 0, size.width, size.height);
  context.drawImage(source, 0, 0, size.width, size.height);
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", quality),
  );
  // Frees the canvas memory at once on phones (plan R3).
  canvas.width = 0;
  canvas.height = 0;
  return blob ? { blob, size } : null;
}
