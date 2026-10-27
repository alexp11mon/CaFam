import type { Metadata } from "next";
import { Suspense } from "react";
import { MergeForm } from "@/components/calendar/merge-form";
import { PageShell } from "@/components/calendar/page-shell";
import { DEFAULT_CALENDAR_COLOR } from "@/lib/calendar/palette";
import {
  getEventCounts,
  getMyCalendars,
  requireUser,
} from "@/lib/calendar/queries";
import { getMembers } from "@/lib/sharing/queries";
import { canMerge } from "@/lib/sync/read-only";
import { mergeCalendars } from "../actions";

export const metadata: Metadata = { title: "Juntar calendarios" };

// Reads the session, so it streams behind <Suspense> (cacheComponents).
async function Merge() {
  const { supabase, userId } = await requireUser();
  // Only calendars the user owns can be merged (RF-53), never synced ones
  // (spec 007 RF-45); the database enforces both too.
  const owned = (await getMyCalendars(supabase, userId)).filter(canMerge);

  if (owned.length < 2) {
    return (
      <p className="rounded-3xl bg-paper px-4 py-6 text-center text-ink">
        Necesitas al menos dos calendarios propios para poder juntarlos.
      </p>
    );
  }

  const ids = owned.map((calendar) => calendar.id);
  const [counts, members] = await Promise.all([
    getEventCounts(supabase, ids),
    getMembers(supabase, ids),
  ]);

  return (
    <MergeForm
      action={mergeCalendars}
      calendars={owned.map(({ id, name, color }) => ({
        id,
        name,
        color,
        eventCount: counts[id] ?? 0,
      }))}
      members={members}
      initial={{
        sourceIds: "",
        targetId: "",
        newName: "",
        newColor: DEFAULT_CALENDAR_COLOR,
      }}
    />
  );
}

export default function MergePage() {
  return (
    <PageShell title="Juntar calendarios">
      <p className="text-ink">
        Los eventos y las categorías de los calendarios elegidos pasan a uno
        solo y los demás desaparecen. No se puede deshacer.
      </p>
      <Suspense fallback={<p className="text-muted">Cargando…</p>}>
        <Merge />
      </Suspense>
    </PageShell>
  );
}
