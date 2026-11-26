"use client";

import { useActionState } from "react";
import { ConfirmDialog } from "@/components/calendar/confirm-dialog";
import { Button } from "@/components/ui/button";
import { BUTTON_BASE, BUTTON_VARIANTS } from "@/components/ui/button-styles";
import { FormAlert } from "@/components/ui/form-alert";
import { SwapLabel } from "@/components/ui/swap-label";
import type { ConfirmState, FormAction } from "@/lib/forms/form-state";
import { CopyButton } from "./copy-button";
import { useT } from "@/components/i18n/locale-provider";

export interface FeedState {
  formError?: string;
  /** The link, shown once right after creating it (RF-8). */
  url?: string;
}

export const FEED_WARNING =
  "Cualquiera con este enlace verá todos los eventos del calendario. No se puede limitar a una persona.";

const LINK_BUTTON = `${BUTTON_BASE} ${BUTTON_VARIANTS.secondary}`;

/** The secret .ics subscription link of a calendar (spec 043 RF-7, RF-8, RF-12). */
export function IcsFeedPanel({
  active,
  createAction,
  disableAction,
}: {
  active: boolean;
  createAction: FormAction<FeedState>;
  disableAction: FormAction<ConfirmState>;
}) {
  const t = useT();
  const [state, formAction, pending] = useActionState(createAction, {});
  const webcal = state.url?.replace(/^https?:\/\//, "webcal://");

  return (
    <div className="flex flex-col gap-4">
      <p className="text-ink">
        {t(
          "Para ver este calendario en Google Calendar, Apple Calendar u Outlook sin conectar una cuenta. Es de solo lectura y esas apps lo actualizan cada pocas horas (Google puede tardar hasta un día).",
        )}
      </p>
      <p className="rounded-card bg-accent-soft p-3 text-sm text-accent-ink">
        {FEED_WARNING}
      </p>
      <FormAlert message={state.formError} />
      {state.url && webcal && active ? (
        <div className="flex flex-col gap-3 rounded-card bg-paper p-4">
          <p className="text-sm text-muted">
            {t("Guárdalo ahora: no se puede volver a ver.")}
          </p>
          <input
            readOnly
            value={state.url}
            aria-label={t("Enlace de suscripción")}
            onFocus={(event) => event.currentTarget.select()}
            className="w-full rounded-control border border-control bg-paper px-3 py-2 text-base text-ink"
          />
          <CopyButton text={state.url} />
          <div className="flex flex-wrap gap-2">
            <a
              href={`https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcal)}`}
              target="_blank"
              rel="noreferrer"
              className={LINK_BUTTON}
            >
              {t("Abrir en Google Calendar")}
            </a>
            <a href={webcal} className={LINK_BUTTON}>
              {t("Abrir en Apple Calendar")}
            </a>
          </div>
        </div>
      ) : active ? (
        <p className="text-ink">
          {t(
            "Hay un enlace activo. Por seguridad no se puede volver a ver: si lo necesitas, crea uno nuevo y el anterior dejará de funcionar.",
          )}
        </p>
      ) : null}
      <form action={formAction} className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending}>
          <SwapLabel
            busy={pending}
            idle={active ? "Crear uno nuevo" : "Crear enlace"}
            busyText={t("Creando…")}
          />
        </Button>
      </form>
      {active ? (
        <div>
          <ConfirmDialog
            triggerLabel={t("Desactivar")}
            triggerAriaLabel={t("Desactivar el enlace de suscripción")}
            title={t("¿Desactivar el enlace de suscripción?")}
            description={t(
              "Las apps que lo usan dejarán de recibir los eventos. Podrás crear uno nuevo cuando quieras.",
            )}
            confirmLabel={t("Sí, desactivar")}
            action={disableAction}
          />
        </div>
      ) : null}
    </div>
  );
}
