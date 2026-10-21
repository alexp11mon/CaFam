import type { Metadata } from "next";
import { PageShell } from "@/components/calendar/page-shell";
import { ImportForm } from "@/components/import/import-form";
import { importCalendar } from "./actions";

export const metadata: Metadata = { title: "Importar calendario" };

// Applies to the Server Action of this page: reading a link and creating up to
// 2,000 events must not depend on the platform default (plan D12).
export const maxDuration = 60;

export default function ImportPage() {
  return (
    <PageShell title="Importar calendario">
      <p className="text-ink">
        Trae un calendario de Google, iCloud u Outlook con su enlace .ics o con
        un archivo .ics. Se crea un calendario nuevo que puedes editar y
        compartir; no se mantiene conectado con el original.
      </p>
      <ImportForm action={importCalendar} />
    </PageShell>
  );
}
