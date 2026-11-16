import type { Metadata } from "next";
import { Suspense } from "react";
import { PageShell } from "@/components/calendar/page-shell";
import { NoteForm } from "@/components/notes/note-form";
import { requireUser } from "@/lib/calendar/queries";
import { getNoteRoles } from "@/lib/notes/queries";
import { createNote } from "../actions";

export const metadata: Metadata = { title: "Nueva nota" };

async function Form() {
  const { supabase, userId } = await requireUser();
  const roles = await getNoteRoles(supabase, userId);
  return (
    <NoteForm
      action={createNote}
      // Only where the user can write (RF-4); RLS enforces it anyway.
      calendars={roles
        .filter((entry) => entry.role === "owner" || entry.role === "editor")
        .map(({ calendarId, name }) => ({ id: calendarId, name }))}
    />
  );
}

/** A new note (spec 028 RF-4). */
export default function NewNotePage() {
  return (
    <PageShell
      title="Nueva nota"
      backHref="/dashboard/notes"
      backLabel="Volver a Notas"
    >
      <Suspense fallback={<p className="text-muted">Cargando…</p>}>
        <Form />
      </Suspense>
    </PageShell>
  );
}
