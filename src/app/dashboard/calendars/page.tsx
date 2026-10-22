import type { Metadata } from "next";
import { Suspense } from "react";
import { CalendarList } from "@/components/dashboard/calendar-list";
import { LinkButton } from "@/components/ui/link-button";
import { groupByPerson } from "@/lib/calendar/grouping";
import {
  getMyCalendars,
  getPeople,
  getPreferences,
  requireUser,
} from "@/lib/calendar/queries";
import { leaveCalendar } from "./[id]/members/actions";

export const metadata: Metadata = { title: "Mis calendarios" };

// Reads the session cookies, so it streams behind <Suspense> (cacheComponents).
async function Calendars() {
  const { supabase, userId } = await requireUser();
  const [records, people, preferences] = await Promise.all([
    getMyCalendars(supabase, userId),
    getPeople(supabase),
    getPreferences(supabase, userId),
  ]);
  // Same order as the filter panel: people, then calendars within each (RF-45).
  const calendars = groupByPerson({
    currentUserId: userId,
    people,
    calendars: records,
    ...preferences,
  }).flatMap((group) => group.calendars);
  const ownedCount = calendars.filter((c) => c.role === "owner").length;

  return (
    <>
      <div className="flex flex-wrap gap-3">
        <LinkButton href="/dashboard/calendars/new">
          Nuevo calendario
        </LinkButton>
        <LinkButton href="/dashboard/import" variant="secondary">
          Importar calendario
        </LinkButton>
        <LinkButton href="/dashboard/join" variant="secondary">
          Unirme con código
        </LinkButton>
        {ownedCount >= 2 ? (
          <LinkButton href="/dashboard/calendars/merge" variant="secondary">
            Juntar calendarios
          </LinkButton>
        ) : null}
      </div>
      <CalendarList calendars={calendars} leaveAction={leaveCalendar} />
    </>
  );
}

/** "Mis calendarios": the list the old panel showed (spec 005 RF-21, plan D5). */
export default function CalendarsPage() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6">
      <h1 className="text-2xl font-bold text-ink">Mis calendarios</h1>
      <Suspense fallback={<p className="text-muted">Cargando calendarios…</p>}>
        <Calendars />
      </Suspense>
    </main>
  );
}
