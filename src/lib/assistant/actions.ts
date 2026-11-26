import {
  addDays,
  formatTime,
  parseDateKey,
  utcDateKey,
  zonedDateKey,
} from "@/lib/calendar/time-zone";
import { weekdayName } from "./dates";
import type { Loss } from "@/lib/forms/form-state";
import type { RecurrenceRule } from "@/lib/recurrence/rule";

// What Venito wrote or proposes in one answer (spec 036, plan "Modelo de
// datos"). Pure and shared by the route, the actions and the chat; the
// browser keeps them only in the conversation.

/** "Solo este evento", "Este y los siguientes", "Todos los eventos" (spec 013). */
export type ChangeScope = "this" | "following" | "all";

/** What a card shows of an event (RF-32). */
export interface ActionEvent {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  allDay: boolean;
  calendarName: string;
  color: string;
  location?: string | null;
}

/** The fields a change writes, and what undoing it writes back. */
export interface ChangeFields {
  title: string;
  description: string | null;
  location: string | null;
  calendarId: string;
  startsAt: string;
  endsAt: string;
  allDay: boolean;
}

/** A change shown but not written until "Confirmar" (RF-24, plan D4). */
export interface PendingChange {
  id: string;
  scope: ChangeScope | null;
  /** updated_at of the row when it was proposed (RF-24d, plan D7). */
  updatedAt: string;
  fields: ChangeFields;
}

/** Spec 052 RF-2: a deletion shown but not done until "Borrar". */
export interface PendingDelete {
  id: string;
  scope: ChangeScope | null;
  /** updated_at of the row (or its series) when it was proposed. */
  updatedAt: string;
}

/** Spec 052 RF-6: a series shown but not created until "Crear". */
export interface PendingSeries {
  calendarId: string;
  title: string;
  description: string | null;
  location: string | null;
  /** Its first occurrence. */
  startsAt: string;
  endsAt: string;
  allDay: boolean;
  rule: RecurrenceRule;
}

/** What a note card shows (spec 048 RF-12). */
export interface ActionNote {
  id: string;
  title: string;
  /** The items written: all of a new list, or the ones added. */
  items: string[];
  calendarName: string | null;
}

export type AssistantUndo =
  /** Spec 052 RF-3: a deletion Venito made, back from the trash (spec 046). */
  | {
      kind: "restore";
      trashId: string;
      guard?: { id: string; updatedAt: string };
      again?: { id: string; scope: ChangeScope };
    }
  /** Spec 052: deletes the series Venito created if nobody changed it. */
  | { kind: "unseries"; id: string; updatedAt: string }
  /**
   * Spec 048: deletes the note Venito created, if nobody changed it, or only
   * the items it added (never anything else of the note).
   */
  | { kind: "unnote"; id: string; updatedAt: string; itemIds?: string[] }
  /** Deletes the event Venito created if nobody changed it (RF-34, RF-36). */
  | { kind: "uncreate"; id: string; updatedAt: string }
  /** Writes the values of before if nobody changed it (RF-35, RF-36). */
  | {
      kind: "unchange";
      id: string;
      updatedAt: string;
      before: ChangeFields;
      series: boolean;
    };

export type AssistantAction =
  | {
      kind: "note";
      key: string;
      note: ActionNote;
      /** Items added to a note that was there; otherwise a new note. */
      added: boolean;
      undo: AssistantUndo;
    }
  | {
      kind: "created";
      key: string;
      event: ActionEvent;
      /** RF-17: the event it was placed after or before. */
      anchor?: {
        title: string;
        startsAt: string;
        endsAt: string;
        allDay: boolean;
      };
      undo: AssistantUndo;
    }
  | {
      kind: "change";
      key: string;
      before: ActionEvent;
      after: ActionEvent;
      scope: ChangeScope | null;
      /** RF-30: what a change to a series would lose. */
      loss?: Loss;
      change: PendingChange;
    }
  /** Spec 052 RF-2: an event Venito proposes to delete. */
  | {
      kind: "delete";
      key: string;
      event: ActionEvent;
      scope: ChangeScope | null;
      loss?: Loss;
      remove: PendingDelete;
    }
  /** Spec 052 RF-6: a series Venito proposes to create. */
  | {
      kind: "series";
      key: string;
      /** Its first occurrence. */
      event: ActionEvent;
      /** The rule in Spanish (spec 013 summary). */
      summary: string;
      /** Starts of the first 3 occurrences. */
      dates: string[];
      series: PendingSeries;
    };

/** Spec 036, 052: cards that wait for "Confirmar", "Borrar" or "Crear". */
export const needsConfirm = (action: AssistantAction) =>
  action.kind === "change" ||
  action.kind === "delete" ||
  action.kind === "series";

/** Where a card is: created ones and changes have their own steps. */
export type ActionStatus =
  | "done"
  | "pending"
  | "applied"
  | "cancelled"
  | "superseded"
  | "undone"
  | "failed";

const MONTHS = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

/** "jueves 19 de noviembre", or "jueves 19" when the month is said later. */
function dayText(key: string, withMonth = true): string {
  const parts = parseDateKey(key)!;
  const head = `${weekdayName(key)} ${parts.day}`;
  return withMonth ? `${head} de ${MONTHS[parts.month - 1]}` : head;
}

const sameMonth = (a: string, b: string) => a.slice(0, 7) === b.slice(0, 7);

/** When an event is, in words; all-day ones by their UTC days (spec 002 D6). */
export function whenText(
  event: Pick<ActionEvent, "startsAt" | "endsAt" | "allDay">,
  timeZone: string,
): string {
  if (event.allDay) {
    const first = utcDateKey(event.startsAt);
    const last = addDays(utcDateKey(event.endsAt), -1);
    if (last <= first) return `${dayText(first)}, todo el día`;
    return `del ${dayText(first, !sameMonth(first, last))} al ${dayText(last)}, todo el día`;
  }
  const first = zonedDateKey(event.startsAt, timeZone);
  const last = zonedDateKey(event.endsAt, timeZone);
  const start = formatTime(event.startsAt, timeZone);
  const end = formatTime(event.endsAt, timeZone);
  if (first === last) return `${dayText(first)}, de ${start} a ${end}`;
  return `del ${dayText(first)} a las ${start} al ${dayText(last)} a las ${end}`;
}

const eventText = (event: ActionEvent, timeZone: string) =>
  `${event.title}, ${whenText(event, timeZone)}`;

type Heads = Record<"created" | "change" | "delete" | "series", string>;

const HEADS: Record<ActionStatus, Heads> = {
  done: {
    created: "Evento creado",
    change: "Cambio aplicado",
    delete: "Evento borrado",
    series: "Serie creada",
  },
  pending: {
    created: "Evento creado",
    change: "Cambio pendiente de confirmar",
    delete: "Borrado pendiente de confirmar",
    series: "Serie pendiente de confirmar",
  },
  applied: {
    created: "Evento creado",
    change: "Cambio aplicado",
    delete: "Evento borrado",
    series: "Serie creada",
  },
  cancelled: {
    created: "Evento creado",
    change: "Cambio cancelado",
    delete: "Borrado cancelado",
    series: "Serie cancelada",
  },
  superseded: {
    created: "Evento creado",
    change: "Cambio sustituido",
    delete: "Borrado sustituido",
    series: "Serie sustituida",
  },
  undone: {
    created: "Evento creado y deshecho",
    change: "Cambio aplicado y deshecho",
    delete: "Evento borrado y restaurado",
    series: "Serie creada y deshecha",
  },
  failed: {
    created: "Evento no creado",
    change: "Cambio no aplicado",
    delete: "Evento no borrado",
    series: "Serie no creada",
  },
};

/**
 * One line about a card: what screen readers hear and what goes back to the
 * model inside Venito's message, so "muévelo a mañana" knows which event
 * (plan D10).
 */
export function describeAction(
  action: AssistantAction,
  timeZone: string,
  status: ActionStatus,
): string {
  if (action.kind === "note") {
    const items = action.note.items.length
      ? `: ${action.note.items.join(", ")}`
      : "";
    const head = action.added
      ? `Añadido a la nota «${action.note.title}»`
      : `Nota creada «${action.note.title}»`;
    const where = action.note.calendarName
      ? `, en ${action.note.calendarName}`
      : "";
    return `[${head}${status === "undone" ? " y deshecho" : ""}${items}${where}]`;
  }
  if (action.kind === "created") {
    return `[${HEADS[status].created}: ${eventText(action.event, timeZone)}, en ${action.event.calendarName}]`;
  }
  if (action.kind === "delete") {
    return `[${HEADS[status].delete}: ${eventText(action.event, timeZone)}, en ${action.event.calendarName}]`;
  }
  if (action.kind === "series") {
    return `[${HEADS[status].series}: ${action.event.title}, ${action.summary}, desde el ${whenText(action.event, timeZone)}, en ${action.event.calendarName}]`;
  }
  return `[${HEADS[status].change}: ${eventText(action.before, timeZone)} → ${eventText(action.after, timeZone)}, en ${action.after.calendarName}]`;
}
