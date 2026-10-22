import type { Metadata } from "next";
import { Suspense } from "react";
import { PageShell } from "@/components/calendar/page-shell";
import { InviteJoinCard } from "@/components/sharing/invite-join-card";
import { requireUser } from "@/lib/calendar/queries";
import { getInvitePreview } from "@/lib/sharing/queries";
import { acceptInvite } from "./actions";

export const metadata: Metadata = { title: "Invitación" };

// Reads the session and the route param, so it streams behind <Suspense> (cacheComponents).
// Without a session the proxy has already sent the visitor to /login (RF-7).
async function Invite({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const { supabase } = await requireUser();
  const preview = await getInvitePreview(supabase, token);

  return (
    <InviteJoinCard
      preview={preview}
      acceptAction={acceptInvite.bind(null, token)}
    />
  );
}

export default function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  return (
    <PageShell title="Invitación a un calendario">
      <Suspense fallback={<p className="text-muted">Cargando…</p>}>
        <Invite params={params} />
      </Suspense>
    </PageShell>
  );
}
