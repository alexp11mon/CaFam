import type { Metadata } from "next";
import { Suspense } from "react";
import { CalendarList } from "@/components/dashboard/calendar-list";
import { Button } from "@/components/ui/button";
import { LinkButton } from "@/components/ui/link-button";
import { groupByPerson } from "@/lib/calendar/grouping";
import {
  getMyCalendars,
  getPeople,
  getPreferences,
  requireUser,
} from "@/lib/calendar/queries";
import { signOut } from "../(auth)/actions";
import { leaveCalendar } from "./calendars/[id]/members/actions";

export const metadata: Metadata = { title: "Panel" };

// Reads the session cookies, so it streams behind <Suspense> (cacheComponents).
async function Greeting() {
  const { supabase, userId } = await requireUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", userId)
    .single();

  return <>Hola, {profile?.display_name}</>;
}

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
        <LinkButton href="/dashboard/calendar">Abrir calendario</LinkButton>
        <LinkButton href="/dashboard/calendars/new" variant="secondary">
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

export default function DashboardPage() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-ink/10 pb-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-brand">CalenderFam</p>
          <h1 className="truncate text-xl font-bold text-ink sm:text-2xl">
            <Suspense fallback="Hola">
              <Greeting />
            </Suspense>
          </h1>
        </div>
        <form action={signOut}>
          <Button type="submit">Cerrar sesión</Button>
        </form>
      </header>
      <section
        aria-labelledby="calendars-heading"
        className="flex flex-col gap-4"
      >
        <h2 id="calendars-heading" className="text-lg font-semibold text-ink">
          Tus calendarios
        </h2>
        <Suspense
          fallback={<p className="text-ink/70">Cargando calendarios…</p>}
        >
          <Calendars />
        </Suspense>
      </section>
    </main>
  );
}
