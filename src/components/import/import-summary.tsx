import Link from "next/link";
import type { ImportSummaryData } from "@/lib/ics/import-state";

const ACTION_LINK =
  "inline-flex min-h-11 items-center font-semibold text-brand underline";

const events = (n: number) => (n === 1 ? "1 evento" : `${n} eventos`);

/** What a finished import did: created, skipped and cut series (RF-31). */
export function ImportSummary({ result }: { result: ImportSummaryData }) {
  const { calendarId, created, skipped, cutSeries } = result;

  return (
    <div
      role="status"
      className="flex flex-col gap-2 rounded-lg bg-brand-soft/40 p-4 text-ink"
    >
      <p className="font-semibold">Calendario creado con {events(created)}.</p>
      {skipped > 0 ? (
        <p>
          {events(skipped)} {skipped === 1 ? "se ha omitido" : "se han omitido"}{" "}
          por tener una zona horaria desconocida o fechas incorrectas.
        </p>
      ) : null}
      {cutSeries > 0 ? (
        <p>
          {cutSeries === 1
            ? "1 serie sin fin se ha cortado"
            : `${cutSeries} series sin fin se han cortado`}{" "}
          a un año desde hoy.
        </p>
      ) : null}
      <div className="flex flex-wrap gap-x-4">
        <Link href="/dashboard/calendar" className={ACTION_LINK}>
          Abrir calendario
        </Link>
        <Link
          href={`/dashboard/calendars/${calendarId}/edit`}
          className={ACTION_LINK}
        >
          Editar calendario
        </Link>
      </div>
    </div>
  );
}
