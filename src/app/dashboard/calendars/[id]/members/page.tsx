import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { OrphanNotice } from "@/components/account/orphan-notice";
import { PageShell } from "@/components/calendar/page-shell";
import { MemberList } from "@/components/sharing/member-list";
import { orphanDeadline } from "@/lib/account/orphan";
import { getOrphanCalendars } from "@/lib/account/queries";
import {
  getCalendar,
  getProfileTimeZone,
  requireUser,
} from "@/lib/calendar/queries";
import { getMembers } from "@/lib/sharing/queries";
import { changeMemberRole, expelMember, leaveCalendar } from "./actions";

export const metadata: Metadata = { title: "Miembros" };

// Reads the session and the route param, so it streams behind <Suspense> (cacheComponents).
async function Members({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, userId } = await requireUser();
  // Strangers get a 404, like a calendar that does not exist (RF-29).
  const calendar = await getCalendar(supabase, userId, id);
  if (!calendar) notFound();
  const members = await getMembers(supabase, [id]);
  // Without owner, the members decide until the deadline (spec 006, RF-22, RF-24).
  const orphan =
    calendar.ownerId === null
      ? (await getOrphanCalendars(supabase, userId)).find((c) => c.id === id)
      : undefined;
  const timeZone = orphan ? await getProfileTimeZone(supabase, userId) : "";

  return (
    <>
      <p className="flex items-center gap-2 text-ink">
        <span
          aria-hidden="true"
          className="size-4 shrink-0 rounded-full ring-1 ring-ink/20"
          style={{ backgroundColor: calendar.color }}
        />
        <span className="min-w-0 break-words font-semibold">
          {calendar.name}
        </span>
      </p>
      {orphan ? (
        <OrphanNotice
          deadline={orphanDeadline(orphan.orphanedAt).toISOString()}
          timeZone={timeZone}
        />
      ) : null}
      <MemberList
        members={members}
        currentUserId={userId}
        changeRoleAction={changeMemberRole.bind(null, id)}
        expelAction={expelMember.bind(null, id)}
        leaveAction={leaveCalendar.bind(null, id)}
      />
    </>
  );
}

export default function MembersPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <PageShell title="Miembros">
      <Suspense fallback={<p className="text-muted">Cargando…</p>}>
        <Members params={params} />
      </Suspense>
    </PageShell>
  );
}
