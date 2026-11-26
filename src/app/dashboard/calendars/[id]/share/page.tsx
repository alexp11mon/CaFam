import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageShell } from "@/components/calendar/page-shell";
import { AccessCodePanel } from "@/components/sharing/access-code-panel";
import { IcsFeedPanel } from "@/components/sharing/ics-feed-panel";
import { InviteForm } from "@/components/sharing/invite-form";
import { InviteList } from "@/components/sharing/invite-list";
import { getCalendar, requireUser } from "@/lib/calendar/queries";
import { getAccessCode, getInvites, hasIcsFeed } from "@/lib/sharing/queries";
import {
  createIcsFeed,
  createInvite,
  disableAccessCode,
  disableIcsFeed,
  revokeInvite,
  saveAccessCode,
} from "./actions";
import { T } from "@/components/i18n/locale-provider";

export const metadata: Metadata = { title: "Compartir" };

// Reads the session and the route param, so it streams behind <Suspense> (cacheComponents).
async function Share({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, userId } = await requireUser();
  const calendar = await getCalendar(supabase, userId, id);
  // Only the owner shares (RF-29): everyone else gets a 404 like a stranger.
  if (!calendar || calendar.role !== "owner") notFound();
  const [invites, accessCode, feed] = await Promise.all([
    getInvites(supabase, id),
    getAccessCode(supabase, id),
    hasIcsFeed(supabase, id),
  ]);

  return (
    <>
      <p className="flex items-center gap-2 text-ink">
        <span
          aria-hidden="true"
          className="size-4 shrink-0 rounded-full ring-1 ring-pastel-ink/20"
          style={{ backgroundColor: calendar.color }}
        />
        <span className="min-w-0 break-words font-semibold">
          {calendar.name}
        </span>
      </p>
      <Link
        href={`/dashboard/calendars/${id}/members`}
        className="inline-flex min-h-11 items-center text-sm font-semibold text-ink underline decoration-control underline-offset-4 hover:decoration-ink"
      >
        <T>{"Ver miembros"}</T>
      </Link>
      <section aria-labelledby="invite-heading" className="flex flex-col gap-4">
        <h2 id="invite-heading" className="text-lg font-semibold text-ink">
          <T>{"Invitar con un enlace"}</T>
        </h2>
        <InviteForm action={createInvite.bind(null, id)} />
      </section>
      <section aria-labelledby="active-heading" className="flex flex-col gap-4">
        <h2 id="active-heading" className="text-lg font-semibold text-ink">
          <T>{"Invitaciones vigentes"}</T>
        </h2>
        <InviteList
          invites={invites}
          now={new Date().toISOString()}
          revokeAction={revokeInvite}
        />
      </section>
      <section aria-labelledby="code-heading" className="flex flex-col gap-4">
        <h2 id="code-heading" className="text-lg font-semibold text-ink">
          <T>{"Invitar con ID y PIN"}</T>
        </h2>
        <AccessCodePanel
          code={accessCode}
          saveAction={saveAccessCode.bind(null, id)}
          disableAction={disableAccessCode.bind(null, id)}
        />
      </section>
      <section aria-labelledby="feed-heading" className="flex flex-col gap-4">
        <h2 id="feed-heading" className="text-lg font-semibold text-ink">
          <T>{"Suscripción (.ics)"}</T>
        </h2>
        <IcsFeedPanel
          active={feed}
          createAction={createIcsFeed.bind(null, id)}
          disableAction={disableIcsFeed.bind(null, id)}
        />
      </section>
    </>
  );
}

export default function SharePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <PageShell title="Compartir calendario">
      <Suspense
        fallback={
          <p className="text-muted">
            <T>{"Cargando…"}</T>
          </p>
        }
      >
        <Share params={params} />
      </Suspense>
    </PageShell>
  );
}
