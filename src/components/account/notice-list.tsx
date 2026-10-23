"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { FormAlert } from "@/components/ui/form-alert";
import type { AccountNotice } from "@/lib/account/queries";
import type { ConfirmState } from "@/lib/forms/form-state";

type DismissAction = (noticeId: string) => Promise<ConfirmState>;

function noticeText(notice: AccountNotice): string {
  switch (notice.kind) {
    case "orphaned":
      return `${notice.personName || "Una persona"} ha eliminado su cuenta. El calendario «${notice.calendarName}» se queda sin propietario: decide si lo conservas o sales de él.`;
    case "kept_copy":
      return `Ya tienes tu copia de «${notice.calendarName}» en tu lista.`;
    case "deleted_calendar":
      return `El calendario «${notice.calendarName}» se ha eliminado porque nadie decidió conservarlo.`;
  }
}

function NoticeItem({
  notice,
  dismissAction,
}: {
  notice: AccountNotice;
  dismissAction: DismissAction;
}) {
  const [state, formAction, pending] = useActionState(
    dismissAction.bind(null, notice.id),
    {},
  );

  return (
    <li className="flex flex-col gap-3 rounded-2xl bg-paper p-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex min-w-0 flex-col gap-2">
        <p className="break-words text-ink">{noticeText(notice)}</p>
        <FormAlert message={state.formError} />
      </div>
      <form action={formAction} className="shrink-0">
        <Button
          type="submit"
          variant="secondary"
          disabled={pending}
          aria-label={`Cerrar aviso sobre «${notice.calendarName}»`}
        >
          Cerrar
        </Button>
      </form>
    </li>
  );
}

/** Account notices: someone left, a copy is ready, a calendar was deleted (spec 006, RF-23). */
export function NoticeList({
  notices,
  dismissAction,
}: {
  notices: AccountNotice[];
  dismissAction: DismissAction;
}) {
  if (notices.length === 0) return null;
  return (
    <ul className="flex flex-col gap-3">
      {notices.map((notice) => (
        <NoticeItem
          key={notice.id}
          notice={notice}
          dismissAction={dismissAction}
        />
      ))}
    </ul>
  );
}
