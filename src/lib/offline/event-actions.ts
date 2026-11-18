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
  Loss,
} from "@/lib/forms/form-state";
import { readString } from "@/lib/forms/form-state";
import { RECURRENCE_MESSAGES } from "@/lib/recurrence/error-messages";
import { resolveRepeat } from "@/lib/recurrence/presets";
import { readOnlyEventText } from "@/lib/sync/read-only";
import { isNetworkError, isOnline } from "./connection";
import {
  deleteOf,
  pasteOf,
  quickChangeOf,
  seriesDeleteOf,
  seriesUpdateOf,
  updateOf,
} from "./describe";
import { canWriteOffline, offlineReadOnly } from "./gates";
import { OFFLINE_MESSAGES } from "./messages";
import type { OfflineChange, SeriesScope } from "./outbox";
import { pendingEvents } from "./overlay";
import { lossInCopy } from "./series-loss";
import type { OfflineEvent, OfflineSeries } from "./snapshot";
import { findEvent, getSnapshot } from "./snapshot-store";
import { getQueueState } from "./queue-store";
import { isQueued, withOutbox, type Queued } from "./with-outbox";

/**
 * Why the copy cannot take this write offline, or null: the rules of always,
 * Google and iCloud included (spec 035 RF-1, RF-2).
 */
function blockedIn(calendarId: string): string | null {
  const calendar = getSnapshot()?.calendars.find((c) => c.id === calendarId);
  if (!calendar) return OFFLINE_MESSAGES.needsNetwork;
  if (canWriteOffline(calendar)) return null;
  const reason = offlineReadOnly(calendar);
  return reason && calendar.synced
    ? readOnlyEventText(reason, calendar.synced.provider)
    : OFFLINE_MESSAGES.needsNetwork;
}

/** The change goes to the queue rather than to the server (spec 034 RF-40). */
const willQueue = () => !isOnline() || getQueueState().queue.length > 0;

/** An occurrence changed in "Este y los siguientes" or "Todos" (spec 035 RF-10). */
function seriesTarget(
  id: string,
  scope: string | undefined,
): { event: OfflineEvent; series: OfflineSeries; scope: SeriesScope } | null {
  if (scope !== "following" && scope !== "all") return null;
  const event = findEvent(id);
  if (!event?.seriesId || blockedIn(event.calendarId)) return null;
  const series = getSnapshot()?.series.find((s) => s.id === event.seriesId);
  return series ? { event, series, scope } : null;
}

/**
 * What a series change would lose, counted in the copy, to confirm first as
 * with a connection (spec 035 RF-13). Null when nothing is lost.
 */
async function lossOf(
  change: OfflineChange,
  seriesId: string,
): Promise<Loss | null> {
  const copy = getSnapshot();
  if (!copy) return null;
  // ical.js only when a series change is made offline (plan R5).
  const { seriesLossQuery } = await import("./series-overlay");
  const query = seriesLossQuery(
    {
      events: pendingEvents(copy.events, getQueueState().queue),
      series: copy.series,
      exceptions: copy.exceptions,
      timeZone: copy.profile.timeZone,
    },
    change,
  );
  return query === undefined ? null : lossInCopy(seriesId, query, copy);
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
  const target = seriesTarget(id, options.scope);
  const event = writable(id, options.scope);
  let queued = event ? quickChangeOf(event, change) : null;
  if (target) {
    const moved = quickChangeOf(target.event, change);
    if (moved.type !== "event.update") return quickFailure("");
    queued = seriesUpdateOf(id, target.series, target.scope, moved.data);
    if (willQueue() && !options.confirmLoss) {
      const loss = await lossOf(queued, target.series.id);
      if (loss) return { ok: false, error: "", loss };
    }
  }
  return quick(
    id,
    await run(() => quickChange(id, change, options), queued, quickFailure),
  );
}

export async function deleteOrQueue(
  id: string,
  options: ScopeOptions = {},
): Promise<QuickResult> {
  const target = seriesTarget(id, options.scope);
  const event = writable(id, options.scope);
  const change = target
    ? seriesDeleteOf(id, target.series, target.scope)
    : event
      ? deleteOf(event)
      : null;
  if (target && change && willQueue() && !options.confirmLoss) {
    const loss = await lossOf(change, target.series.id);
    if (loss) return { ok: false, error: "", loss };
  }
  return quick(
    id,
    await run(() => deleteForUndo(id, options), change, quickFailure),
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
    const scope = readString(formData, "scope") || undefined;
    const target = seriesTarget(id, scope);
    const event = writable(id, scope);
    const change = target
      ? seriesDeleteOf(id, target.series, target.scope)
      : event
        ? deleteOf(event)
        : null;
    if (target && change && willQueue() && !formData.get("confirmLoss")) {
      const loss = await lossOf(change, target.series.id);
      if (loss) return { loss };
    }
    const result = await run(
      () => action(state, formData),
      change,
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
    if (timeZone) {
      const parsed = parseEventInput(
        { ...values, allDay: values.allDay === "on" },
        timeZone,
      );
      // Offline the errors are said here, as the server would (RF-19).
      if (!parsed.ok && !isOnline()) {
        return { fieldErrors: parsed.fieldErrors, values };
      }
      // "Repetir" works offline too (spec 035 RF-11).
      const repeatOk = resolveRepeat(values.repeat, values.startDate).ok;
      if (!repeatOk && !isOnline()) {
        return {
          fieldErrors: { repeat: RECURRENCE_MESSAGES.invalid },
          values,
        };
      }
      const blocked = parsed.ok ? blockedIn(parsed.data.calendarId) : null;
      if (blocked && !isOnline()) return { formError: blocked, values };
      const repeat = values.repeat === "none" ? {} : { repeat: values.repeat };
      if (parsed.ok && repeatOk && !blocked) {
        const scope = readString(formData, "scope") || undefined;
        const target = eventId ? seriesTarget(eventId, scope) : null;
        if (!eventId) {
          change = {
            type: "event.create",
            id: crypto.randomUUID(),
            data: parsed.data,
            ...repeat,
          };
        } else if (target) {
          change = seriesUpdateOf(
            eventId,
            target.series,
            target.scope,
            parsed.data,
            values.repeat,
          );
          if (willQueue() && !formData.get("confirmLoss")) {
            const loss = await lossOf(change, target.series.id);
            if (loss) return { loss, values };
          }
        } else {
          const event = writable(eventId, scope);
          // An occurrence alone keeps its series: no rule of its own.
          if (event) {
            const update = updateOf(event, parsed.data);
            change = event.seriesId ? update : { ...update, ...repeat };
          }
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
