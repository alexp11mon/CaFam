import type { Metadata } from "next";
import { CalendarForm } from "@/components/calendar/calendar-form";
import { PageShell } from "@/components/calendar/page-shell";
import { DEFAULT_CALENDAR_COLOR } from "@/lib/calendar/palette";
import { createCalendar } from "../actions";

export const metadata: Metadata = { title: "Nuevo calendario" };

export default function NewCalendarPage() {
  return (
    <PageShell title="Nuevo calendario">
      <CalendarForm
        action={createCalendar}
        initial={{ name: "", description: "", color: DEFAULT_CALENDAR_COLOR }}
        submitLabel="Crear calendario"
        pendingLabel="Creando…"
      />
    </PageShell>
  );
}
