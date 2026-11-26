"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { RepeatField } from "@/components/recurrence/repeat-field";
import { SeriesScopeDialog } from "@/components/recurrence/series-scope-dialog";
import { ImagePicker } from "@/components/images/image-picker";
import { UploadList } from "@/components/images/upload-list";
import { useImageUploads } from "@/components/images/use-image-uploads";
import { Button } from "@/components/ui/button";
import { FormAlert } from "@/components/ui/form-alert";
import { LinkButton } from "@/components/ui/link-button";
import { Select } from "@/components/ui/select";
import { TextArea } from "@/components/ui/text-area";
import { TextField } from "@/components/ui/text-field";
import { TimeField } from "@/components/ui/time-field";
import { TimeZoneField } from "./time-zone-field";
import {
  endOptions,
  shiftEnd,
  startOptions,
} from "@/lib/calendar/time-options";
import type { EventFormField, EventFormValues } from "@/lib/calendar/schemas";
import type { FormAction, FormState } from "@/lib/forms/form-state";
import { eventFormOrQueue } from "@/lib/offline/event-actions";
import { loadPage } from "@/lib/offline/navigate";
import { RECURRENCE_MESSAGES } from "@/lib/recurrence/error-messages";
import type { SeriesScope } from "@/lib/recurrence/series-write";
import { ColorPicker } from "./color-picker";
import { ReminderField, type ReminderDefaults } from "./reminder-field";
import { fillField, NlField, type ResolvedEvent } from "./nl-field";
import { useEventModal } from "./event-modal";
import { SwapLabel } from "@/components/ui/swap-label";
import { useT } from "@/components/i18n/locale-provider";

export type { EventFormValues };

type EventFormState = FormState<EventFormField>;

export interface CalendarOption {
  id: string;
  name: string;
  color: string;
  /** Brought from Google: no series there (spec 013 RF-29). */
  synced?: boolean;
}

export interface CategoryOption {
  id: string;
  name: string;
  calendarId: string;
}

// The form leaves after uploading: nothing to refresh in place.
const NOTHING = () => {};

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
  withImages = false,
  series,
  eventId,
  reminders,
  phrase,
  timeZone,
}: {
  /** The profile's zone: offers "Zona horaria" (spec 045 RF-1); none in tests. */
  timeZone?: string;
  /** Creating: "Escribe el evento" above the title (spec 041 RF-11), with shared text (spec 047 RF-8). */
  phrase?: { timeZone: string; defaultMinutes: number; text?: string };
  /** The user's own reminders: the current ones or the defaults (spec 040 RF-5, RF-6). */
  reminders?: { initial?: number[]; defaults?: ReminderDefaults };
  action: FormAction<EventFormState>;
  /** The event being edited, to queue the change offline (spec 034 RF-20). */
  eventId?: string;
  initial: EventFormValues;
  /** Only calendars where the user can write (RF-27). */
  calendars: CalendarOption[];
  categories: CategoryOption[];
  submitLabel: string;
  pendingLabel: string;
  cancelHref: string;
  /** A new event starts with the cursor in the title (spec 008 RF-28). */
  focusTitle?: boolean;
  /** Creating offers images, uploaded once the event exists (spec 012 RF-7). */
  withImages?: boolean;
  /** Editing an occurrence: saving asks the scope first (spec 013 RF-15, RF-32). */
  series?: { limitReached: boolean };
}) {
  const t = useT();
  // Offline it waits on the device (spec 034 plan D17).
  const [queued] = useState(() => eventFormOrQueue(action, eventId));
  const [state, formAction, pending] = useActionState(queued, {
    values: initial,
  });
  const modal = useEventModal();
  const errors = state.fieldErrors ?? {};
  // After a success the next opening starts empty: Next shows the same route
  // instance again (Activity) when the same URL is opened later.
  const values = state.done ? initial : state.values;

  // Inside the window a success closes it instead of redirecting (spec 008 RF-8).
  // Effects run again each time Activity shows the route: handle each result once.
  const uploads = useImageUploads(NOTHING);
  const { upload } = uploads;
  // The event saved with images still to upload (spec 012 RF-7, plan D11).
  const savedId = state.done === "created" ? state.eventId : undefined;
  const [uploadedFor, setUploadedFor] = useState<string>();
  const handled = useRef<EventFormState | null>(null);
  const left = useRef<string | null>(null);

  function leave(id: string) {
    if (left.current === id) return;
    left.current = id;
    if (modal) modal.finish("created");
    // A soft navigation would be intercepted by @modal: land on the full page,
    // like the redirect of createEvent does.
    else window.location.assign(`/dashboard/events/${id}`);
  }

  useEffect(() => {
    if (!state.done || handled.current === state) return;
    handled.current = state;
    if (!state.eventId) {
      if (modal) return modal.finish(state.done, state.undo);
      // A full page saved offline goes back to the calendar (spec 034 RF-19).
      if (state.undo) loadPage("/dashboard/calendar");
      return;
    }
    const id = state.eventId;
    void upload(id).then(() => setUploadedFor(id));
  }, [state, modal, upload]);

  // Once uploaded, go on unless an image failed: those stay to retry (RF-24).
  const failed = uploads.items.length > 0;
  useEffect(() => {
    if (savedId && uploadedFor === savedId && !failed) leave(savedId);
  });

  const [allDay, setAllDay] = useState(values.allDay === "on");
  const [calendarId, setCalendarId] = useState(values.calendarId);
  const [categoryId, setCategoryId] = useState(values.categoryId);
  // The times are controlled: the end follows the start (spec 008 RF-17, RF-18).
  const [startTime, setStartTime] = useState(values.startTime);
  const [endTime, setEndTime] = useState(values.endTime);
  const [endTouched, setEndTouched] = useState(false);
  const [startDate, setStartDate] = useState(values.startDate);
  const [endDate, setEndDate] = useState(values.endDate);
  // The scope dialog: open while choosing or confirming losses (spec 013 RF-19).
  const [asking, setAsking] = useState(false);
  const [scope, setScope] = useState<SeriesScope | null>(null);
  const [dismissed, setDismissed] = useState<EventFormState | null>(null);
  const [repeat, setRepeat] = useState(values.repeat);
  const form = useRef<HTMLFormElement>(null);
  // Fields changed by hand are never overwritten by a phrase (spec 041 RF-12).
  const touched = useRef(new Set<string>());
  const applying = useRef(false);

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
    setRepeat(values.repeat);
    // Losses keep the dialog open to confirm; any other answer closes it.
    setAsking(Boolean(state.loss));
  }

  function changeStart(next: string) {
    // Only within one day: across days the duration is not what the list shows.
    if (!endTouched && startDate === endDate) {
      setEndTime(shiftEnd(startTime, next, endTime));
    }
    setStartTime(next);
  }

  function applyPhrase(event: ResolvedEvent) {
    const element = form.current;
    if (!element) return;
    const free = (name: string) => !touched.current.has(name);
    applying.current = true;
    try {
      if (event.title && free("title"))
        fillField(element, "title", event.title);
      if (event.calendarId && free("calendarId")) {
        fillField(element, "calendarId", event.calendarId);
      }
      if (free("allDay"))
        fillField(element, "allDay", event.allDay ? "on" : "");
      if (free("startDate")) fillField(element, "startDate", event.startDate);
      if (free("endDate")) fillField(element, "endDate", event.endDate);
      if (!event.allDay && free("startTime")) setStartTime(event.startTime);
      if (!event.allDay && free("endTime")) setEndTime(event.endTime);
      if (event.location && free("location")) {
        fillField(element, "location", event.location);
      }
      if (event.repeat && free("repeat-choice")) setRepeat(event.repeat);
    } finally {
      applying.current = false;
    }
    modal?.setDirty(true);
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

  if (savedId) {
    return (
      <div className="flex flex-col gap-4">
        <p role="status" className="text-ink">
          {uploadedFor === savedId && failed
            ? t("El evento se ha guardado, pero alguna imagen no se ha subido.")
            : t("Evento guardado. Subiendo imágenes…")}
        </p>
        <UploadList
          items={uploads.items}
          notice={uploads.notice}
          onCancel={uploads.remove}
          onRetry={uploads.retry}
        />
        {uploadedFor === savedId && failed ? (
          <Button
            variant="secondary"
            onClick={() => leave(savedId)}
            className="self-start"
          >
            {t("Continuar sin ellas")}
          </Button>
        ) : null}
      </div>
    );
  }

  // noValidate: errors come from the server in Spanish, not from the browser.
  return (
    <form
      ref={form}
      action={formAction}
      noValidate
      // Any typing counts as a change the window must not lose silently (spec 008 RF-7).
      onInput={() => modal?.setDirty(true)}
      onChange={(event) => {
        const name = (event.target as Element).getAttribute("name");
        if (name && !applying.current) touched.current.add(name);
      }}
      onSubmit={(event) => {
        // An occurrence is saved from the scope dialog, never straight away.
        const submitter = (event.nativeEvent as SubmitEvent).submitter;
        if (series && submitter?.getAttribute("name") !== "scope") {
          event.preventDefault();
          setAsking(true);
        }
      }}
      className="flex flex-col gap-4"
    >
      {modal ? <input type="hidden" name="mode" value="modal" /> : null}
      <FormAlert message={state.formError} />
      {phrase ? (
        <NlField
          timeZone={phrase.timeZone}
          defaultMinutes={phrase.defaultMinutes}
          calendars={calendars}
          fallback={{ date: startDate, startTime }}
          onApply={applyPhrase}
          autoFocus={focusTitle}
          defaultText={phrase.text}
        />
      ) : null}
      <TextField
        label={t("Título")}
        name="title"
        maxLength={100}
        defaultValue={values.title}
        // With a phrase field the cursor starts there instead (spec 041 RF-13).
        autoFocus={focusTitle && !phrase}
        // Inside the window the dialog opens after mounting: it focuses this one.
        data-autofocus={focusTitle && !phrase ? "" : undefined}
        error={errors.title}
      />
      <Select
        label={t("Calendario")}
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
        {t("Todo el día")}
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label={t("Fecha de inicio")}
          name="startDate"
          type="date"
          defaultValue={values.startDate}
          onChange={(event) => setStartDate(event.target.value)}
          error={errors.startDate}
        />
        {allDay ? null : (
          <TimeField
            label={t("Hora de inicio")}
            name="startTime"
            value={startTime}
            onValueChange={changeStart}
            options={startOptions()}
            error={errors.startTime}
          />
        )}
        <TextField
          label={t("Fecha de fin")}
          name="endDate"
          type="date"
          defaultValue={values.endDate}
          onChange={(event) => setEndDate(event.target.value)}
          error={errors.endDate}
        />
        {allDay ? null : (
          <TimeField
            label={t("Hora de fin")}
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
      {allDay || !timeZone ? null : (
        <TimeZoneField
          profileZone={timeZone}
          initialStart={values.startTz}
          initialEnd={values.endTz}
        />
      )}
      <RepeatField
        startDate={startDate}
        allDay={allDay}
        defaultValue={repeat}
        disabledReason={
          calendars.find((c) => c.id === calendarId)?.synced
            ? RECURRENCE_MESSAGES.synced
            : undefined
        }
        error={errors.repeat}
      />
      {reminders ? (
        <ReminderField
          allDay={allDay}
          initial={reminders.initial}
          defaults={reminders.defaults}
        />
      ) : null}
      <TextArea
        label={t("Descripción")}
        name="description"
        maxLength={2000}
        defaultValue={values.description}
        error={errors.description}
      />
      <TextField
        label={t("Lugar")}
        name="location"
        maxLength={200}
        defaultValue={values.location}
        error={errors.location}
      />
      <Select
        label={t("Categoría")}
        name="categoryId"
        // Remounted when the calendar changes so the dropped category shows as empty.
        key={calendarId}
        defaultValue={categoryId}
        onChange={(event) => setCategoryId(event.target.value)}
        error={errors.categoryId}
      >
        <option value="">{t("Sin categoría")}</option>
        {calendarCategories.map((category) => (
          <option key={category.id} value={category.id}>
            {category.name}
          </option>
        ))}
      </Select>
      <ColorPicker
        name="color"
        defaultValue={values.color}
        emptyLabel={t("Color del calendario")}
        error={errors.color}
      />
      {withImages ? (
        <section aria-label={t("Imágenes")} className="flex flex-col gap-2">
          {uploads.items.length > 0 ? (
            <input type="hidden" name="images" value="1" />
          ) : null}
          <ImagePicker onPick={(files) => void uploads.add(files)} />
          <UploadList
            items={uploads.items}
            notice={uploads.notice}
            onCancel={uploads.remove}
            onRetry={uploads.retry}
          />
        </section>
      ) : null}
      <div className="flex flex-wrap gap-3">
        <Button
          type="submit"
          disabled={
            pending || uploads.items.some((item) => item.status === "preparing")
          }
        >
          <SwapLabel
            busy={pending}
            idle={submitLabel}
            busyText={pendingLabel}
          />
        </Button>
        {series ? (
          <SeriesScopeDialog
            open={asking}
            verb="save"
            allowThis={calendarId === initial.calendarId}
            limitReached={series.limitReached}
            loss={dismissed === state ? null : (state.loss ?? null)}
            scope={scope}
            pending={pending}
            onChoose={setScope}
            onCancel={() => {
              setAsking(false);
              setDismissed(state);
            }}
          />
        ) : null}
        {modal ? (
          <Button variant="secondary" onClick={modal.requestClose}>
            {t("Cancelar")}
          </Button>
        ) : (
          <LinkButton href={cancelHref} variant="secondary">
            {t("Cancelar")}
          </LinkButton>
        )}
      </div>
    </form>
  );
}
