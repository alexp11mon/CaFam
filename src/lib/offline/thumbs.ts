// The thumbnails of the images of the copy, kept as Blobs (spec 035 RF-29,
// plan D9): after each reading, those missing are downloaded 4 at a time and
// those no longer in the copy are deleted.
import { deleteThumbs, isQuotaError, putThumb, thumbIds } from "./db";

const AT_ONCE = 4;

export interface ThumbSource {
  id: string;
  objectId: string;
}

/** What the device must hold after this copy; downloads go through `download`. */
export async function syncThumbs(
  images: readonly ThumbSource[],
  download: (objectId: string) => Promise<Blob | null>,
): Promise<{ added: number; removed: number }> {
  const wanted = new Set(images.map((image) => image.id));
  const held = new Set(await thumbIds());
  const gone = [...held].filter((id) => !wanted.has(id));
  if (gone.length > 0) await deleteThumbs(gone);
  const missing = images.filter((image) => !held.has(image.id));
  let added = 0;
  let full = false;
  const next = async (): Promise<void> => {
    const image = missing.shift();
    if (!image || full) return;
    const blob = await download(image.objectId);
    if (blob) {
      try {
        await putThumb(image.id, blob);
        added += 1;
      } catch (error) {
        // A full device stops here; the views show the image without it.
        if (!isQuotaError(error)) throw error;
        full = true;
      }
    }
    return next();
  };
  await Promise.all(Array.from({ length: AT_ONCE }, next));
  return { added, removed: gone.length };
}
