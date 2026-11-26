import { ConfirmDialog } from "@/components/calendar/confirm-dialog";
import type { ConfirmState } from "@/lib/forms/form-state";
import { ROLE_LABELS } from "@/lib/sharing/roles";
import { T } from "@/components/i18n/locale-provider";

export interface InviteItem {
  id: string;
  role: "editor" | "viewer";
  maxUses: number;
  useCount: number;
  expiresAt: string;
}

const DAY_MS = 86_400_000;

function expiryLabel(expiresAt: string, now: number) {
  const days = Math.max(1, Math.ceil((Date.parse(expiresAt) - now) / DAY_MS));
  return (
    <T vars={{ days }}>
      {days === 1 ? "Caduca en 1 día" : "Caduca en {days} días"}
    </T>
  );
}

/**
 * Valid invites of a calendar with role, remaining uses and expiry, and a way
 * to revoke each one (RF-11, RF-12). `now` comes from the server so the
 * rendering is the same on both sides.
 */
export function InviteList({
  invites,
  now,
  revokeAction,
}: {
  invites: InviteItem[];
  now: string;
  revokeAction: (id: string) => Promise<ConfirmState>;
}) {
  const current = Date.parse(now);
  const valid = invites.filter(
    (invite) =>
      Date.parse(invite.expiresAt) > current &&
      invite.useCount < invite.maxUses,
  );

  if (valid.length === 0) {
    return (
      <p className="rounded-card bg-paper px-4 py-6 text-center text-ink">
        <T>{"No hay invitaciones vigentes."}</T>
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {valid.map((invite) => (
        <li
          key={invite.id}
          className="flex flex-wrap items-center justify-between gap-3 rounded-card bg-paper p-4"
        >
          <div className="flex min-w-0 flex-col gap-1 text-ink">
            <span className="font-semibold">
              <T>{ROLE_LABELS[invite.role]}</T>
            </span>
            <span className="text-sm text-muted tabular-nums">
              <T>{"Usos restantes:"}</T> {invite.maxUses - invite.useCount}{" "}
              <T vars={{ maxUses: invite.maxUses }}>{"de {maxUses}"}</T>
            </span>
            <span className="text-sm text-muted tabular-nums">
              {expiryLabel(invite.expiresAt, current)}
            </span>
          </div>
          <ConfirmDialog
            triggerLabel="Revocar"
            triggerAriaLabel="Revocar invitación de {role}"
            vars={{ role: ROLE_LABELS[invite.role] }}
            title="¿Revocar esta invitación?"
            description="El enlace dejará de funcionar de inmediato. Quienes ya se unieron con él mantienen su acceso."
            confirmLabel="Sí, revocar"
            action={revokeAction.bind(null, invite.id)}
          />
        </li>
      ))}
    </ul>
  );
}
