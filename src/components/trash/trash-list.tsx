"use client";

import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/calendar/confirm-dialog";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { useNow } from "@/lib/hooks/use-now";
import { emptyTrash } from "@/app/dashboard/trash/actions";
import {
  groupTrash,
  type TrashCalendar,
  type TrashEntry,
} from "@/lib/calendar/trash";
import { TrashItem } from "./trash-item";
import { useT } from "@/components/i18n/locale-provider";

/** The trash of every calendar where I am Propietario or Editor (RF-3, RF-4). */
export function TrashList({
  entries,
  calendars,
  timeZone,
  readAt,
}: {
  entries: readonly TrashEntry[];
  calendars: readonly TrashCalendar[];
  timeZone: string;
  /** When the server read it: the time of the first paint (useNow is null there). */
  readAt: string;
}) {
  const t = useT();
  const router = useRouter();
  const { show } = useToast();
  const now = new Date(useNow() ?? Date.parse(readAt));
  const groups = groupTrash(entries, calendars);

  if (groups.length === 0) {
    return (
      <EmptyState title={t("La papelera está vacía")}>
        {t("Lo que borres en tus calendarios se guarda aquí 30 días.")}
      </EmptyState>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {groups.map(({ calendar, entries: items }) => {
        const headingId = `papelera-${calendar.id}-titulo`;
        return (
          <section
            key={calendar.id}
            id={`papelera-${calendar.id}`}
            aria-labelledby={headingId}
            className="flex scroll-mt-24 flex-col gap-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2
                id={headingId}
                className="flex items-center gap-2 text-lg font-semibold text-ink"
              >
                <span
                  aria-hidden
                  className="size-3 shrink-0 rounded-full ring-1 ring-pastel-ink/20"
                  style={{ backgroundColor: calendar.color }}
                />
                {calendar.name}
              </h2>
              {calendar.isOwner ? (
                <ConfirmDialog
                  triggerLabel={t("Vaciar la papelera")}
                  triggerAriaLabel={t("Vaciar la papelera de {name}", {
                    name: calendar.name,
                  })}
                  title={t("¿Vaciar la papelera?")}
                  description={t(
                    items.length === 1
                      ? "Se borrarán para siempre 1 evento de «{name}», con sus imágenes y comentarios. No se puede deshacer."
                      : "Se borrarán para siempre {count} eventos de «{name}», con sus imágenes y comentarios. No se puede deshacer.",
                    { count: items.length, name: calendar.name },
                  )}
                  confirmLabel={t("Vaciar la papelera")}
                  action={() => emptyTrash(calendar.id)}
                  onDone={() => {
                    show("Papelera vaciada");
                    router.refresh();
                  }}
                />
              ) : null}
            </div>
            <Card>
              <ul className="flex flex-col divide-y divide-line">
                {items.map((entry) => (
                  <TrashItem
                    key={entry.id}
                    entry={entry}
                    timeZone={timeZone}
                    now={now}
                  />
                ))}
              </ul>
            </Card>
          </section>
        );
      })}
    </div>
  );
}
