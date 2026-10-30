"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  CALENDAR_MESSAGES,
  getCalendarErrorMessage,
} from "@/lib/calendar/error-messages";
import {
  canSeeEvent,
  getProfileTimeZone,
  requireActionUser,
} from "@/lib/calendar/queries";
import {
  parseEventInput,
  type EventData,
  type EventFormField,
  type EventFormValues,
} from "@/lib/calendar/schemas";
import {
  readString,
  type ConfirmState,
  type FormState,
} from "@/lib/forms/form-state";
import { writeEngineDeps } from "@/lib/sync/engine";
import { WRITE_ERRORS } from "@/lib/sync/write-errors";
import {
  writeEvent,
  type WriteRequest,
  type WriteResult,
} from "@/lib/sync/write-event";

type EventFormState = FormState<EventFormField>;

const FOREIGN_KEY_CODE = "23503";

function readEventValues(formData: FormData): EventFormValues {
  return {
    title: readString(formData, "title"),
    calendarId: readString(formData, "calendarId"),
    allDay: formData.get("allDay") === "on" ? "on" : "",
    startDate: readString(formData, "startDate"),
    startTime: readString(formData, "startTime"),
    endDate: readString(formData, "endDate"),
    endTime: readString(formData, "endTime"),
    description: readString(formData, "description"),
    location: readString(formData, "location"),
    color: readString(formData, "color"),
    categoryId: readString(formData, "categoryId"),
  };
}

// Inside the event window the form sends mode=modal: answer with a state so the
// window closes itself and the calendar stays where it was (spec 008 RF-8, plan D2).
function inWindow(formData: FormData): boolean {
  return formData.get("mode") === "modal";
}

function refresh() {
  // Drop the client router cache: the views must show the change.
  revalidatePath("/dashboard", "layout");
}

function toRow(data: EventData) {
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
  };
}

function failure(error: unknown, values: EventFormValues): EventFormState {
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

type Supabase = Awaited<ReturnType<typeof requireActionUser>>["supabase"];

/**
 * Synced calendars write in Google first (spec 009 plan D3, D4); for normal
 * ones the engine answers "normal" and the action writes as always.
 */
function syncedWrite(
  supabase: Supabase,
  request: WriteRequest,
): Promise<WriteResult> {
  return writeEvent(request, writeEngineDeps(supabase));
}

/** The event as it is now: its calendar and what Google gets compared with (RF-14). */
async function currentEvent(supabase: Supabase, id: string) {
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

/** Deleted in Google meanwhile: CaFam already removed it (spec 009 RF-25). */
function gone(formData: FormData, values: EventFormValues): EventFormState {
  refresh();
  if (inWindow(formData)) return { done: "gone", values };
  return { formError: WRITE_ERRORS.gone, values };
}

function parseForm(values: EventFormValues, timeZone: string) {
  return parseEventInput(
    { ...values, allDay: values.allDay === "on" },
    timeZone,
  );
}

export async function createEvent(
  _prevState: EventFormState,
  formData: FormData,
): Promise<EventFormState> {
  const values = readEventValues(formData);
  const { supabase, userId } = await requireActionUser();

  let id: string;
  try {
    // The zone comes from the profile, never from the client (RF-34).
    const parsed = parseForm(
      values,
      await getProfileTimeZone(supabase, userId),
    );
    if (!parsed.ok) return { fieldErrors: parsed.fieldErrors, values };

    const synced = await syncedWrite(supabase, {
      op: "create",
      row: toRow(parsed.data),
    });
    if (synced.status === "failed") {
      return { formError: WRITE_ERRORS[synced.failure], values };
    }
    if (synced.status === "dbError") return failure(synced.error, values);
    if (synced.status === "done") {
      id = synced.eventId;
    } else {
      const { data, error } = await supabase
        .from("events")
        .insert({ ...toRow(parsed.data), created_by: userId })
        .select("id")
        .single();
      if (error) return failure(error, values);
      id = data.id;
    }
  } catch (error) {
    return failure(error, values);
  }

  refresh();
  // With images to upload the form needs the id first (spec 012 RF-7, plan D11).
  if (inWindow(formData) || formData.get("images") === "1") {
    return { done: "created", values, eventId: id };
  }
  redirect(`/dashboard/events/${id}`);
}

export async function updateEvent(
  id: string,
  _prevState: EventFormState,
  formData: FormData,
): Promise<EventFormState> {
  const values = readEventValues(formData);
  if (!z.uuid().safeParse(id).success) {
    return { formError: CALENDAR_MESSAGES.notFound, values };
  }
  const { supabase, userId } = await requireActionUser();

  try {
    const parsed = parseForm(
      values,
      await getProfileTimeZone(supabase, userId),
    );
    if (!parsed.ok) return { fieldErrors: parsed.fieldErrors, values };

    const before = await currentEvent(supabase, id);
    if (!before) return { formError: CALENDAR_MESSAGES.notFound, values };
    const synced = await syncedWrite(supabase, {
      op: "update",
      eventId: id,
      calendarId: before.calendar_id,
      before,
      row: toRow(parsed.data),
    });
    if (synced.status === "failed") {
      return { formError: WRITE_ERRORS[synced.failure], values };
    }
    if (synced.status === "dbError") return failure(synced.error, values);
    if (synced.status === "gone") return gone(formData, values);

    if (synced.status === "normal") {
      // Changing calendar is checked by RLS on both sides (RF-27).
      const { data, error } = await supabase
        .from("events")
        .update(toRow(parsed.data))
        .eq("id", id)
        .select("id");
      if (error) return failure(error, values);
      if (!data || data.length === 0) {
        // RLS hides rows without an error (RF-25).
        return {
          formError: (await canSeeEvent(supabase, id))
            ? CALENDAR_MESSAGES.forbidden
            : CALENDAR_MESSAGES.notFound,
          values,
        };
      }
    }
  } catch (error) {
    return failure(error, values);
  }

  refresh();
  if (inWindow(formData)) return { done: "updated", values };
  redirect(`/dashboard/events/${id}`);
}

// Bound as deleteEvent(id) or deleteEvent(id, "modal"); useActionState then appends
// its state and form data, which are not needed: nothing to carry over.
export async function deleteEvent(
  id: string,
  mode?: unknown,
): Promise<ConfirmState> {
  if (!z.uuid().safeParse(id).success) {
    return { formError: CALENDAR_MESSAGES.notFound };
  }
  const { supabase } = await requireActionUser();

  try {
    const current = await currentEvent(supabase, id);
    if (!current) return { formError: CALENDAR_MESSAGES.notFound };
    const synced = await syncedWrite(supabase, {
      op: "delete",
      eventId: id,
      calendarId: current.calendar_id,
    });
    if (synced.status === "failed") {
      return { formError: WRITE_ERRORS[synced.failure] };
    }
    if (synced.status === "dbError") {
      return { formError: getCalendarErrorMessage(synced.error) };
    }
    if (synced.status === "gone") {
      refresh();
      return mode === "modal"
        ? { done: "gone" }
        : { formError: WRITE_ERRORS.gone };
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

  refresh();
  if (mode === "modal") return { done: "deleted" };
  redirect("/dashboard/calendar");
}
