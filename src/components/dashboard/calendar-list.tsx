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

/** Calendars the user belongs to, with their color and role (RF-13). */
export function CalendarList({ calendars }: { calendars: CalendarListItem[] }) {
  if (calendars.length === 0) {
    return (
      <p className="rounded-lg bg-brand-soft/40 px-4 py-6 text-center text-ink">
        Todavía no tienes calendarios.
      </p>
    );
  }

  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {calendars.map((calendar) => (
        <li
          key={calendar.id}
          className="flex min-w-0 items-center gap-3 rounded-xl border border-ink/15 bg-white p-4"
        >
          <span
            data-testid="calendar-color"
            aria-hidden="true"
            className="size-4 shrink-0 rounded-full"
            style={{ backgroundColor: calendar.color }}
          />
          <span className="min-w-0 flex-1 truncate font-semibold text-ink">
            {calendar.name}
          </span>
          <span className="shrink-0 rounded-full bg-brand-soft px-2.5 py-0.5 text-sm font-medium text-ink">
            {ROLE_LABELS[calendar.role]}
          </span>
        </li>
      ))}
    </ul>
  );
}
