// The full images opened with a connection, at most 30, for the viewer
// without one (spec 035 RF-31, plan D10): the one used longest ago goes.
import {
  cachedImageUses,
  deleteCachedImages,
  getCachedImage,
  isQuotaError,
  putCachedImage,
} from "./db";

export const MAX_CACHED_IMAGES = 30;

/** Keeps an image the viewer opened; a full device just skips it (R4). */
export async function rememberImage(
  id: string,
  blob: Blob,
  now = Date.now(),
): Promise<void> {
  try {
    await putCachedImage(id, { blob, usedAt: now });
  } catch (error) {
    if (isQuotaError(error)) return;
    throw error;
  }
  const uses = await cachedImageUses();
  if (uses.length <= MAX_CACHED_IMAGES) return;
  const oldest = uses
    .sort((a, b) => a.usedAt - b.usedAt)
    .slice(0, uses.length - MAX_CACHED_IMAGES)
    .map((use) => use.id);
  await deleteCachedImages(oldest);
}

/** The full image if the device has it, marked as just used. */
export async function cachedImage(
  id: string,
  now = Date.now(),
): Promise<Blob | null> {
  const cached = await getCachedImage(id);
  if (!cached) return null;
  await putCachedImage(id, { ...cached, usedAt: now }).catch(() => {});
  return cached.blob;
}
