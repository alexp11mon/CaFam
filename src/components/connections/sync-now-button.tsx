"use client";

import { useActionState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { FormAlert } from "@/components/ui/form-alert";
import type { FormAction } from "@/lib/forms/form-state";
import { SwapLabel } from "@/components/ui/swap-label";
import { usePulseOn } from "@/lib/hooks/use-pulse-on";

interface SyncNowState {
  message?: string;
  formError?: string;
  /** The accounts were read: not the "wait" message. */
  updated?: boolean;
}

/** "Actualizar ahora" with the summary or the wait announced (RF-23, RF-24). */
export function SyncNowButton({
  action,
}: {
  action: FormAction<SyncNowState>;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const button = useRef<HTMLButtonElement>(null);
  usePulseOn(button, state.updated && state);

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <Button
        ref={button}
        type="submit"
        variant="secondary"
        disabled={pending}
        className="self-start"
      >
        <SwapLabel
          busy={pending}
          idle="Actualizar ahora"
          busyText="Actualizando…"
        />
      </Button>
      <FormAlert message={state.formError} />
      <p role="status" className="text-sm text-ink empty:hidden">
        {state.message}
      </p>
    </form>
  );
}
