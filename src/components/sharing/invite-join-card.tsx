"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { LinkButton } from "@/components/ui/link-button";
import { FormAlert } from "@/components/ui/form-alert";
import type { ConfirmState, FormAction } from "@/lib/forms/form-state";
import { SHARING_MESSAGES } from "@/lib/sharing/error-messages";
import type { InvitePreview } from "@/lib/sharing/queries";
import { ROLE_LABELS } from "@/lib/sharing/roles";

/** Preview of an invite and the "Unirme" button (RF-5, RF-6, RF-8, RF-9). */
export function InviteJoinCard({
  preview,
  acceptAction,
}: {
  preview: InvitePreview | null;
  acceptAction: FormAction<ConfirmState>;
}) {
  const [state, formAction, pending] = useActionState(acceptAction, {});

  if (!preview) {
    return (
      <div className="flex flex-col gap-4">
        <p role="alert" className="text-ink">
          {SHARING_MESSAGES.invalidInvite}
        </p>
        <Link
          href="/dashboard/calendar"
          className="inline-flex min-h-11 items-center font-semibold text-ink underline decoration-control underline-offset-4 hover:decoration-ink"
        >
          Ir al calendario
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 text-ink">
      <dl className="flex flex-col gap-3 rounded-3xl bg-paper p-4">
        <div>
          <dt className="text-sm">Calendario</dt>
          <dd className="min-w-0 break-words text-lg font-bold">
            {preview.calendarName}
          </dd>
        </div>
        <div>
          <dt className="text-sm">Propietario</dt>
          <dd className="min-w-0 break-words font-semibold">
            {preview.ownerName}
          </dd>
        </div>
        <div>
          <dt className="text-sm">Tu rol</dt>
          <dd className="font-semibold">{ROLE_LABELS[preview.role]}</dd>
        </div>
      </dl>
      {preview.alreadyMember ? (
        <>
          <p>
            Ya eres miembro de este calendario. No se ha gastado ningún uso.
          </p>
          <div>
            <LinkButton href="/dashboard/calendar">Ir al calendario</LinkButton>
          </div>
        </>
      ) : (
        <form action={formAction} className="flex flex-col gap-4">
          <FormAlert message={state.formError} />
          <div>
            <Button type="submit" disabled={pending}>
              {pending ? "Uniéndote…" : "Unirme"}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
