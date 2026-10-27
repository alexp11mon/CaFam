import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageShell } from "@/components/calendar/page-shell";
import { CalendarPicker } from "@/components/connections/calendar-picker";
import { SyncNowButton } from "@/components/connections/sync-now-button";
import { SyncStatus } from "@/components/connections/sync-status";
import { FormAlert } from "@/components/ui/form-alert";
import { LinkButton } from "@/components/ui/link-button";
import { getProfileTimeZone, requireUser } from "@/lib/calendar/queries";
import { providerCalendars } from "@/lib/sync/engine";
import {
  ProviderError,
  type ProviderCalendar,
} from "@/lib/sync/providers/google";
import { getConnection, getSyncedCalendars } from "@/lib/sync/queries";
import { connectionIdSchema } from "@/lib/sync/schemas";
import { SYNC_ERRORS } from "@/lib/sync/summary";
import { saveSelection, syncNow } from "../actions";

export const metadata: Metadata = { title: "Cuenta de Google" };

// Reading Google's list and the first load of new calendars may take a while.
export const maxDuration = 60;

/** Google's current list, or the reason it could not be read (RF-12, RF-31). */
async function readGoogleList(
  connectionId: string,
): Promise<{ list: ProviderCalendar[] } | { error: string }> {
  try {
    return { list: await providerCalendars(connectionId) };
  } catch (error) {
    return {
      error:
        error instanceof ProviderError && error.kind === "revoked"
          ? SYNC_ERRORS.revoked
          : "No se ha podido leer la lista de calendarios de Google. Inténtalo más tarde.",
    };
  }
}

async function ConnectionDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!connectionIdSchema.safeParse(id).success) notFound();
  const { supabase, userId } = await requireUser();
  const connection = await getConnection(supabase, id);
  if (!connection) notFound();

  const [synced, timeZone, google] = await Promise.all([
    getSyncedCalendars(supabase, id),
    getProfileTimeZone(supabase, userId),
    connection.status === "active"
      ? readGoogleList(id)
      : Promise.resolve({ error: SYNC_ERRORS.revoked }),
  ]);
  const syncedIds = new Set(synced.map((c) => c.externalId));

  return (
    <>
      <section className="flex flex-col gap-3 rounded-3xl bg-paper p-4 sm:p-6">
        <p className="text-sm font-semibold text-muted">Google</p>
        <p className="truncate text-lg font-semibold text-ink">
          {connection.email}
        </p>
        {connection.status === "active" ? (
          <SyncNowButton action={syncNow.bind(null, id)} />
        ) : (
          <div className="flex flex-col gap-3">
            <FormAlert message={SYNC_ERRORS.revoked} />
            <LinkButton
              href="/dashboard/connections/new?provider=google"
              className="self-start"
            >
              Volver a conectar
            </LinkButton>
          </div>
        )}
      </section>

      {synced.length > 0 ? (
        <section
          aria-labelledby="synced-heading"
          className="flex flex-col gap-3"
        >
          <h2 id="synced-heading" className="text-lg font-semibold text-ink">
            Calendarios traídos
          </h2>
          <SyncStatus calendars={synced} timeZone={timeZone} />
        </section>
      ) : null}

      <section aria-labelledby="pick-heading" className="flex flex-col gap-3">
        <h2 id="pick-heading" className="text-lg font-semibold text-ink">
          Elegir calendarios
        </h2>
        {"error" in google ? (
          <FormAlert message={google.error} />
        ) : (
          <CalendarPicker
            connectionId={id}
            action={saveSelection}
            calendars={google.list.map((calendar) => ({
              ...calendar,
              synced: syncedIds.has(calendar.id),
            }))}
          />
        )}
      </section>
    </>
  );
}

/** One Google account: its calendars, their state and the update (RF-9 to RF-14, RF-23, RF-26). */
export default function ConnectionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <PageShell
      title="Cuenta de Google"
      backHref="/dashboard/connections"
      backLabel="Volver a Cuentas conectadas"
    >
      <Suspense fallback={<p className="text-muted">Cargando la cuenta…</p>}>
        <ConnectionDetail params={params} />
      </Suspense>
    </PageShell>
  );
}
