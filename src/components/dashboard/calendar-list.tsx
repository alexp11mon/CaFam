import Link from "next/link";
import { LinkButton } from "@/components/ui/link-button";
import type { Database } from "@/types/database";

type CalendarRole = Database["public"]["Enums"]["calendar_role"];

export interface CalendarListItem {
  id: string;
  name: string;
  color: string;
  role: CalendarRole;
}

const ROLE_LABELS: Record<CalendarRole, string> = {
  owner: "Propietario",
  editor: "Editor",
  viewer: "Lector",
};

const ACTION_LINK =
  "inline-flex min-h-11 items-center text-sm font-semibold text-brand underline";

/** Calendars the user belongs to, in the order received (RF-13, RF-41, RF-45). */
export function CalendarList({ calendars }: { calendars: CalendarListItem[] }) {
  if (calendars.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-lg bg-brand-soft/40 px-4 py-6 text-center text-ink">
        <p>Todavía no tienes calendarios.</p>
        <LinkButton href="/dashboard/calendars/new">
          Crear calendario
        </LinkButton>
      </div>
    );
  }

  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {calendars.map((calendar) => (
        <li
          key={calendar.id}
          className="flex min-w-0 flex-col gap-2 rounded-xl border border-ink/15 bg-white p-4"
        >
          <div className="flex min-w-0 items-center gap-3">
            <span
              data-testid="calendar-color"
              aria-hidden="true"
              className="size-4 shrink-0 rounded-full border border-ink/20"
              style={{ backgroundColor: calendar.color }}
            />
            <span
              data-testid="calendar-name"
              className="min-w-0 flex-1 truncate font-semibold text-ink"
            >
              {calendar.name}
            </span>
            <span className="shrink-0 rounded-full bg-brand-soft px-2.5 py-0.5 text-sm font-medium text-ink">
              {ROLE_LABELS[calendar.role]}
            </span>
          </div>
          {calendar.role !== "viewer" ? (
            <div className="flex flex-wrap gap-x-4">
              {calendar.role === "owner" ? (
                <Link
                  href={`/dashboard/calendars/${calendar.id}/edit`}
                  aria-label={`Editar ${calendar.name}`}
                  className={ACTION_LINK}
                >
                  Editar
                </Link>
              ) : null}
              <Link
                href={`/dashboard/calendars/${calendar.id}/categories`}
                aria-label={`Categorías de ${calendar.name}`}
                className={ACTION_LINK}
              >
                Categorías
              </Link>
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
