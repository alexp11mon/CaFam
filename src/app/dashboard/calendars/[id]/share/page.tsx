import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageShell } from "@/components/calendar/page-shell";
import { AccessCodePanel } from "@/components/sharing/access-code-panel";
import { InviteForm } from "@/components/sharing/invite-form";
import { InviteList } from "@/components/sharing/invite-list";
import { getCalendar, requireUser } from "@/lib/calendar/queries";
import { getAccessCode, getInvites } from "@/lib/sharing/queries";
import {
  createInvite,
  disableAccessCode,
  revokeInvite,
  saveAccessCode,
} from "./actions";

export const metadata: Metadata = { title: "Compartir" };

// Reads the session and the route param, so it streams behind <Suspense> (cacheComponents).
async function Share({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, userId } = await requireUser();
  const calendar = await getCalendar(supabase, userId, id);
  // Only the owner shares (RF-29): everyone else gets a 404 like a stranger.
  if (!calendar || calendar.role !== "owner") notFound();
  const [invites, accessCode] = await Promise.all([
    getInvites(supabase, id),
    getAccessCode(supabase, id),
  ]);

  return (
    <>
      <p className="flex items-center gap-2 text-ink">
        <span
          aria-hidden="true"
          className="size-4 shrink-0 rounded-full border border-ink/20"
          style={{ backgroundColor: calendar.color }}
        />
        <span className="min-w-0 break-words font-semibold">
          {calendar.name}
        </span>
      </p>
      <section aria-labelledby="invite-heading" className="flex flex-col gap-4">
        <h2 id="invite-heading" className="text-lg font-bold text-ink">
          Invitar con un enlace
        </h2>
        <InviteForm action={createInvite.bind(null, id)} />
      </section>
      <section aria-labelledby="active-heading" className="flex flex-col gap-4">
        <h2 id="active-heading" className="text-lg font-bold text-ink">
          Invitaciones vigentes
        </h2>
        <InviteList
          invites={invites}
          now={new Date().toISOString()}
          revokeAction={revokeInvite}
        />
      </section>
      <section aria-labelledby="code-heading" className="flex flex-col gap-4">
        <h2 id="code-heading" className="text-lg font-bold text-ink">
          Invitar con ID y PIN
        </h2>
        <AccessCodePanel
          code={accessCode}
          saveAction={saveAccessCode.bind(null, id)}
          disableAction={disableAccessCode.bind(null, id)}
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
      <Suspense fallback={<p className="text-ink/70">Cargando…</p>}>
        <Share params={params} />
      </Suspense>
    </PageShell>
  );
}
