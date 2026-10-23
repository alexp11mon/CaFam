"use client";

import { useActionState } from "react";
import { ConfirmDialog } from "@/components/calendar/confirm-dialog";
import { Button } from "@/components/ui/button";
import { FormAlert } from "@/components/ui/form-alert";
import type { OrphanCalendar } from "@/lib/account/queries";
import type { ConfirmState, FormAction } from "@/lib/forms/form-state";

function daysLeftText(days: number): string {
  if (days > 1) return `Quedan ${days} días para decidir.`;
  if (days === 1) return "Queda 1 día para decidir.";
  return "El plazo termina hoy.";
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
  const [state, formAction, pending] = useActionState(keepAction, {});

  return (
    <li className="flex flex-col gap-3 rounded-2xl bg-paper p-4">
      <p className="flex min-w-0 items-center gap-2 font-semibold text-ink">
        <span
          aria-hidden="true"
          className="size-4 shrink-0 rounded-full ring-1 ring-ink/15"
          style={{ backgroundColor: calendar.color }}
        />
        <span className="min-w-0 break-words">{calendar.name}</span>
      </p>
      <p className="text-sm text-muted">Su propietario borró su cuenta.</p>
      <p className="text-sm font-medium text-ink tabular-nums">
        {daysLeftText(daysLeft)}
      </p>
      {calendar.decision ? (
        <p className="text-sm text-ink">
          Has decidido conservarlo. Si nadie más lo conserva, pasará a ser tuyo;
          si otros también lo conservan, cada uno tendrá una copia.
        </p>
      ) : null}
      <FormAlert message={state.formError} />
      <div className="flex flex-wrap gap-3">
        {calendar.decision ? null : (
          <form action={formAction}>
            <Button type="submit" disabled={pending}>
              Conservar
            </Button>
          </form>
        )}
        <ConfirmDialog
          triggerLabel="Salir"
          triggerAriaLabel={`Salir de «${calendar.name}»`}
          title={`Salir de «${calendar.name}»`}
          description="Dejarás de ver este calendario y sus eventos, y no podrás volver a decidir."
          confirmLabel="Salir del calendario"
          action={leaveAction}
        />
      </div>
    </li>
  );
}
