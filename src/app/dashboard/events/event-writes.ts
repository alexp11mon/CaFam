import { revalidatePath } from "next/cache";
import {
  CALENDAR_MESSAGES,
  getCalendarErrorMessage,
} from "@/lib/calendar/error-messages";
import {
  canSeeEvent,
  type EventRecord,
  type requireActionUser,
} from "@/lib/calendar/queries";
import type {
  EventData,
  EventFormField,
  EventFormValues,
} from "@/lib/calendar/schemas";
import type { ConfirmState, FormState, Loss } from "@/lib/forms/form-state";
import { IMAGE_MESSAGES } from "@/lib/images/error-messages";
import {
  RECURRENCE_MESSAGES,
  recurrenceErrorMessage,
} from "@/lib/recurrence/error-messages";
import { parseEventId } from "@/lib/recurrence/occurrence-id";
import { findOccurrence } from "@/lib/recurrence/read-series";
import type { RecurrenceRule } from "@/lib/recurrence/rule";
import {
  planSeriesChange,
  planSeriesDelete,
  seriesColumns,
  type LossQuery,
  type SeriesScope,
} from "@/lib/recurrence/series-write";
import { cronSecret } from "@/lib/recurrence/server-secret";
import { writeEngineDeps } from "@/lib/sync/engine";
import { goneDone, type GoneDone } from "@/lib/sync/provider-labels";
import { writeErrorText } from "@/lib/sync/write-errors";
import {
  writeEvent,
  type WriteRequest,
  type WriteResult,
} from "@/lib/sync/write-event";

// The writes shared by the form actions (actions.ts) and the quick ones of
// spec 017 (quick-actions.ts, plan D5). Not a "use server" file: its exports
// must not become endpoints.

export type EventFormState = FormState<EventFormField>;
export type Supabase = Awaited<
  ReturnType<typeof requireActionUser>
>["supabase"];
export type Saved = { id: string } | EventFormState;

const FOREIGN_KEY_CODE = "23503";

export function refresh() {
  // Drop the client router cache: the views must show the change.
  revalidatePath("/dashboard", "layout");
}

export function toRow(data: EventData) {
  return {
    calendar_id: data.calendarId,
    title: data.title,
    description: data.description,
    location: data.location,
    starts_at: data.startsAt,
    ends_at: data.endsAt,
    all_day: data.allDay,
    color: data.color,
    category_id: data.categoryId,
    // Absent: the zone stays as it is (spec 045 RF-11).
    ...(data.startTz === undefined
      ? {}
      : { start_tz: data.startTz, end_tz: data.endTz ?? data.startTz }),
  };
}

// A series keeps its zone in recurrence_tz alone (spec 045 RF-8): start_tz on
// its row would not follow the series functions.
function seriesRow(data: EventData) {
  return { ...toRow(data), start_tz: null, end_tz: null };
}

export function failure(
  error: unknown,
  values: EventFormValues,
): EventFormState {
  // A category of another calendar belongs next to its field (RF-28).
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === FOREIGN_KEY_CODE
  ) {
    return {
      fieldErrors: { categoryId: CALENDAR_MESSAGES.foreignCategory },
      values,
    };
  }
  return { formError: getCalendarErrorMessage(error), values };
}

/**
 * Synced calendars write in Google first (spec 009 plan D3, D4); for normal
 * ones the engine answers "normal" and the action writes as always.
 */
export function syncedWrite(
  supabase: Supabase,
  request: WriteRequest,
): Promise<WriteResult> {
  return writeEvent(request, writeEngineDeps(supabase));
}

/**
 * Creates one single event, in the provider first if the calendar is synced
 * (spec 009). Shared by pasting (spec 017) and the assistant's proposals
 * (spec 022 plan D5). RLS still decides who may write.
 */
export async function createSingle(
  supabase: Supabase,
  userId: string,
  row: ReturnType<typeof toRow>,
  /** Made in the browser for an event created offline: a resend is not a second one (spec 034 D6). */
  id?: string,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const synced = await syncedWrite(supabase, { op: "create", row });
  if (synced.status === "failed") {
    return {
      ok: false,
      error: writeErrorText(synced.failure, synced.provider),
    };
  }
  if (synced.status === "dbError") {
    return { ok: false, error: getCalendarErrorMessage(synced.error) };
  }
  if (synced.status === "done") return { ok: true, id: synced.eventId };
  const { data, error } = await supabase
    .from("events")
    .insert({ ...row, created_by: userId, ...(id ? { id } : {}) })
    .select("id")
    .single();
  if (error) return { ok: false, error: getCalendarErrorMessage(error) };
  return { ok: true, id: data.id };
}

/** The event as it is now: its calendar and what Google gets compared with (RF-14). */
export async function currentEvent(supabase: Supabase, id: string) {
  const { data, error } = await supabase
    .from("events")
    .select(
      "calendar_id, title, description, location, starts_at, ends_at, all_day",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function isSyncedCalendar(
  supabase: Supabase,
  calendarId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("synced_calendars")
    .select("calendar_id")
    .eq("calendar_id", calendarId)
    .maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

export function seriesFailure(
  error: unknown,
  values: EventFormValues,
): EventFormState {
  const message = recurrenceErrorMessage(error);
  return message ? { formError: message, values } : failure(error, values);
}

/** What would be lost and was not confirmed yet (RF-19, RF-24b), or null. */
export async function unconfirmedLoss(
  supabase: Supabase,
  seriesId: string,
  query: LossQuery,
  confirmed: boolean,
): Promise<Loss | null> {
  if (!query || confirmed) return null;
  const { data, error } = await supabase.rpc("series_loss", {
    p_series_id: seriesId,
    ...(query.from ? { p_from: query.from } : {}),
    ...(query.only ? { p_only: query.only } : {}),
  });
  if (error) throw error;
  const row = data?.[0];
  if (!row || row.exceptions + row.images + row.comments === 0) return null;
  return {
    exceptions: row.exceptions,
    images: row.images,
    // Spec 014 plan D6: the comments of those exceptions go too.
    comments: row.comments,
  };
}

/**
 * A change to an occurrence in the chosen scope (RF-15 to RF-19, RF-23,
 * RF-32): the id to show afterwards, or the state to answer.
 */
export async function changeOccurrence(
  supabase: Supabase,
  event: EventRecord & { series: NonNullable<EventRecord["series"]> },
  input: {
    data: EventData;
    values: EventFormValues;
    scope: SeriesScope | null;
    confirmLoss: boolean;
    timeZone: string;
  },
): Promise<Saved> {
  const { data, values, scope, timeZone } = input;
  if (!scope) return { formError: RECURRENCE_MESSAGES.scope, values };
  // A series never goes to a calendar of Google (RF-29).
  if (
    data.calendarId !== event.calendarId &&
    (await isSyncedCalendar(supabase, data.calendarId))
  ) {
    return { fieldErrors: { repeat: RECURRENCE_MESSAGES.synced }, values };
  }
  const plan = planSeriesChange({
    // A zone chosen in the form becomes the series' zone (spec 045 RF-8).
    series: data.startTz
      ? { ...event.series, recurrenceTz: data.startTz }
      : event.series,
    occurrence: event,
    row: toRow(data),
    repeat: values.repeat,
    startDate: values.startDate,
    scope,
    timeZone,
  });
  if (plan.kind === "error") {
    return plan.field
      ? { fieldErrors: { [plan.field]: plan.message }, values }
      : { formError: plan.message, values };
  }
  const loss = await unconfirmedLoss(
    supabase,
    event.series.id,
    plan.loss,
    input.confirmLoss,
  );
  if (loss) return { loss, values };
  // Each function's arguments come from planSeriesChange, tested there.
  const { data: id, error } = await supabase.rpc(plan.fn, plan.args as never);
  if (error) return seriesFailure(error, values);
  return { id: id as string };
}

/** A single event, through Google when its calendar is synced (spec 009 RF-11). */
export async function updateSingle(
  supabase: Supabase,
  event: EventRecord,
  data: EventData,
  values: EventFormValues,
): Promise<Saved | GoneDone> {
  const synced = await syncedWrite(supabase, {
    op: "update",
    eventId: event.id,
    calendarId: event.calendarId,
    before: {
      title: event.title,
      description: event.description,
      location: event.location,
      starts_at: event.startsAt,
      ends_at: event.endsAt,
      all_day: event.allDay,
      start_tz: event.startTz,
      end_tz: event.endTz,
    },
    row: toRow(data),
  });
  if (synced.status === "failed") {
    return {
      formError: writeErrorText(synced.failure, synced.provider),
      values,
    };
  }
  if (synced.status === "dbError") return failure(synced.error, values);
  if (synced.status === "gone") return goneDone(synced.provider);
  if (synced.status === "normal") {
    // Changing calendar is checked by RLS on both sides (RF-27).
    const { data: rows, error } = await supabase
      .from("events")
      .update(toRow(data))
      .eq("id", event.id)
      .select("id");
    if (error) return failure(error, values);
    if (!rows || rows.length === 0) {
      // RLS hides rows without an error (RF-25).
      return {
        formError: (await canSeeEvent(supabase, event.id))
          ? CALENDAR_MESSAGES.forbidden
          : CALENDAR_MESSAGES.notFound,
        values,
      };
    }
  }
  return { id: event.id };
}

/**
 * Deleting occurrences in the chosen scope (spec 013 RF-20), once the images
 * that go with them are confirmed (RF-24b).
 */
export async function deleteOccurrences(
  supabase: Supabase,
  series: NonNullable<EventRecord["series"]>,
  scope: SeriesScope | null,
  confirmLoss: boolean,
): Promise<ConfirmState | null> {
  if (!scope) return { formError: RECURRENCE_MESSAGES.scope };
  const plan = planSeriesDelete(series, scope);
  const loss = await unconfirmedLoss(
    supabase,
    series.id,
    plan.loss,
    confirmLoss,
  );
  if (loss) return { loss };
  // The arguments come from planSeriesDelete, tested there.
  const { error } = await supabase.rpc(
    "delete_occurrences",
    plan.args as never,
  );
  if (error) {
    return {
      formError:
        recurrenceErrorMessage(error) ?? getCalendarErrorMessage(error),
    };
  }
  return null;
}

/** A single event, through Google when its calendar is synced (spec 009 RF-12). */
export async function deleteSingle(
  supabase: Supabase,
  id: string,
  mode: unknown,
): Promise<ConfirmState | null> {
  try {
    const current = await currentEvent(supabase, id);
    if (!current) return { formError: CALENDAR_MESSAGES.notFound };
    const synced = await syncedWrite(supabase, {
      op: "delete",
      eventId: id,
      calendarId: current.calendar_id,
    });
    if (synced.status === "failed") {
      return { formError: writeErrorText(synced.failure, synced.provider) };
    }
    if (synced.status === "dbError") {
      return { formError: getCalendarErrorMessage(synced.error) };
    }
    if (synced.status === "gone") {
      refresh();
      return mode === "modal"
        ? { done: goneDone(synced.provider) }
        : { formError: writeErrorText("gone", synced.provider) };
    }

    if (synced.status === "normal") {
      const { data, error } = await supabase
        .from("events")
        .delete()
        .eq("id", id)
        .select("id");
      if (error) return { formError: getCalendarErrorMessage(error) };
      if (!data || data.length === 0) {
        return {
          formError: (await canSeeEvent(supabase, id))
            ? CALENDAR_MESSAGES.forbidden
            : CALENDAR_MESSAGES.notFound,
        };
      }
    }
  } catch (error) {
    return { formError: getCalendarErrorMessage(error) };
  }
  return null;
}

/**
 * A single event becomes a series (RF-21). With images it stays as the first
 * occurrence of a new series row, which never holds images (plan D7); with
 * comments too (spec 023 RF-12).
 */
export async function convertToSeries(
  supabase: Supabase,
  event: EventRecord,
  input: {
    data: EventData;
    rule: RecurrenceRule;
    timeZone: string;
    values: EventFormValues;
  },
): Promise<Saved> {
  const { data, rule, timeZone, values } = input;
  if (await isSyncedCalendar(supabase, data.calendarId)) {
    return { fieldErrors: { repeat: RECURRENCE_MESSAGES.synced }, values };
  }
  const columns = seriesColumns(data, rule, timeZone);
  if (!columns) {
    return { fieldErrors: { repeat: RECURRENCE_MESSAGES.empty }, values };
  }
  // Images and comments hang from the row of an occurrence, never from the
  // series: with either, the event stays as its first occurrence (spec 023
  // RF-12).
  const [images, comments] = await Promise.all(
    (["event_images", "event_comments"] as const).map((table) =>
      supabase
        .from(table)
        .select("id", { count: "exact", head: true })
        .eq("event_id", event.id),
    ),
  );
  if (images.error) throw images.error;
  if (comments.error) throw comments.error;

  if (!images.count && !comments.count) {
    const { error } = await supabase
      .from("events")
      .update({ ...seriesRow(data), ...columns })
      .eq("id", event.id);
    return error ? seriesFailure(error, values) : { id: event.id };
  }

  const { data: series, error } = await supabase
    .from("events")
    .insert({ ...seriesRow(data), ...columns, created_by: event.createdBy })
    .select("id")
    .single();
  if (error) return seriesFailure(error, values);
  const { error: attachError } = await supabase
    .from("events")
    .update({
      ...toRow(data),
      starts_at: columns.starts_at,
      ends_at: columns.ends_at,
      series_id: series.id,
      original_start: columns.starts_at,
    })
    .eq("id", event.id);
  if (attachError) {
    // Two writes: undo the first so the event is not shown twice.
    await supabase.from("events").delete().eq("id", series.id);
    return seriesFailure(attachError, values);
  }
  return { id: event.id };
}

/**
 * A new series (spec 013 RF-6, RF-8): never in a calendar of Google (RF-29),
 * starting at its first occurrence, with the creator's zone (RF-12).
 */
export async function createSeries(
  supabase: Supabase,
  userId: string,
  input: {
    data: EventData;
    rule: RecurrenceRule;
    timeZone: string;
    values: EventFormValues;
  },
  /** Made in the browser for a series created offline (spec 035 RF-11). */
  id?: string,
): Promise<{ id: string } | EventFormState> {
  const { data, rule, timeZone, values } = input;
  if (await isSyncedCalendar(supabase, data.calendarId)) {
    return { fieldErrors: { repeat: RECURRENCE_MESSAGES.synced }, values };
  }
  const columns = seriesColumns(data, rule, timeZone);
  if (!columns) {
    return { fieldErrors: { repeat: RECURRENCE_MESSAGES.empty }, values };
  }
  const { data: row, error } = await supabase
    .from("events")
    .insert({
      ...seriesRow(data),
      ...columns,
      created_by: userId,
      ...(id ? { id } : {}),
    })
    .select("id")
    .single();
  if (error) return seriesFailure(error, values);
  return { id: row.id };
}

/**
 * The row of an occurrence, created unchanged the first time: a series never
 * holds images or comments, each occurrence keeps its own (spec 013 RF-24,
 * plan D7). Any member may, so it goes through materialize_occurrence with
 * the cron secret once ical.js confirms the occurrence (plan D8).
 */
export async function materializeWith(
  supabase: Supabase,
  occurrenceId: string,
): Promise<{ eventId: string } | { error: string }> {
  const parsed = parseEventId(occurrenceId);
  if (parsed?.kind !== "occurrence") return { error: RECURRENCE_MESSAGES.gone };
  // RLS: only a member reads the series.
  const { data: series, error: readError } = await supabase
    .from("events")
    .select(
      "id, starts_at, ends_at, all_day, recurrence, recurrence_tz, exdates",
    )
    .eq("id", parsed.seriesId)
    .maybeSingle();
  if (readError) return { error: IMAGE_MESSAGES.upload };
  if (!series || !findOccurrence(series, parsed.originalStart)) {
    return { error: RECURRENCE_MESSAGES.gone };
  }
  const { data, error } = await supabase.rpc("materialize_occurrence", {
    p_secret: cronSecret(),
    p_series_id: parsed.seriesId,
    p_original_start: parsed.originalStart,
  });
  if (error) {
    return { error: recurrenceErrorMessage(error) ?? IMAGE_MESSAGES.upload };
  }
  return { eventId: data };
}
