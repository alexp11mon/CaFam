"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { FormAlert } from "@/components/ui/form-alert";
import { LinkButton } from "@/components/ui/link-button";
import { Select } from "@/components/ui/select";
import { TextArea } from "@/components/ui/text-area";
import { TextField } from "@/components/ui/text-field";
import { TimeField } from "@/components/ui/time-field";
import {
  endOptions,
  shiftEnd,
  startOptions,
} from "@/lib/calendar/time-options";
import type { EventFormField, EventFormValues } from "@/lib/calendar/schemas";
import type { FormAction, FormState } from "@/lib/forms/form-state";
import { ColorPicker } from "./color-picker";
import { useEventModal } from "./event-modal";

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
  focusTitle = false,
}: {
  action: FormAction<EventFormState>;
  initial: EventFormValues;
  /** Only calendars where the user can write (RF-27). */
  calendars: CalendarOption[];
  categories: CategoryOption[];
  submitLabel: string;
  pendingLabel: string;
  cancelHref: string;
  /** A new event starts with the cursor in the title (spec 008 RF-28). */
  focusTitle?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, {
    values: initial,
  });
  const modal = useEventModal();
  const errors = state.fieldErrors ?? {};
  // After a success the next opening starts empty: Next shows the same route
  // instance again (Activity) when the same URL is opened later.
  const values = state.done ? initial : state.values;

  // Inside the window a success closes it instead of redirecting (spec 008 RF-8).
  // Effects run again each time Activity shows the route: handle each result once.
  const handled = useRef<EventFormState | null>(null);
  useEffect(() => {
    if (!state.done || handled.current === state) return;
    handled.current = state;
    modal?.finish(state.done);
  }, [state, modal]);

  const [allDay, setAllDay] = useState(values.allDay === "on");
  const [calendarId, setCalendarId] = useState(values.calendarId);
  const [categoryId, setCategoryId] = useState(values.categoryId);
  // The times are controlled: the end follows the start (spec 008 RF-17, RF-18).
  const [startTime, setStartTime] = useState(values.startTime);
  const [endTime, setEndTime] = useState(values.endTime);
  const [endTouched, setEndTouched] = useState(false);
  const [startDate, setStartDate] = useState(values.startDate);
  const [endDate, setEndDate] = useState(values.endDate);

  // The fields are uncontrolled (React resets forms after an action); this state only
  // drives the times and the category list. A server response carries what was
  // submitted: adopt it (React "adjust state on render").
  const [seen, setSeen] = useState(state);
  if (seen !== state) {
    setSeen(state);
    setAllDay(values.allDay === "on");
    setCalendarId(values.calendarId);
    setCategoryId(values.categoryId);
    setStartTime(values.startTime);
    setEndTime(values.endTime);
    setStartDate(values.startDate);
    setEndDate(values.endDate);
  }

  function changeStart(next: string) {
    // Only within one day: across days the duration is not what the list shows.
    if (!endTouched && startDate === endDate) {
      setEndTime(shiftEnd(startTime, next, endTime));
    }
    setStartTime(next);
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
    <form
      action={formAction}
      noValidate
      // Any typing counts as a change the window must not lose silently (spec 008 RF-7).
      onInput={() => modal?.setDirty(true)}
      className="flex flex-col gap-4"
    >
      {modal ? <input type="hidden" name="mode" value="modal" /> : null}
      <FormAlert message={state.formError} />
      <TextField
        label="Título"
        name="title"
        maxLength={100}
        defaultValue={values.title}
        autoFocus={focusTitle}
        // Inside the window the dialog opens after mounting: it focuses this one.
        data-autofocus={focusTitle ? "" : undefined}
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
          onChange={(event) => setStartDate(event.target.value)}
          error={errors.startDate}
        />
        {allDay ? null : (
          <TimeField
            label="Hora de inicio"
            name="startTime"
            value={startTime}
            onValueChange={changeStart}
            options={startOptions()}
            error={errors.startTime}
          />
        )}
        <TextField
          label="Fecha de fin"
          name="endDate"
          type="date"
          defaultValue={values.endDate}
          onChange={(event) => setEndDate(event.target.value)}
          error={errors.endDate}
        />
        {allDay ? null : (
          <TimeField
            label="Hora de fin"
            name="endTime"
            value={endTime}
            onValueChange={(next) => {
              setEndTouched(true);
              setEndTime(next);
            }}
            options={
              startDate === endDate ? endOptions(startTime) : startOptions()
            }
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
        {modal ? (
          <Button variant="secondary" onClick={modal.requestClose}>
            Cancelar
          </Button>
        ) : (
          <LinkButton href={cancelHref} variant="secondary">
            Cancelar
          </LinkButton>
        )}
      </div>
    </form>
  );
}
