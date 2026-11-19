// What a quick change sends and how it is undone (spec 017 RF-24 to RF-30,
// plan undo-core, D8, D9). The token only lives in the client for 10 s.

import type { OfflineChange } from "@/lib/offline/outbox";

export type Change =
  | { kind: "times"; startsAt: string; endsAt: string; allDay: boolean }
  /** null = the calendar's color (RF-37). */
  | { kind: "color"; color: string | null };

export type UndoToken =
  /** Write `before` again if the event is still as this change left it (RF-27, RF-29). */
  | {
      kind: "change";
      id: string;
      before: Change;
      updatedAt: string;
      series: boolean;
    }
  /**
   * A deleted event, from the trash (RF-28, spec 046 RF-14). Deleting several
   * occurrences keeps the series' updated_at after the deletion: someone
   * changed it if it differs (spec 046 RF-15).
   */
  | {
      kind: "restore";
      trashId: string;
      guard?: { id: string; updatedAt: string };
      /** What "Rehacer" deletes again: an occurrence and its scope (spec 046 RF-12). */
      again?: { id: string; scope: "this" | "following" | "all" };
    }
  /** "Rehacer" a deletion: deletes again, back to the trash (spec 046 RF-12). */
  | { kind: "delete"; id: string; scope?: "this" | "following" | "all" }
  /** A pasted copy: undoing deletes it (RF-58). */
  | { kind: "unpaste"; id: string }
  /** A change still waiting on this device: undoing takes it out of the queue (spec 034 RF-30). */
  /** `change`: to undo it online once sent (spec 046 RF-16). */
  | { kind: "offline"; changeId: string; change?: OfflineChange };

/** The notices of RF-24, RF-25, RF-57 and RF-58. */
export const UNDO_NOTICES = {
  moved: "Evento movido",
  resized: "Duración cambiada",
  color: "Color cambiado",
  deleted: "Evento borrado",
  copied: "Evento copiado",
  pasted: "Evento pegado",
  undone: "Deshecho",
} as const;

export const UNDO_ERRORS = {
  changed: "Este evento ha cambiado entretanto; no se ha deshecho.",
  expired: "Ya no se puede deshacer.",
  seriesGone:
    "La serie de esta repetición ya no existe; no se puede restaurar.",
} as const;
