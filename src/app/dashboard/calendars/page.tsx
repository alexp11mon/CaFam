import type { Metadata } from "next";
import { Suspense } from "react";
import { NoticeList } from "@/components/account/notice-list";
import { OrphanCalendarItem } from "@/components/account/orphan-calendar-item";
import { CalendarList } from "@/components/dashboard/calendar-list";
import { LinkButton } from "@/components/ui/link-button";
import { daysLeftNow } from "@/lib/account/orphan";
import { getNotices, getOrphanCalendars } from "@/lib/account/queries";
import { groupByPerson } from "@/lib/calendar/grouping";
import {
  getMyCalendars,
  getPeople,
  getPreferences,
  getProfileTimeZone,
  requireUser,
} from "@/lib/calendar/queries";
import { canMerge } from "@/lib/sync/read-only";
import { leaveCalendar } from "./[id]/members/actions";
import { decideOrphanCalendar, dismissNotice } from "./orphan-actions";

export const metadata: Metadata = { title: "Mis calendarios" };

// Reads the session cookies, so it streams behind <Suspense> (cacheComponents).
async function Calendars() {
  const { supabase, userId } = await requireUser();
  const [records, people, preferences, timeZone] = await Promise.all([
    getMyCalendars(supabase, userId),
    getPeople(supabase),
    getPreferences(supabase, userId),
    getProfileTimeZone(supabase, userId),
  ]);
  // Same order as the filter panel: people, then calendars within each (RF-45).
  const calendars = groupByPerson({
    currentUserId: userId,
    people,
    calendars: records,
    ...preferences,
  }).flatMap((group) => group.calendars);
  const ownedCount = calendars.filter(canMerge).length;

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
        <LinkButton href="/dashboard/connections" variant="secondary">
          Cuentas conectadas
        </LinkButton>
        {ownedCount >= 2 ? (
          <LinkButton href="/dashboard/calendars/merge" variant="secondary">
            Juntar calendarios
          </LinkButton>
        ) : null}
      </div>
      <CalendarList
        calendars={calendars}
        timeZone={timeZone}
        leaveAction={leaveCalendar}
      />
    </>
  );
}

// Notices and calendars without owner, only when there are any (spec 006, RF-23 to RF-26).
async function AccountNotices() {
  const { supabase, userId } = await requireUser();
  const [notices, orphans] = await Promise.all([
    getNotices(supabase),
    getOrphanCalendars(supabase, userId),
  ]);
  if (notices.length === 0 && orphans.length === 0) return null;

  return (
    <section aria-labelledby="account-notices" className="flex flex-col gap-4">
      <h2 id="account-notices" className="text-lg font-semibold text-ink">
        Avisos
      </h2>
      <NoticeList notices={notices} dismissAction={dismissNotice} />
      {orphans.length > 0 ? (
        <ul className="flex flex-col gap-3">
          {orphans.map((calendar) => (
            <OrphanCalendarItem
              key={calendar.id}
              calendar={calendar}
              daysLeft={daysLeftNow(calendar.orphanedAt)}
              keepAction={decideOrphanCalendar.bind(null, calendar.id, true)}
              leaveAction={decideOrphanCalendar.bind(null, calendar.id, false)}
            />
          ))}
        </ul>
      ) : null}
    </section>
  );
}

/** "Mis calendarios": the list the old panel showed (spec 005 RF-21, plan D5). */
export default function CalendarsPage() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6">
      <h1 className="text-2xl font-bold text-ink">Mis calendarios</h1>
      <Suspense fallback={null}>
        <AccountNotices />
      </Suspense>
      <Suspense fallback={<p className="text-muted">Cargando calendarios…</p>}>
        <Calendars />
      </Suspense>
    </main>
  );
}
