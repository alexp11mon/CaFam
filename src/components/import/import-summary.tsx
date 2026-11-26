import Link from "next/link";
import type { ImportSummaryData } from "@/lib/ics/import-state";
import { T } from "@/components/i18n/locale-provider";

const ACTION_LINK =
  "inline-flex min-h-11 items-center font-semibold text-ink underline decoration-control underline-offset-4 hover:decoration-ink";

const events = (n: number) => (n === 1 ? "1 evento" : `${n} eventos`);

/** What a finished import did: created, skipped and cut series (RF-31). */
export function ImportSummary({ result }: { result: ImportSummaryData }) {
  const { calendarId, created, skipped, cutSeries, into, kept } = result;

  return (
    <div
      role="status"
      className="flex flex-col gap-2 rounded-card bg-paper p-4 text-ink tabular-nums"
    >
      {into ? (
        <>
          <p className="font-semibold">
            {created === 1 ? (
              <T>{"Se ha añadido 1 evento"}</T>
            ) : (
              <T vars={{ created }}>{"Se han añadido {created} eventos"}</T>
            )}{" "}
            <T vars={{ name: into.name }}>{"a «{name}»."}</T>
          </p>
          {into.existing > 0 ? (
            <p>
              {into.existing === 1
                ? "1 ya estaba"
                : `${into.existing} ya estaban`}
              .
            </p>
          ) : null}
        </>
      ) : (
        <p className="font-semibold">
          <T>{"Calendario creado con"}</T> {events(created)}.
        </p>
      )}
      {skipped > 0 ? (
        <p>
          {events(skipped)} {skipped === 1 ? "se ha omitido" : "se han omitido"}{" "}
          <T>
            {"por tener una zona horaria desconocida o fechas incorrectas."}
          </T>
        </p>
      ) : null}
      {cutSeries > 0 ? (
        <p>
          {cutSeries === 1
            ? "1 serie sin fin se ha cortado"
            : `${cutSeries} series sin fin se han cortado`}{" "}
          <T>{"a un año desde hoy."}</T>
        </p>
      ) : null}
      {kept === "yes" ? (
        <p>
          <T>{"Se actualizará desde el enlace cada 6 horas."}</T>
        </p>
      ) : kept === "failed" ? (
        <p>
          <T>
            {
              "No se ha podido guardar el enlace para mantenerlo actualizado. Los eventos sí se han importado."
            }
          </T>
        </p>
      ) : null}
      <div className="flex flex-wrap gap-x-4">
        <Link href="/dashboard/calendar" className={ACTION_LINK}>
          <T>{"Abrir calendario"}</T>
        </Link>
        {into ? null : (
          <Link
            href={`/dashboard/calendars/${calendarId}/edit`}
            className={ACTION_LINK}
          >
            <T>{"Editar calendario"}</T>
          </Link>
        )}
      </div>
    </div>
  );
}
