import { formatEventWhen } from "@/lib/calendar/format";
import type { ConfirmState, FormAction } from "@/lib/forms/form-state";
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
}

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
}: {
  event: EventDetailData;
  timeZone: string;
  /** Owner or editor; viewers get no buttons (RF-26). */
  canEdit: boolean;
  deleteAction: FormAction<ConfirmState>;
}) {
  return (
    <article className="flex flex-col gap-4">
      <header className="flex items-start gap-3">
        <span
          data-testid="event-color"
          aria-hidden="true"
          className="mt-2 size-4 shrink-0 rounded-full ring-1 ring-ink/20"
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
      </dl>
      {canEdit ? (
        <div>
          <ConfirmDialog
            triggerLabel="Borrar evento"
            title={`¿Borrar «${event.title}»?`}
            description="El evento se borrará de forma definitiva."
            confirmLabel="Sí, borrar"
            action={deleteAction}
          />
        </div>
      ) : null}
    </article>
  );
}
