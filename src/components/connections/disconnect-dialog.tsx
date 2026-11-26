import { ConfirmDialog } from "@/components/calendar/confirm-dialog";
import type { ConfirmState, FormAction } from "@/lib/forms/form-state";
import { providerName } from "@/lib/sync/provider-labels";
import type { ProviderName } from "@/lib/sync/providers/types";
import { T } from "@/components/i18n/locale-provider";

export interface DisconnectCalendar {
  name: string;
  /** People other than the owner who see it. */
  sharedWith: number;
}

/**
 * Disconnecting says what it affects and asks keep or delete, with nothing
 * chosen beforehand (RF-27 to RF-29).
 */
export function DisconnectDialog({
  email,
  calendars,
  action,
  provider = "google",
}: {
  email: string;
  provider?: ProviderName;
  calendars: DisconnectCalendar[];
  action: FormAction<ConfirmState>;
}) {
  const shared = calendars.filter((c) => c.sharedWith > 0);
  const count = calendars.length;
  const description =
    count === 0
      ? "La cuenta {email} no trae ningún calendario a CaFam. CaFam dejará de tener permiso en tu cuenta de {provider}."
      : count === 1
        ? "La cuenta {email} trae 1 calendario a CaFam. CaFam dejará de tener permiso en tu cuenta de {provider}."
        : "La cuenta {email} trae {count} calendarios a CaFam. CaFam dejará de tener permiso en tu cuenta de {provider}.";
  const name = providerName(provider);

  return (
    <ConfirmDialog
      triggerLabel="Desconectar"
      title="¿Desconectar la cuenta de {provider}?"
      description={description}
      vars={{ email, count, provider: name }}
      confirmLabel="Sí, desconectar"
      action={action}
    >
      {provider === "icloud" ? (
        <p>
          <T>
            {
              "En iCloud no se borra nada. CaFam no puede retirar su acceso por ti: cuando termines, revoca la contraseña específica de app en account.apple.com."
            }
          </T>
        </p>
      ) : null}
      {shared.length > 0 ? (
        <div className="flex flex-col gap-1">
          <p>
            <T>{"Están compartidos:"}</T>
          </p>
          <ul className="list-disc pl-5">
            {shared.map((calendar) => (
              <li key={calendar.name}>
                <T vars={{ name: calendar.name, count: calendar.sharedWith }}>
                  {calendar.sharedWith === 1
                    ? "«{name}», con 1 persona"
                    : "«{name}», con {count} personas"}
                </T>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {count > 0 ? (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 font-semibold">
            <T>{"¿Qué hacemos con sus calendarios?"}</T>
          </legend>
          <label className="flex min-h-11 items-center gap-3">
            <input
              type="radio"
              name="decision"
              value="keep"
              required
              className="size-5 shrink-0 accent-ink"
            />
            <T>{"Conservarlos como calendarios normales y editables"}</T>
          </label>
          <label className="flex min-h-11 items-center gap-3">
            <input
              type="radio"
              name="decision"
              value="delete"
              required
              className="size-5 shrink-0 accent-ink"
            />
            <T>
              {"Borrarlos con sus eventos, también para quien los comparte"}
            </T>
          </label>
        </fieldset>
      ) : null}
    </ConfirmDialog>
  );
}
