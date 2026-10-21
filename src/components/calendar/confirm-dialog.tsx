"use client";

import { useActionState, useId, useRef } from "react";
import { Button } from "@/components/ui/button";
import { FormAlert } from "@/components/ui/form-alert";
import type { ConfirmState, FormAction } from "@/lib/forms/form-state";

/**
 * Explicit confirmation before a destructive action (RF-6, RF-24, RF-52).
 * Native <dialog>: focus trap, Escape and backdrop come for free.
 */
export function ConfirmDialog({
  triggerLabel,
  title,
  description,
  confirmLabel,
  action,
}: {
  triggerLabel: string;
  title: string;
  description: string;
  confirmLabel: string;
  action: FormAction<ConfirmState>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [state, formAction, pending] = useActionState(action, {});

  return (
    <>
      <Button
        variant="danger"
        onClick={() => dialog.current?.showModal()}
        aria-haspopup="dialog"
      >
        {triggerLabel}
      </Button>
      <dialog
        ref={dialog}
        aria-labelledby={titleId}
        className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border border-ink/20 bg-white p-6 text-ink backdrop:bg-ink/50"
      >
        <form action={formAction} className="flex flex-col gap-4">
          <h2 id={titleId} className="text-lg font-bold">
            {title}
          </h2>
          <p>{description}</p>
          <FormAlert message={state.formError} />
          <div className="flex flex-wrap justify-end gap-3">
            <Button variant="secondary" onClick={() => dialog.current?.close()}>
              Cancelar
            </Button>
            <Button type="submit" variant="danger" disabled={pending}>
              {confirmLabel}
            </Button>
          </div>
        </form>
      </dialog>
    </>
  );
}
