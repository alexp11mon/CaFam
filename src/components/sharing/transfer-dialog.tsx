"use client";

import { useState } from "react";
import { ConfirmDialog } from "@/components/calendar/confirm-dialog";
import { Select } from "@/components/ui/select";
import { TextField } from "@/components/ui/text-field";
import type { ConfirmState, FormAction } from "@/lib/forms/form-state";

export interface TransferMember {
  userId: string;
  name: string;
  role: "editor" | "viewer";
}

const ROLE = { editor: "Editor", viewer: "Lector" } as const;

/**
 * "Traspasar a otro miembro" (spec 049 RF-7): picks a member and asks for the
 * calendar's name before giving it away.
 */
export function TransferDialog({
  calendarName,
  members,
  action,
}: {
  calendarName: string;
  members: TransferMember[];
  action: FormAction<ConfirmState>;
}) {
  const [to, setTo] = useState(members[0]?.userId ?? "");
  const [typed, setTyped] = useState("");
  const chosen = members.find((member) => member.userId === to);
  return (
    <ConfirmDialog
      triggerLabel="Traspasar a otro miembro"
      title={`¿Traspasar «${calendarName}»?`}
      description={`${chosen?.name ?? "Esa persona"} pasará a tener la propiedad de «${calendarName}». Tú serás Editor. Las invitaciones, el ID con PIN y los enlaces .ics dejarán de valer.`}
      confirmLabel="Sí, traspasar"
      action={action}
      confirmDisabled={!chosen || typed.trim() !== calendarName.trim()}
    >
      <Select
        label="Nuevo propietario"
        name="newOwner"
        value={to}
        onChange={(event) => setTo(event.target.value)}
      >
        {members.map((member) => (
          <option key={member.userId} value={member.userId}>
            {member.name} ({ROLE[member.role]})
          </option>
        ))}
      </Select>
      <TextField
        label={`Escribe «${calendarName}» para confirmar`}
        name="confirmName"
        autoComplete="off"
        onChange={(event) => setTyped(event.target.value)}
      />
    </ConfirmDialog>
  );
}
