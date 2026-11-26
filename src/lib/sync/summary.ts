import { providerName } from "./provider-labels";
import type { FailureKind, ProviderName } from "./providers/types";
import { spanishT, type T } from "@/lib/i18n/translate";

// Spanish texts of an update (RF-18, RF-19, RF-23) and of its failures (RF-13,
// RF-31, RF-33).

export interface UpdateSummary {
  added: number;
  changed: number;
  removed: number;
  skipped?: number;
  omitted?: number;
}

export function summaryText(summary: UpdateSummary, t: T = spanishT): string {
  const n = (count: number, one: string, many: string) =>
    count === 1 ? t(one) : t(many, { count });
  const parts = [
    t("{added}, {changed} y {removed}.", {
      added: n(summary.added, "1 añadido", "{count} añadidos"),
      changed: n(summary.changed, "1 cambiado", "{count} cambiados"),
      removed: n(summary.removed, "1 quitado", "{count} quitados"),
    }),
  ];
  if (summary.skipped) {
    parts.push(
      n(
        summary.skipped,
        "1 omitido por no ser válido.",
        "{count} omitidos por no ser válidos.",
      ),
    );
  }
  if (summary.omitted) {
    parts.push(
      t(
        "{count} más lejanos no se han traído por el límite de 2.000 eventos.",
        { count: summary.omitted },
      ),
    );
  }
  return parts.join(" ");
}

// sync_fail stores only these: a refused read counts as transient (spec 009).
export const SYNC_ERRORS: Record<Exclude<FailureKind, "rejected">, string> = {
  transient:
    "La última actualización falló. Se volverá a intentar en la siguiente.",
  revoked:
    "Google ha retirado el permiso de CaFam. Vuelve a conectar la cuenta para seguir actualizando.",
  missing: "Este calendario ya no existe en la cuenta de Google.",
};

/** The same texts naming the account's provider (spec 018 RF-19, RF-61, RF-62). */
export function syncErrorText(
  kind: Exclude<FailureKind, "rejected">,
  provider: ProviderName,
  t: T = spanishT,
): string {
  if (provider === "google") return t(SYNC_ERRORS[kind]);
  if (kind === "revoked") {
    return t(
      "iCloud ya no acepta la contraseña de esta cuenta. Pasa al cambiar la contraseña del Apple ID o al revocarla: vuelve a conectarla con una contraseña específica de app nueva.",
    );
  }
  if (kind === "missing") {
    return t("Este calendario ya no existe en la cuenta de {provider}.", {
      provider: providerName(provider),
    });
  }
  return t(SYNC_ERRORS.transient);
}
