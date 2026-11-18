// Images added and removed without a connection (spec 035 RF-32 to RF-35):
// reduced as always, kept in "pending-images" and queued; the limits count
// the saved ones and the pending ones.
import { prepareImage, type PreparedImage } from "@/lib/images/prepare-image";
import { deletePendingImages, savePendingImage } from "./db";
import { imageRoom } from "./image-limits";
import { OFFLINE_MESSAGES } from "./messages";
import { addChange, getQueueState } from "./queue-store";

/** The localIds of the images of an event still waiting (all events without one). */
export function pendingImageIds(eventId?: string): string[] {
  return getQueueState().queue.flatMap(({ change }) =>
    change.type === "image.add" && (!eventId || change.eventId === eventId)
      ? [change.localId]
      : [],
  );
}

/**
 * Keeps the files for later, as many as fit. `saved`: the images the event
 * shows now. The notice says why some were left out.
 */
export async function addImagesOffline(
  eventId: string,
  files: readonly File[],
  saved: number,
  prepare: (file: File) => Promise<PreparedImage> = prepareImage,
): Promise<{ added: number; notice: string | null }> {
  const counts = {
    saved,
    pendingHere: pendingImageIds(eventId).length,
    pendingAll: pendingImageIds().length,
  };
  const { room } = imageRoom(counts);
  let added = 0;
  // The reason of the limit reached once the ones that fit are in.
  let notice =
    files.length > room
      ? imageRoom({
          saved,
          pendingHere: counts.pendingHere + room,
          pendingAll: counts.pendingAll + room,
        }).reason
      : null;
  for (const file of files.slice(0, room)) {
    const prepared = await prepare(file);
    if ("error" in prepared) {
      notice = prepared.error;
      continue;
    }
    const localId = crypto.randomUUID();
    const kept = await savePendingImage({
      localId,
      eventId,
      full: prepared.full,
      thumb: prepared.thumb,
      width: prepared.width,
      height: prepared.height,
      bytes: prepared.full.size + prepared.thumb.size,
      reservedId: null,
    });
    // A full device: what is already kept stays (R4).
    if (!kept) return { added, notice: OFFLINE_MESSAGES.deviceFull };
    await addChange({ type: "image.add", eventId, localId });
    added += 1;
  }
  return { added, notice };
}

/** "Quitar" of an image still waiting: it leaves the queue and the device (RF-35). */
export async function removePendingImage(
  eventId: string,
  localId: string,
): Promise<void> {
  // image.add followed by image.delete is nothing to send (outbox `combine`).
  await addChange({ type: "image.delete", id: localId, eventId });
  await deletePendingImages([localId]);
}
