import type { OfflineChange } from "./outbox";

/**
 * The change that undoes one already sent (spec 046 RF-16): applied online
 * with `applyOfflineChange`, whose three versions say if someone changed it
 * since (RF-13). Only single events; a series, a note or a comment no.
 */
export function inverseOf(change: OfflineChange): OfflineChange | null {
  if (change.type === "event.update" && !change.repeat) {
    return {
      type: "event.update",
      id: change.id,
      base: change.data,
      data: change.base,
    };
  }
  if (change.type === "event.create" && !change.repeat) {
    return { type: "event.delete", id: change.id, base: change.data };
  }
  if (change.type === "event.delete") {
    return { type: "event.create", id: change.id, data: change.base };
  }
  return null;
}
