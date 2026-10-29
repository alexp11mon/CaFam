import type { Metadata } from "next";
import { Suspense } from "react";
import { NoticeList } from "@/components/account/notice-list";
import { OrphanCalendarItem } from "@/components/account/orphan-calendar-item";
import {
  CalendarList,
  type CalendarListItem,
} from "@/components/dashboard/calendar-list";
import { GroupForm } from "@/components/groups/group-form";
import { GroupList } from "@/components/groups/group-list";
import { ReconnectNotice } from "@/components/connections/reconnect-notice";
import { LinkButton } from "@/components/ui/link-button";
import { daysLeftNow } from "@/lib/account/orphan";
import { getNotices, getOrphanCalendars } from "@/lib/account/queries";
import { organizeGroups } from "@/lib/calendar/organize-groups";
import {
  getGroups,
  getMyCalendars,
  getPeople,
  getPreferences,
  getProfileTimeZone,
  requireUser,
  type CalendarRecord,
} from "@/lib/calendar/queries";
import { canMerge } from "@/lib/sync/read-only";
import { getConnections } from "@/lib/sync/queries";
import { saveOrder } from "../calendar/preferences-actions";
import { leaveCalendar } from "./[id]/members/actions";
import {
  assignToGroup,
  createGroup,
  deleteGroup,
  renameGroup,
  setGroupVisibility,
} from "./group-actions";
import { decideOrphanCalendar, dismissNotice } from "./orphan-actions";

export const metadata: Metadata = { title: "Mis calendarios" };

// Reads the session cookies, so it streams behind <Suspense> (cacheComponents).
async function Calendars() {
  const { supabase, userId } = await requireUser();
  const [records, people, preferences, timeZone, groups, connections] =
    await Promise.all([
      getMyCalendars(supabase, userId),
      getPeople(supabase),
      getPreferences(supabase, userId),
      getProfileTimeZone(supabase, userId),
      getGroups(supabase, userId),
      // RLS returns only the user's own accounts (spec 009 RF-3).
      getConnections(supabase),
    ]);
  const readOnlyAccounts = connections.filter(
    (c) => c.status === "active" && !c.canWrite,
  );
  const canUploadSome = connections.some(
    (c) => c.status === "active" && c.canWrite,
  );
  // The user's groups first, then the rest in the filter panel's order:
  // people, then calendars within each (RF-45, spec 007 RF-36, RF-37).
  const organized = organizeGroups({
    currentUserId: userId,
    people,
    groups,
    calendars: records,
    ...preferences,
  });
  const groupOf = new Map(
    preferences.calendarPreferences.map((p) => [p.calendarId, p.groupId]),
  );
  const item = (calendar: CalendarRecord): CalendarListItem => ({
    ...calendar,
    orphan: calendar.ownerId === null,
    groupId: groupOf.get(calendar.id) ?? null,
    canUpload: canUploadSome && calendar.ownerId === userId && !calendar.synced,
  });
  const sections = organized.groups.map((section) => ({
    group: { id: section.group.id, name: section.group.name },
    visibility: section.visibility,
    calendars: section.calendars.map(item),
  }));
  const ungrouped = organized.people.flatMap((group) =>
    group.calendars.map(item),
  );
  const ownedCount = records.filter(canMerge).length;

  return (
    <>
      {readOnlyAccounts.map((account) => (
        <ReconnectNotice key={account.id} email={account.email} />
      ))}
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
      <GroupForm action={createGroup} />
      <GroupList
        sections={sections}
        timeZone={timeZone}
        leaveAction={leaveCalendar}
        assignAction={assignToGroup}
        renameAction={renameGroup}
        deleteAction={deleteGroup}
        setVisibility={setGroupVisibility}
        saveOrder={saveOrder}
      />
      {sections.length > 0 && ungrouped.length > 0 ? (
        <h2 className="text-lg font-semibold text-ink">Sin grupo</h2>
      ) : null}
      {sections.length === 0 || ungrouped.length > 0 ? (
        <CalendarList
          calendars={ungrouped}
          timeZone={timeZone}
          leaveAction={leaveCalendar}
          groups={sections.map((section) => section.group)}
          assignAction={assignToGroup}
        />
      ) : null}
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
