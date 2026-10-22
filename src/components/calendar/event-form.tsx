"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { FormAlert } from "@/components/ui/form-alert";
import { LinkButton } from "@/components/ui/link-button";
import { Select } from "@/components/ui/select";
import { TextArea } from "@/components/ui/text-area";
import { TextField } from "@/components/ui/text-field";
import type { EventFormField, EventFormValues } from "@/lib/calendar/schemas";
import type { FormAction, FormState } from "@/lib/forms/form-state";
import { ColorPicker } from "./color-picker";

export type { EventFormValues };

type EventFormState = FormState<EventFormField>;

export interface CalendarOption {
  id: string;
  name: string;
  color: string;
}

export interface CategoryOption {
  id: string;
  name: string;
  calendarId: string;
}

/** Create / edit form of an event (RF-15..RF-22, RF-27, RF-28). */
export function EventForm({
  action,
  initial,
  calendars,
  categories,
  submitLabel,
  pendingLabel,
  cancelHref,
}: {
  action: FormAction<EventFormState>;
  initial: EventFormValues;
  /** Only calendars where the user can write (RF-27). */
  calendars: CalendarOption[];
  categories: CategoryOption[];
  submitLabel: string;
  pendingLabel: string;
  cancelHref: string;
}) {
  const [state, formAction, pending] = useActionState(action, {
    values: initial,
  });
  const errors = state.fieldErrors ?? {};
  const values = state.values;

  const [allDay, setAllDay] = useState(values.allDay === "on");
  const [calendarId, setCalendarId] = useState(values.calendarId);
  const [categoryId, setCategoryId] = useState(values.categoryId);

  // The fields are uncontrolled (React resets forms after an action); this state only
  // drives the times and the category list. A server response carries what was
  // submitted: adopt it (React "adjust state on render").
  const [seen, setSeen] = useState(state);
  if (seen !== state) {
    setSeen(state);
    setAllDay(values.allDay === "on");
    setCalendarId(values.calendarId);
    setCategoryId(values.categoryId);
  }

  const calendarCategories = categories.filter(
    (category) => category.calendarId === calendarId,
  );

  function changeCalendar(id: string) {
    setCalendarId(id);
    // The category must belong to the chosen calendar (RF-27, RF-28).
    if (!categories.some((c) => c.id === categoryId && c.calendarId === id)) {
      setCategoryId("");
    }
  }

  // noValidate: errors come from the server in Spanish, not from the browser.
  return (
    <form action={formAction} noValidate className="flex flex-col gap-4">
      <FormAlert message={state.formError} />
      <TextField
        label="Título"
        name="title"
        maxLength={100}
        defaultValue={values.title}
        error={errors.title}
      />
      <Select
        label="Calendario"
        name="calendarId"
        defaultValue={values.calendarId}
        onChange={(event) => changeCalendar(event.target.value)}
        error={errors.calendarId}
      >
        {calendars.map((calendar) => (
          <option key={calendar.id} value={calendar.id}>
            {calendar.name}
          </option>
        ))}
      </Select>
      <label className="flex min-h-11 items-center gap-3 text-ink">
        <input
          type="checkbox"
          name="allDay"
          defaultChecked={values.allDay === "on"}
          onChange={(event) => setAllDay(event.target.checked)}
          className="size-5 accent-ink"
        />
        Todo el día
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Fecha de inicio"
          name="startDate"
          type="date"
          defaultValue={values.startDate}
          error={errors.startDate}
        />
        {allDay ? null : (
          <TextField
            label="Hora de inicio"
            name="startTime"
            type="time"
            defaultValue={values.startTime}
            error={errors.startTime}
          />
        )}
        <TextField
          label="Fecha de fin"
          name="endDate"
          type="date"
          defaultValue={values.endDate}
          error={errors.endDate}
        />
        {allDay ? null : (
          <TextField
            label="Hora de fin"
            name="endTime"
            type="time"
            defaultValue={values.endTime}
            error={errors.endTime}
          />
        )}
      </div>
      <TextArea
        label="Descripción"
        name="description"
        maxLength={2000}
        defaultValue={values.description}
        error={errors.description}
      />
      <TextField
        label="Lugar"
        name="location"
        maxLength={200}
        defaultValue={values.location}
        error={errors.location}
      />
      <Select
        label="Categoría"
        name="categoryId"
        // Remounted when the calendar changes so the dropped category shows as empty.
        key={calendarId}
        defaultValue={categoryId}
        onChange={(event) => setCategoryId(event.target.value)}
        error={errors.categoryId}
      >
        <option value="">Sin categoría</option>
        {calendarCategories.map((category) => (
          <option key={category.id} value={category.id}>
            {category.name}
          </option>
        ))}
      </Select>
      <ColorPicker
        name="color"
        defaultValue={values.color}
        emptyLabel="Color del calendario"
        error={errors.color}
      />
      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? pendingLabel : submitLabel}
        </Button>
        <LinkButton href={cancelHref} variant="secondary">
          Cancelar
        </LinkButton>
      </div>
    </form>
  );
}
