import Link from "next/link";
import { formatPeriodTitle } from "@/lib/calendar/format";
import {
  calendarHref,
  navigate,
  type CalendarView,
} from "@/lib/calendar/ranges";

const VIEWS: {
  view: CalendarView;
  label: string;
  previous: string;
  next: string;
}[] = [
  {
    view: "agenda",
    label: "Agenda",
    previous: "14 días anteriores",
    next: "14 días siguientes",
  },
  {
    view: "month",
    label: "Mes",
    previous: "Mes anterior",
    next: "Mes siguiente",
  },
  {
    view: "week",
    label: "Semana",
    previous: "Semana anterior",
    next: "Semana siguiente",
  },
  {
    view: "day",
    label: "Día",
    previous: "Día anterior",
    next: "Día siguiente",
  },
];

const BUTTON =
  "inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border-2 border-brand px-3 text-base font-semibold text-brand hover:bg-brand-soft/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";

/** View switcher, previous / next / today and the period heading (RF-29, RF-37). */
export function ViewToolbar({
  view,
  date,
  today,
}: {
  view: CalendarView;
  date: string;
  today: string;
}) {
  const current = VIEWS.find((item) => item.view === view)!;

  return (
    <nav aria-label="Navegación del calendario" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Link href={calendarHref(view, today)} className={BUTTON}>
          Hoy
        </Link>
        <Link
          href={calendarHref(view, navigate(view, date, -1))}
          aria-label={current.previous}
          className={BUTTON}
        >
          <span aria-hidden="true">‹</span>
        </Link>
        <Link
          href={calendarHref(view, navigate(view, date, 1))}
          aria-label={current.next}
          className={BUTTON}
        >
          <span aria-hidden="true">›</span>
        </Link>
        <h2 className="min-w-0 flex-1 text-lg font-bold text-ink first-letter:uppercase">
          {formatPeriodTitle(view, date)}
        </h2>
      </div>
      <div className="flex gap-2">
        {VIEWS.map((item) => (
          <Link
            key={item.view}
            href={calendarHref(item.view, date)}
            aria-current={item.view === view ? "page" : undefined}
            className={`inline-flex min-h-11 flex-1 items-center justify-center rounded-lg px-4 text-base font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand sm:flex-none ${item.view === view ? "bg-brand text-white" : "border-2 border-brand text-brand hover:bg-brand-soft/30"}`}
          >
            {item.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
