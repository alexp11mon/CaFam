import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { NoteEditor } from "@/components/notes/note-editor";
import { todayKey } from "@/lib/calendar/format";
import { getProfileTimeZone, requireUser } from "@/lib/calendar/queries";
import { noteAccess } from "@/lib/notes/permissions";
import { getNote, getNoteRoles } from "@/lib/notes/queries";
import { noteIdSchema } from "@/lib/notes/schemas";

export const metadata: Metadata = { title: "Nota" };

async function Note({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // A note that does not exist or is someone else's: 404 (RF-11).
  if (!noteIdSchema.safeParse(id).success) notFound();
  const { supabase, userId } = await requireUser();
  const [note, roles, timeZone] = await Promise.all([
    getNote(supabase, id),
    getNoteRoles(supabase, userId),
    getProfileTimeZone(supabase, userId),
  ]);
  if (!note) notFound();
  const role =
    roles.find((entry) => entry.calendarId === note.calendarId)?.role ?? null;
  return (
    <NoteEditor
      note={note}
      access={noteAccess(note, userId, role)}
      calendars={roles
        .filter((entry) => entry.role === "owner" || entry.role === "editor")
        .map(({ calendarId, name }) => ({ id: calendarId, name }))}
      today={todayKey(timeZone)}
      timeZone={timeZone}
      userId={userId}
    />
  );
}

/** One note (spec 028 RF-5 to RF-11). */
export default function NotePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 py-3 sm:px-6 tab:py-6">
      <Suspense
        fallback={
          <p role="status" className="text-muted">
            Cargando la nota…
          </p>
        }
      >
        <Note params={params} />
      </Suspense>
    </main>
  );
}
