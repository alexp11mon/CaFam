// What a quick change sends and how it is undone (spec 017 RF-24 to RF-30,
// plan undo-core, D8, D9). The token only lives in the client for 10 s.

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
  /** A deleted event, from its snapshot (RF-28). */
  | { kind: "restore"; trashId: string }
  /** A pasted copy: undoing deletes it (RF-58). */
  | { kind: "unpaste"; id: string };

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
} as const;
