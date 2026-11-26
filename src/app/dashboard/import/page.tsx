import type { Metadata } from "next";
import { Suspense } from "react";
import { PageShell } from "@/components/calendar/page-shell";
import { ImportForm } from "@/components/import/import-form";
import { getMyCalendars, requireUser } from "@/lib/calendar/queries";
import { importCalendar } from "./actions";
import { T } from "@/components/i18n/locale-provider";

export const metadata: Metadata = { title: "Importar calendario" };

// Applies to the Server Action of this page: reading a link and creating up to
// 2,000 events must not depend on the platform default (plan D12).
export const maxDuration = 60;

// Normal calendars the user can write: the synced ones have their own sync
// (spec 044 RF-1). Reads the session, so it streams behind <Suspense>.
async function Form() {
  const { supabase, userId } = await requireUser();
  const calendars = await getMyCalendars(supabase, userId);
  const destinations = calendars
    .filter((calendar) => calendar.role !== "viewer" && !calendar.synced)
    .map(({ id, name }) => ({ id, name }));
  return <ImportForm action={importCalendar} destinations={destinations} />;
}

export default function ImportPage() {
  return (
    <PageShell title="Importar calendario">
      <p className="text-ink">
        <T>
          {
            "Trae un calendario de Google, iCloud u Outlook con su enlace .ics o con un archivo .ics, a un calendario nuevo o a uno que ya tienes. Los eventos que ya estaban no se repiten."
          }
        </T>
      </p>
      <Suspense
        fallback={
          <p className="text-muted">
            <T>{"Cargando…"}</T>
          </p>
        }
      >
        <Form />
      </Suspense>
    </PageShell>
  );
}
