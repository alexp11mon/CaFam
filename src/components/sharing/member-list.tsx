"use client";

import { useActionState } from "react";
import { ConfirmDialog } from "@/components/calendar/confirm-dialog";
import { Avatar } from "@/components/people/avatar";
import { Button } from "@/components/ui/button";
import { FormAlert } from "@/components/ui/form-alert";
import { Select } from "@/components/ui/select";
import type { ConfirmState, FormAction } from "@/lib/forms/form-state";
import { assignTints } from "@/lib/people/avatar";
import { ROLE_LABELS } from "@/lib/sharing/roles";
import { StaggerList } from "@/components/ui/stagger-list";
import { SwapLabel } from "@/components/ui/swap-label";

export interface MemberItem {
  userId: string;
  name: string;
  role: "owner" | "editor" | "viewer";
}

interface MemberListProps {
  members: MemberItem[];
  currentUserId: string;
  changeRoleAction: (
    userId: string,
    prev: ConfirmState,
    formData: FormData,
  ) => Promise<ConfirmState>;
  expelAction: (userId: string) => Promise<ConfirmState>;
  leaveAction: FormAction<ConfirmState>;
}

function RoleForm({
  member,
  action,
}: {
  member: MemberItem;
  action: MemberListProps["changeRoleAction"];
}) {
  const [state, formAction, pending] = useActionState(
    action.bind(null, member.userId),
    {},
  );

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      <FormAlert message={state.formError} />
      <Select
        label={`Rol de ${member.name}`}
        name="role"
        defaultValue={member.role}
      >
        <option value="viewer">{ROLE_LABELS.viewer}</option>
        <option value="editor">{ROLE_LABELS.editor}</option>
      </Select>
      <Button
        type="submit"
        variant="secondary"
        disabled={pending}
        aria-label={`Guardar rol de ${member.name}`}
      >
        <SwapLabel busy={pending} idle="Guardar rol" busyText="Guardando…" />
      </Button>
    </form>
  );
}

/**
 * Members with name and role, never email (RF-24). The owner changes roles and
 * expels others (RF-25, RF-26); everyone else can leave (RF-27). The owner has
 * no controls over their own row (RF-28).
 */
export function MemberList({
  members,
  currentUserId,
  changeRoleAction,
  expelAction,
  leaveAction,
}: MemberListProps) {
  const isOwner = members.some(
    (member) => member.userId === currentUserId && member.role === "owner",
  );

  // Assigned in id order, so a person keeps the tint of the other lists (spec 023 RF-29).
  const tints = assignTints(members.map((member) => member.userId));

  return (
    <div className="flex flex-col gap-6">
      <StaggerList className="flex flex-col gap-3">
        {members.map((member) => (
          <li
            key={member.userId}
            className="flex flex-col gap-3 rounded-3xl bg-paper p-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="flex min-w-0 items-center gap-3">
                <Avatar name={member.name} tint={tints.get(member.userId)!} />
                <span className="min-w-0 break-words font-semibold text-ink">
                  {member.name}
                </span>
              </span>
              {isOwner && member.role !== "owner" ? null : (
                <span className="shrink-0 rounded-full bg-stone px-2.5 py-0.5 text-sm font-medium text-ink">
                  {ROLE_LABELS[member.role]}
                </span>
              )}
            </div>
            {isOwner && member.role !== "owner" ? (
              <div className="flex flex-wrap items-end justify-between gap-3">
                <RoleForm member={member} action={changeRoleAction} />
                <ConfirmDialog
                  triggerLabel="Expulsar"
                  triggerAriaLabel={`Expulsar a ${member.name}`}
                  title={`¿Expulsar a ${member.name}?`}
                  description="Perderá el acceso al calendario. Los eventos que creó se quedan."
                  confirmLabel="Sí, expulsar"
                  action={expelAction.bind(null, member.userId)}
                />
              </div>
            ) : null}
          </li>
        ))}
      </StaggerList>
      {isOwner ? null : (
        <div>
          <ConfirmDialog
            triggerLabel="Salir"
            title="¿Salir de este calendario?"
            description="Dejarás de verlo. Los eventos que creaste se quedan, y solo podrás volver con una invitación nueva."
            confirmLabel="Sí, salir"
            action={leaveAction}
          />
        </div>
      )}
    </div>
  );
}
