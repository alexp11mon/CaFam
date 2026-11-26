"use client";
import type { T } from "@/lib/i18n/translate";

import { useActionState } from "react";
import { ConfirmDialog } from "@/components/calendar/confirm-dialog";
import { Button } from "@/components/ui/button";
import { FormAlert } from "@/components/ui/form-alert";
import type { OrphanCalendar } from "@/lib/account/queries";
import type { ConfirmState, FormAction } from "@/lib/forms/form-state";
import { useT } from "@/components/i18n/locale-provider";

function daysLeftText(days: number, t: T): string {
  if (days > 1) return t("Quedan {days} días para decidir.", { days });
  if (days === 1) return t("Queda 1 día para decidir.");
  return t("El plazo termina hoy.");
}

/** A calendar whose owner left: keep it or leave it before the deadline (RF-24 to RF-26). */
export function OrphanCalendarItem({
  calendar,
  daysLeft,
  keepAction,
  leaveAction,
}: {
  calendar: OrphanCalendar;
  daysLeft: number;
  keepAction: FormAction<ConfirmState>;
  leaveAction: FormAction<ConfirmState>;
}) {
  const t = useT();
  const [state, formAction, pending] = useActionState(keepAction, {});

  return (
    <li className="flex flex-col gap-3 rounded-card bg-paper p-4">
      <p className="flex min-w-0 items-center gap-2 font-semibold text-ink">
        <span
          aria-hidden="true"
          className="size-4 shrink-0 rounded-full ring-1 ring-pastel-ink/20"
          style={{ backgroundColor: calendar.color }}
        />
        <span className="min-w-0 break-words">{calendar.name}</span>
      </p>
      <p className="text-sm text-muted">
        {t("Su propietario borró su cuenta.")}
      </p>
      <p className="text-sm font-medium text-ink tabular-nums">
        {daysLeftText(daysLeft, t)}
      </p>
      {calendar.decision ? (
        <p className="text-sm text-ink">
          {t(
            "Has decidido conservarlo. Si nadie más lo conserva, pasará a ser tuyo; si otros también lo conservan, cada uno tendrá una copia.",
          )}
        </p>
      ) : null}
      <FormAlert message={state.formError} />
      <div className="flex flex-wrap gap-3">
        {calendar.decision ? null : (
          <form action={formAction}>
            <Button type="submit" disabled={pending}>
              {t("Conservar")}
            </Button>
          </form>
        )}
        <ConfirmDialog
          triggerLabel={t("Salir")}
          triggerAriaLabel={t("Salir de «{name}»", { name: calendar.name })}
          title={t("Salir de «{name}»", { name: calendar.name })}
          description={t(
            "Dejarás de ver este calendario y sus eventos, y no podrás volver a decidir.",
          )}
          confirmLabel={t("Salir del calendario")}
          action={leaveAction}
        />
      </div>
    </li>
  );
}
