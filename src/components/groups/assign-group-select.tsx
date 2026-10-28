"use client";

import { useState, useTransition } from "react";
import { Select } from "@/components/ui/select";

type Result = { error?: string };

/** Moves a calendar to one of the user's groups or out of it (spec 007 RF-36, RF-37). */
export function AssignGroupSelect({
  calendarName,
  groupId,
  groups,
  action,
}: {
  calendarName: string;
  groupId: string | null;
  groups: { id: string; name: string }[];
  action: (groupId: string | null) => Promise<Result>;
}) {
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  return (
    <Select
      label={`Grupo de ${calendarName}`}
      name="groupId"
      value={groupId ?? ""}
      disabled={pending}
      error={error}
      onChange={(event) => {
        const next = event.target.value || null;
        startTransition(async () => {
          setError((await action(next)).error);
        });
      }}
    >
      <option value="">Sin grupo</option>
      {groups.map((group) => (
        <option key={group.id} value={group.id}>
          {group.name}
        </option>
      ))}
    </Select>
  );
}
