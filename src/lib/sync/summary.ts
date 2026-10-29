import type { FailureKind } from "./providers/google";

// Spanish texts of an update (RF-18, RF-19, RF-23) and of its failures (RF-13,
// RF-31, RF-33).

export interface UpdateSummary {
  added: number;
  changed: number;
  removed: number;
  skipped?: number;
  omitted?: number;
}

function count(n: number, singular: string, plural: string) {
  return `${n} ${n === 1 ? singular : plural}`;
}

export function summaryText(summary: UpdateSummary): string {
  const parts = [
    `${count(summary.added, "añadido", "añadidos")}, ${count(summary.changed, "cambiado", "cambiados")} y ${count(summary.removed, "quitado", "quitados")}.`,
  ];
  if (summary.skipped) {
    parts.push(
      `${count(summary.skipped, "omitido", "omitidos")} por no ser válidos.`,
    );
  }
  if (summary.omitted) {
    parts.push(
      `${summary.omitted} más lejanos no se han traído por el límite de 2.000 eventos.`,
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
