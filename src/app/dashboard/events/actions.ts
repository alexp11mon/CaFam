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

    const { data, error } = await supabase
      .from("events")
      .insert({ ...toRow(parsed.data), created_by: userId })
      .select("id")
      .single();
    if (error) return failure(error, values);
    id = data.id;
  } catch (error) {
    return failure(error, values);
  }

  refresh();
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
  } catch (error) {
    return failure(error, values);
  }

  refresh();
  redirect(`/dashboard/events/${id}`);
}

// The state argument useActionState passes is not needed: nothing to carry over.
export async function deleteEvent(id: string): Promise<ConfirmState> {
  if (!z.uuid().safeParse(id).success) {
    return { formError: CALENDAR_MESSAGES.notFound };
  }
  const { supabase } = await requireActionUser();

  try {
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
  } catch (error) {
    return { formError: getCalendarErrorMessage(error) };
  }

  refresh();
  redirect("/dashboard");
}
