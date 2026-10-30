import type { ReactNode } from "react";
import { formatEventWhen } from "@/lib/calendar/format";
import type { ConfirmState, Done, FormAction } from "@/lib/forms/form-state";
import { ConfirmDialog } from "./confirm-dialog";

export interface EventDetailData {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  allDay: boolean;
  description: string | null;
  location: string | null;
  /** Own color; null means the calendar's (RF-17). */
  color: string | null;
  calendarName: string;
  calendarColor: string;
  categoryName: string | null;
  /** Who created it, or the text for a gone author (spec 006, RF-34 to RF-36). */
  author: string;
  /** Why a synced event cannot be changed from CaFam, if it cannot (spec 009 RF-8). */
  readOnly?: "google" | "reconnect" | null;
}

const READ_ONLY_TEXT = {
  google:
    "La cuenta de Google solo puede ver este calendario, así que este evento solo se puede cambiar en Google.",
  reconnect:
    "Este evento viene de Google. Para cambiarlo desde CaFam, el propietario tiene que volver a conectar la cuenta.",
};

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-sm font-medium text-muted">{label}</dt>
      <dd className="min-w-0 break-words text-ink">{children}</dd>
    </div>
  );
}

/** Full detail of an event, in the zone of the profile (RF-34, RF-36). */
export function EventDetail({
  event,
  timeZone,
  canEdit,
  deleteAction,
  actions,
  onDeleted,
  media,
}: {
  event: EventDetailData;
  timeZone: string;
  /** Owner or editor; viewers get no buttons (RF-26). */
  canEdit: boolean;
  deleteAction: FormAction<ConfirmState>;
  /** More buttons next to "Borrar evento" (spec 008: Editar, Duplicar). */
  actions?: ReactNode;
  onDeleted?: (done: Done) => void;
  /** The event's images and "Añadir imágenes" (spec 012 RF-1, RF-9). */
  media?: ReactNode;
}) {
  return (
    <article className="flex flex-col gap-4">
      <header className="flex items-start gap-3">
        <span
          data-testid="event-color"
          aria-hidden="true"
          className="mt-2 size-4 shrink-0 rounded-full ring-1 ring-pastel-ink/20"
          style={{ backgroundColor: event.color ?? event.calendarColor }}
        />
        <h2 className="min-w-0 break-words text-xl font-bold text-ink">
          {event.title}
        </h2>
      </header>
      <dl className="flex flex-col gap-3">
        <Row label="Cuándo">
          <span data-testid="event-when">
            {formatEventWhen(event, timeZone)}
          </span>
        </Row>
        {event.location ? <Row label="Lugar">{event.location}</Row> : null}
        {event.description ? (
          <Row label="Descripción">
            <span className="whitespace-pre-line">{event.description}</span>
          </Row>
        ) : null}
        <Row label="Categoría">{event.categoryName ?? "Sin categoría"}</Row>
        <Row label="Calendario">{event.calendarName}</Row>
        <Row label="Creado por">{event.author}</Row>
      </dl>
      {media}
      {event.readOnly ? (
        <p className="text-sm text-muted">{READ_ONLY_TEXT[event.readOnly]}</p>
      ) : null}
      {canEdit ? (
        <div className="flex flex-wrap gap-3">
          {actions}
          <ConfirmDialog
            triggerLabel="Borrar evento"
            title={`¿Borrar «${event.title}»?`}
            description="El evento se borrará de forma definitiva."
            confirmLabel="Sí, borrar"
            action={deleteAction}
            onDone={onDeleted}
          />
        </div>
      ) : null}
    </article>
  );
}
