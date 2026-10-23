"use client";

import { useActionState, useEffect, useId, useRef } from "react";
import { Button } from "@/components/ui/button";
import { FormAlert } from "@/components/ui/form-alert";
import type { ConfirmState, Done, FormAction } from "@/lib/forms/form-state";

/**
 * Explicit confirmation before a destructive action (RF-6, RF-24, RF-52).
 * Native <dialog>: focus trap, Escape and backdrop come for free.
 */
export function ConfirmDialog({
  triggerLabel,
  triggerAriaLabel,
  title,
  description,
  confirmLabel,
  action,
  children,
  confirmDisabled = false,
  onDone,
}: {
  triggerLabel: string;
  /** Longer accessible name when several triggers share the same visible label. */
  triggerAriaLabel?: string;
  title: string;
  description: string;
  confirmLabel: string;
  action: FormAction<ConfirmState>;
  /** Extra fields the action needs, e.g. a password (spec 006, RF-16). */
  children?: React.ReactNode;
  confirmDisabled?: boolean;
  /** The action succeeded without redirecting, e.g. inside the event window (spec 008 RF-8). */
  onDone?: (done: Done) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [state, formAction, pending] = useActionState(action, {});

  // Effects run again each time Next shows a kept route (Activity): handle each result once.
  const handled = useRef<ConfirmState | null>(null);
  useEffect(() => {
    if (!state.done || handled.current === state) return;
    handled.current = state;
    dialog.current?.close();
    onDone?.(state.done);
  }, [state, onDone]);

  return (
    <>
      <Button
        variant="danger"
        onClick={() => dialog.current?.showModal()}
        aria-haspopup="dialog"
        aria-label={triggerAriaLabel}
      >
        {triggerLabel}
      </Button>
      <dialog
        ref={dialog}
        aria-labelledby={titleId}
        className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl bg-paper p-6 text-ink shadow-xl backdrop:bg-ink/50"
      >
        <form action={formAction} className="flex flex-col gap-4">
          <h2 id={titleId} className="text-lg font-bold">
            {title}
          </h2>
          <p>{description}</p>
          {children}
          <FormAlert message={state.formError} />
          <div className="flex flex-wrap justify-end gap-3">
            <Button variant="secondary" onClick={() => dialog.current?.close()}>
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="danger"
              disabled={pending || confirmDisabled}
            >
              {confirmLabel}
            </Button>
          </div>
        </form>
      </dialog>
    </>
  );
}
