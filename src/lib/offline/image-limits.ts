// How many images can still be added offline (spec 035 RF-33, RF-34): 10 per
// event counting the saved and the pending ones, and 20 pending in all, so
// what waits on the device stays within RNF-2. Pure.
import { IMAGE_MESSAGES } from "@/lib/images/error-messages";
import { MAX_PER_EVENT } from "@/lib/images/limits";
import { OFFLINE_MESSAGES } from "./messages";

export const MAX_PENDING_IMAGES = 20;

export interface ImageCounts {
  /** Images the event already has. */
  saved: number;
  /** Images of this event waiting to be sent. */
  pendingHere: number;
  /** Images of every event waiting to be sent. */
  pendingAll: number;
}

/** How many more fit, and why not when none does. */
export function imageRoom(counts: ImageCounts): {
  room: number;
  reason: string | null;
} {
  const forEvent = MAX_PER_EVENT - counts.saved - counts.pendingHere;
  const forDevice = MAX_PENDING_IMAGES - counts.pendingAll;
  const room = Math.max(0, Math.min(forEvent, forDevice));
  if (room > 0) return { room, reason: null };
  return {
    room,
    reason:
      forEvent <= 0
        ? IMAGE_MESSAGES.eventFull
        : OFFLINE_MESSAGES.pendingImagesFull,
  };
}
