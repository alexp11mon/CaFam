import type { Metadata } from "next";
import { Suspense } from "react";
import { TrashList } from "@/components/trash/trash-list";
import {
  getMyCalendars,
  getProfileTimeZone,
  requireUser,
} from "@/lib/calendar/queries";
import { readTrash } from "@/lib/calendar/trash-queries";

export const metadata: Metadata = { title: "Papelera" };

// Reads the session, so it streams behind <Suspense> (cacheComponents).
async function Trash() {
  const { supabase, userId } = await requireUser();
  const [calendars, timeZone, trash] = await Promise.all([
    getMyCalendars(supabase, userId),
    getProfileTimeZone(supabase, userId),
    readTrash(supabase),
  ]);
  return (
    <TrashList
      entries={trash.entries}
      readAt={trash.readAt}
      timeZone={timeZone}
      calendars={calendars
        .filter((calendar) => calendar.role !== "viewer")
        .map((calendar) => ({
          id: calendar.id,
          name: calendar.name,
          color: calendar.color,
          isOwner: calendar.role === "owner",
        }))}
    />
  );
}

/** What was deleted in the last 30 days, to restore it (spec 046 RF-3 to RF-6). */
export default function TrashPage() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-ink max-tab:sr-only">
          Papelera
        </h1>
        <p className="max-w-prose text-muted">
          Los eventos borrados se guardan 30 días con sus imágenes y
          comentarios. La ven el propietario y los editores de cada calendario.
        </p>
      </header>
      <Suspense fallback={<p className="text-muted">Cargando la papelera…</p>}>
        <Trash />
      </Suspense>
    </main>
  );
}
