"use client";

import { useRouter } from "next/navigation";
import {
  useActionState,
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { Button } from "@/components/ui/button";
import { FormAlert } from "@/components/ui/form-alert";
import { Select } from "@/components/ui/select";
import { TextField } from "@/components/ui/text-field";
import { TimeField } from "@/components/ui/time-field";
import { useToast } from "@/components/ui/toast";
import type { Draft } from "@/lib/calendar/draft";
import { formatDayHeading } from "@/lib/calendar/format";
import { placePopover, type Box } from "@/lib/calendar/popover";
import {
  endOptions,
  fromMinutes,
  shiftEnd,
  startOptions,
} from "@/lib/calendar/time-options";
import type { FormAction, FormState } from "@/lib/forms/form-state";
import type { CalendarOption, EventFormValues } from "./event-form";

type State = FormState<keyof EventFormValues>;

// Size used to place the window beside the slot; the CSS keeps it in this box.
const SIZE = { width: 384, height: 380 };

/**
 * Quick window next to the chosen slot: title, day and hours, calendar,
 * "Más opciones" and "Guardar" (spec 008 RF-37..RF-39, RF-41, plan D3, D4).
 * It is client state of the calendar, not a route.
 */
export function QuickCreate({
  draft,
  anchor,
  calendars,
  defaultCalendarId,
  action,
  onClose,
  onTitleChange,
}: {
  draft: Draft;
  /** The slot on screen, to sit beside it. */
  anchor: Box | null;
  /** Only calendars where the user can write (RF-27). */
  calendars: CalendarOption[];
  defaultCalendarId: string;
  action: FormAction<State>;
  onClose: () => void;
  /** The provisional block shows what is typed (RF-40). */
  onTitleChange: (title: string) => void;
}) {
  const router = useRouter();
  const { show } = useToast();
  const dialog = useRef<HTMLDialogElement>(null);
  const headingId = useId();
  const [state, formAction, pending] = useActionState(action, {
    values: {} as State["values"],
  });
  const [title, setTitle] = useState("");
  const [allDay, setAllDay] = useState(draft.allDay);
  const [start, setStart] = useState(fromMinutes(draft.startMinute));
  const [end, setEnd] = useState(fromMinutes(draft.endMinute));
  const [endTouched, setEndTouched] = useState(false);
  const [calendarId, setCalendarId] = useState(defaultCalendarId);
  const errors = state.fieldErrors ?? {};

  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    // showModal focuses the first control; the title is wanted (RF-28).
    element?.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    return () => element?.close();
  }, []);

  // Saved: close, refresh the calendar and say so (RF-38, RF-32). Once per result.
  const handled = useRef<State | null>(null);
  useEffect(() => {
    if (!state.done || handled.current === state) return;
    handled.current = state;
    show("Evento creado");
    router.refresh();
    onClose();
  }, [state, show, router, onClose]);

  function moreOptions() {
    // Everything typed goes to the full form (RF-39, plan D4).
    const query = new URLSearchParams({ date: draft.day });
    if (allDay) {
      query.set("allDay", "1");
    } else {
      query.set("start", start);
      query.set("end", end);
    }
    query.set("calendar", calendarId);
    if (title) query.set("title", title);
    onClose();
    router.push(`/dashboard/events/new?${query.toString()}`);
  }

  const place = anchor
    ? placePopover(anchor, SIZE, {
        width: window.innerWidth,
        height: window.innerHeight,
      })
    : null;
  const color = calendars.find((c) => c.id === calendarId)?.color;

  return (
    <dialog
      ref={dialog}
      aria-labelledby={headingId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      // A click on the backdrop lands on the dialog itself: close, as Google does.
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      style={
        place
          ? ({
              "--quick-left": `${place.left}px`,
              "--quick-top": `${place.top}px`,
            } as CSSProperties)
          : undefined
      }
      // Up to 768 px it is a sheet anchored to the bottom (RF-41).
      className={`max-h-[calc(100dvh-2rem)] w-96 overflow-y-auto rounded-3xl bg-paper p-0 text-ink shadow-float backdrop:bg-scrim/10 ${place ? "m-0 left-(--quick-left) top-(--quick-top)" : "m-auto"} max-[48.0625rem]:inset-x-0 max-[48.0625rem]:top-auto max-[48.0625rem]:bottom-0 max-[48.0625rem]:m-0 max-[48.0625rem]:w-full max-[48.0625rem]:max-w-none max-[48.0625rem]:rounded-b-none`}
    >
      <form action={formAction} noValidate className="flex flex-col gap-4 p-5">
        <h2 id={headingId} className="sr-only">
          Nuevo evento
        </h2>
        <input type="hidden" name="mode" value="modal" />
        <input type="hidden" name="startDate" value={draft.day} />
        <input type="hidden" name="endDate" value={draft.day} />
        {allDay ? <input type="hidden" name="allDay" value="on" /> : null}
        <FormAlert message={state.formError} />
        <TextField
          label="Título"
          name="title"
          maxLength={100}
          value={title}
          onChange={(event) => {
            setTitle(event.target.value);
            onTitleChange(event.target.value);
          }}
          data-autofocus=""
          error={errors.title}
        />
        <div className="flex flex-col gap-2">
          <p className="font-semibold first-letter:uppercase">
            {formatDayHeading(draft.day)}
          </p>
          {allDay ? (
            <div className="flex items-center justify-between gap-3">
              <p className="text-muted">Todo el día</p>
              <Button
                variant="secondary"
                onClick={() => {
                  setAllDay(false);
                  setStart("09:00");
                  setEnd("10:00");
                }}
              >
                Añadir hora
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <TimeField
                label="Hora de inicio"
                name="startTime"
                value={start}
                onValueChange={(next) => {
                  if (!endTouched) setEnd(shiftEnd(start, next, end));
                  setStart(next);
                }}
                options={startOptions()}
                error={errors.startTime}
              />
              <TimeField
                label="Hora de fin"
                name="endTime"
                value={end}
                onValueChange={(next) => {
                  setEndTouched(true);
                  setEnd(next);
                }}
                options={endOptions(start)}
                error={errors.endTime}
              />
            </div>
          )}
          {errors.startDate || errors.endDate ? (
            <p className="text-sm text-danger">
              {errors.startDate ?? errors.endDate}
            </p>
          ) : null}
        </div>
        <div className="flex items-end gap-3">
          <span
            aria-hidden="true"
            className="mb-4 size-3 shrink-0 rounded-full ring-1 ring-pastel-ink/15"
            style={{ backgroundColor: color }}
          />
          <div className="min-w-0 flex-1">
            <Select
              label="Calendario"
              name="calendarId"
              value={calendarId}
              onChange={(event) => setCalendarId(event.target.value)}
              error={errors.calendarId}
            >
              {calendars.map((calendar) => (
                <option key={calendar.id} value={calendar.id}>
                  {calendar.name}
                </option>
              ))}
            </Select>
          </div>
        </div>
        <div className="flex flex-wrap justify-end gap-3">
          <Button variant="secondary" onClick={moreOptions}>
            Más opciones
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? "Guardando…" : "Guardar"}
          </Button>
        </div>
      </form>
    </dialog>
  );
}
