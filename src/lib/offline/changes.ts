// What the "Cambios" sheet shows of a change waiting, refused or in conflict
// (spec 034 RF-48, RF-50 to RF-53, RF-55, plan changes-sheet). Pure.
import type { OfflineChange } from "./outbox";
import { OFFLINE_MESSAGES } from "./messages";

type Fields = Record<string, unknown>;

/** What the user did, in a few words, for the list. */
export function changeTitle(change: OfflineChange): string {
  switch (change.type) {
    case "event.create":
      return `Evento nuevo: ${change.data.title}`;
    case "event.update":
      return `Evento cambiado: ${change.data.title}`;
    case "event.delete":
      return `Evento borrado: ${change.base.title}`;
    case "note.create":
      return `Nota nueva: ${change.fields.title || "Sin título"}`;
    case "note.update":
      return `Nota cambiada: ${change.fields.title ?? change.base.title ?? "Sin título"}`;
    case "note.delete":
      return `Nota borrada: ${change.base.title || "Sin título"}`;
    case "item.add":
      return `Elemento nuevo: ${change.text}`;
    case "item.update":
      return `Elemento cambiado: ${change.change.text ?? change.base.text}`;
    case "item.delete":
      return `Elemento borrado: ${change.base.text}`;
    case "item.move":
      return "Orden de la lista";
  }
}

/** The user's version of what the change is about; null for a deletion. */
export function mineOf(change: OfflineChange): Fields | null {
  switch (change.type) {
    case "event.create":
    case "event.update":
      return { ...change.data };
    case "note.create":
      return { ...change.fields };
    case "note.update":
      return { ...change.base, ...change.fields };
    case "item.add":
      return { text: change.text, done: change.done };
    case "item.update":
      return { ...change.base, ...change.change };
    case "item.move":
      return { positions: change.positions };
    default:
      return null;
  }
}

export type ConflictKind = "changed" | "gone" | "deleteChanged";

/** Which question a conflict asks (RF-50, RF-51, RF-52). */
export function conflictKind(
  change: OfflineChange,
  server: Fields | null,
): ConflictKind {
  if (!server) return "gone";
  return change.type.endsWith(".delete") ? "deleteChanged" : "changed";
}

/** The two answers of each question: keep the user's first. */
export function conflictChoices(kind: ConflictKind) {
  const m = OFFLINE_MESSAGES;
  if (kind === "gone") return { mine: m.recreate, theirs: m.discardMine };
  if (kind === "deleteChanged") {
    return { mine: m.deleteAnyway, theirs: m.keepOthers };
  }
  return { mine: m.keepMine, theirs: m.keepTheirs };
}

/**
 * "Volver a crearlo" sends the change again as a creation, so the server
 * makes it with the same id; null when that is not possible (a deleted note's
 * items are gone with it, so only an event can come back).
 */
export function recreateOf(change: OfflineChange): OfflineChange | null {
  if (change.type === "event.update" || change.type === "event.create") {
    return { type: "event.create", id: change.id, data: change.data };
  }
  return null;
}

const LABELS: Record<string, string> = {
  title: "Título",
  startsAt: "Empieza",
  endsAt: "Termina",
  allDay: "Todo el día",
  location: "Lugar",
  description: "Descripción",
  color: "Color",
  body: "Texto",
  text: "Elemento",
  done: "Hecho",
  dueDate: "Fecha límite",
  pinned: "Fijada",
  archived: "Archivada",
};

function show(key: string, value: unknown, timeZone: string): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Sí" : "No";
  if ((key === "startsAt" || key === "endsAt") && typeof value === "string") {
    return new Intl.DateTimeFormat("es-ES", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone,
    }).format(new Date(value));
  }
  return String(value);
}

/**
 * The fields of the two versions that differ, readable: what the user has to
 * compare. With one version (a refused change), all of its fields.
 */
export function versionRows(
  mine: Fields | null,
  theirs: Fields | null,
  timeZone: string,
): { label: string; mine: string; theirs: string }[] {
  const keys = Object.keys(LABELS).filter(
    (key) => (mine && key in mine) || (theirs && key in theirs),
  );
  return keys
    .filter(
      (key) =>
        !mine ||
        !theirs ||
        show(key, mine[key], timeZone) !== show(key, theirs[key], timeZone),
    )
    .map((key) => ({
      label: LABELS[key]!,
      mine: mine ? show(key, mine[key], timeZone) : "Borrado",
      theirs: theirs ? show(key, theirs[key], timeZone) : "Borrado",
    }));
}
