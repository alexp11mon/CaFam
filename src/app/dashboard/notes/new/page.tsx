import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { PageShell } from "@/components/calendar/page-shell";
import { NoteForm } from "@/components/notes/note-form";
import { getProfileTimeZone, requireUser } from "@/lib/calendar/queries";
import { getNoteRoles } from "@/lib/notes/queries";
import { parseEventId } from "@/lib/recurrence/occurrence-id";
import { createNote } from "../actions";

export const metadata: Metadata = { title: "Nueva nota" };

type SearchParams = Promise<{ event?: string | string[] }>;

async function Form({ searchParams }: { searchParams: SearchParams }) {
  await connection();
  const { supabase, userId } = await requireUser();
  const { event: eventParam } = await searchParams;
  const roles = await getNoteRoles(supabase, userId);
  // Only where the user can write (RF-4); RLS enforces it anyway.
  let calendars = roles
    .filter((entry) => entry.role === "owner" || entry.role === "editor")
    .map(({ calendarId, name }) => ({ id: calendarId, name }));

  // From an event's detail (spec 048 RF-9): shared in its calendar when the
  // user can write notes there, personal otherwise.
  const parsed =
    typeof eventParam === "string" ? parseEventId(eventParam) : null;
  let event: { id: string; label: string } | undefined;
  let defaultCalendarId = "";
  if (parsed) {
    const rowId = parsed.kind === "event" ? parsed.id : parsed.seriesId;
    const [{ data }, timeZone] = await Promise.all([
      supabase
        .from("events")
        .select("title, starts_at, all_day, calendar_id")
        .eq("id", rowId)
        .maybeSingle(),
      getProfileTimeZone(supabase, userId),
    ]);
    if (data) {
      const start =
        parsed.kind === "occurrence" ? parsed.originalStart : data.starts_at;
      const day = new Intl.DateTimeFormat("es-ES", {
        day: "numeric",
        month: "short",
        timeZone: data.all_day ? "UTC" : timeZone,
      }).format(new Date(start));
      event = { id: eventParam as string, label: `${data.title} · ${day}` };
      // Another calendar would be refused (the note links inside its calendar).
      calendars = calendars.filter((c) => c.id === data.calendar_id);
      defaultCalendarId = calendars[0]?.id ?? "";
    }
  }
  return (
    <NoteForm
      action={createNote}
      calendars={calendars}
      event={event}
      defaultCalendarId={defaultCalendarId}
    />
  );
}

/** A new note (spec 028 RF-4), also for an event (spec 048 RF-9). */
export default function NewNotePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  return (
    <PageShell
      title="Nueva nota"
      backHref="/dashboard/notes"
      backLabel="Volver a Notas"
    >
      <Suspense fallback={<p className="text-muted">Cargando…</p>}>
        <Form searchParams={searchParams} />
      </Suspense>
    </PageShell>
  );
}
