// The writes of events as the screen calls them, queued when there is no
// network (spec 034 RF-19 to RF-23, RF-30, plan D4, D17). With a connection
// they are the server actions of always.
import {
  deleteForUndo,
  pasteEvent,
  quickChange,
} from "@/app/dashboard/events/quick-actions";
import type {
  QuickResult,
  ScopeOptions,
} from "@/app/dashboard/events/quick-writes";
import { parseEventInput, type EventFormValues } from "@/lib/calendar/schemas";
import type { Change } from "@/lib/calendar/undo";
import type {
  ConfirmState,
  FormAction,
  FormState,
} from "@/lib/forms/form-state";
import { readString } from "@/lib/forms/form-state";
import { isNetworkError, isOnline } from "./connection";
import { deleteOf, pasteOf, quickChangeOf, updateOf } from "./describe";
import { OFFLINE_MESSAGES } from "./messages";
import type { OfflineChange } from "./outbox";
import type { OfflineEvent } from "./snapshot";
import { findEvent, getSnapshot } from "./snapshot-store";
import { isQueued, withOutbox, type Queued } from "./with-outbox";

/** Why the copy cannot take this write offline, or null (RF-19, RF-25). */
function blockedIn(calendarId: string): string | null {
  const calendar = getSnapshot()?.calendars.find((c) => c.id === calendarId);
  if (!calendar || calendar.role === "viewer")
    return OFFLINE_MESSAGES.needsNetwork;
  if (calendar.synced) {
    return OFFLINE_MESSAGES.readOnly(
      calendar.synced.provider === "icloud" ? "icloud" : "google",
    );
  }
  return null;
}

/** An event of the copy this write may change offline (an occurrence only alone, RF-23). */
function writable(id: string, scope?: string): OfflineEvent | null {
  const event = findEvent(id);
  if (!event || blockedIn(event.calendarId)) return null;
  if (event.seriesId && scope !== "this") return null;
  return event;
}

/** The write, queued offline; a write that needs the network says so (RF-17). */
async function run<R>(
  write: () => Promise<R>,
  change: OfflineChange | null,
  needsNetwork: (reason: string) => R,
): Promise<R | Queued> {
  if (!change && !isOnline())
    return needsNetwork(OFFLINE_MESSAGES.needsNetwork);
  try {
    return await withOutbox(write, change);
  } catch (error) {
    if (isNetworkError(error))
      return needsNetwork(OFFLINE_MESSAGES.needsNetwork);
    throw error;
  }
}

const quickFailure = (error: string): QuickResult => ({ ok: false, error });

function quick(id: string, result: QuickResult | Queued): QuickResult {
  return isQueued(result) ? { ok: true, id, undo: result.undo } : result;
}

export async function quickChangeOrQueue(
  id: string,
  change: Change,
  options: ScopeOptions = {},
): Promise<QuickResult> {
  const event = writable(id, options.scope);
  return quick(
    id,
    await run(
      () => quickChange(id, change, options),
      event ? quickChangeOf(event, change) : null,
      quickFailure,
    ),
  );
}

export async function deleteOrQueue(
  id: string,
  options: ScopeOptions = {},
): Promise<QuickResult> {
  const event = writable(id, options.scope);
  return quick(
    id,
    await run(
      () => deleteForUndo(id, options),
      event ? deleteOf(event) : null,
      quickFailure,
    ),
  );
}

export async function pasteOrQueue(
  sourceId: string,
  place: { day: string; minute?: number },
): Promise<QuickResult> {
  const event = findEvent(sourceId);
  const timeZone = getSnapshot()?.profile.timeZone;
  const id = crypto.randomUUID();
  const change =
    event && timeZone && !blockedIn(event.calendarId)
      ? pasteOf(event, place, timeZone, id)
      : null;
  return quick(
    id,
    await run(() => pasteEvent(sourceId, place), change, quickFailure),
  );
}

/** "Borrar evento" of the detail (spec 017 RF-25), queued offline. */
export function deleteFromDetailOrQueue(
  id: string,
  action: (state: ConfirmState, formData: FormData) => Promise<ConfirmState>,
): (state: ConfirmState, formData: FormData) => Promise<ConfirmState> {
  return async (state, formData) => {
    const event = writable(id, readString(formData, "scope") || undefined);
    const result = await run(
      () => action(state, formData),
      event ? deleteOf(event) : null,
      (formError): ConfirmState => ({ formError }),
    );
    return isQueued(result) ? { done: "deleted", undo: result.undo } : result;
  };
}

type EventFormState = FormState<keyof EventFormValues>;

const FIELDS: (keyof EventFormValues)[] = [
  "title",
  "calendarId",
  "startDate",
  "startTime",
  "endDate",
  "endTime",
  "description",
  "location",
  "color",
  "categoryId",
];

function readValues(formData: FormData): EventFormValues {
  const values = Object.fromEntries(
    FIELDS.map((field) => [field, readString(formData, field)]),
  ) as EventFormValues;
  values.allDay = formData.get("allDay") === "on" ? "on" : "";
  values.repeat = readString(formData, "repeat") || "none";
  return values;
}

/**
 * The event form and the quick window (spec 034 plan D17): offline they
 * validate here with the same schema and answer `{ done }` like the window.
 * `eventId` is the event being edited; none creates one.
 */
export function eventFormOrQueue(
  action: FormAction<EventFormState>,
  eventId?: string,
): FormAction<EventFormState> {
  return async (state, formData) => {
    const values = readValues(formData);
    const timeZone = getSnapshot()?.profile.timeZone;
    let change: OfflineChange | null = null;
    if (timeZone && values.repeat === "none") {
      const parsed = parseEventInput(
        { ...values, allDay: values.allDay === "on" },
        timeZone,
      );
      // Offline the errors are said here, as the server would (RF-19).
      if (!parsed.ok && !isOnline()) {
        return { fieldErrors: parsed.fieldErrors, values };
      }
      const blocked = parsed.ok ? blockedIn(parsed.data.calendarId) : null;
      if (blocked && !isOnline()) return { formError: blocked, values };
      if (parsed.ok && !blocked) {
        if (!eventId) {
          change = {
            type: "event.create",
            id: crypto.randomUUID(),
            data: parsed.data,
          };
        } else {
          const event = writable(
            eventId,
            readString(formData, "scope") || undefined,
          );
          if (event) change = updateOf(event, parsed.data);
        }
      }
    }
    const result = await run(
      () => action(state, formData),
      change,
      (formError): EventFormState => ({ formError, values }),
    );
    if (!isQueued(result)) return result;
    return {
      values,
      done: eventId ? "updated" : "created",
      undo: result.undo,
    };
  };
}
