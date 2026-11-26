import type { Metadata } from "next";
import { Suspense } from "react";
import { NotesBoard } from "@/components/notes/notes-board";
import { LinkButton } from "@/components/ui/link-button";
import { todayKey } from "@/lib/calendar/format";
import { getProfileTimeZone, requireUser } from "@/lib/calendar/queries";
import { getNotes } from "@/lib/notes/queries";
import { T } from "@/components/i18n/locale-provider";

export const metadata: Metadata = { title: "Notas" };

// Reads the session, so it streams behind <Suspense> (cacheComponents).
async function Notes() {
  const { supabase, userId } = await requireUser();
  const [notes, timeZone] = await Promise.all([
    getNotes(supabase),
    getProfileTimeZone(supabase, userId),
  ]);
  return (
    <NotesBoard notes={notes} today={todayKey(timeZone)} userId={userId} />
  );
}

/** The list of notes (spec 028 RF-1 to RF-3). */
export default function NotesPage() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 px-4 py-4 sm:px-6 tab:py-6">
      <div className="flex items-center justify-between gap-3 max-tab:hidden">
        <h1 className="text-2xl font-semibold text-ink">
          <T>{"Notas"}</T>
        </h1>
        {/* On a phone "+" in the bottom bar does this (spec 025 plan D7). */}
        <div className="hidden lg:block">
          <LinkButton href="/dashboard/notes/new">
            <T>{"Nueva nota"}</T>
          </LinkButton>
        </div>
      </div>
      <h1 className="sr-only tab:hidden">
        <T>{"Notas"}</T>
      </h1>
      <Suspense
        fallback={
          <p role="status" className="text-muted">
            <T>{"Cargando tus notas…"}</T>
          </p>
        }
      >
        <Notes />
      </Suspense>
    </main>
  );
}
