"use client";

import { useState } from "react";
import {
  CalendarList,
  type CalendarListItem,
} from "@/components/dashboard/calendar-list";
import { FormAlert } from "@/components/ui/form-alert";
import type { GroupVisibility } from "@/lib/calendar/organize-groups";
import type { ConfirmState, FormState } from "@/lib/forms/form-state";
import { GroupSection } from "./group-section";

type GroupState = FormState<"name">;
type Result = { error?: string };

export interface GroupListSection {
  group: { id: string; name: string };
  visibility: GroupVisibility;
  calendars: CalendarListItem[];
}

/** The user's groups in "Mis calendarios", in their saved order (spec 007 RF-36, RF-38). */
export function GroupList({
  sections,
  timeZone,
  leaveAction,
  assignAction,
  renameAction,
  deleteAction,
  setVisibility,
  saveOrder,
}: {
  sections: GroupListSection[];
  timeZone: string;
  leaveAction: (calendarId: string) => Promise<ConfirmState>;
  assignAction: (calendarId: string, groupId: string | null) => Promise<Result>;
  renameAction: (
    id: string,
    prev: GroupState,
    formData: FormData,
  ) => Promise<GroupState>;
  deleteAction: (id: string) => Promise<ConfirmState>;
  setVisibility: (id: string, visible: boolean) => Promise<Result>;
  saveOrder: (order: {
    people: string[];
    groups: string[];
    calendars: Record<string, string[]>;
  }) => Promise<Result>;
}) {
  const [error, setError] = useState<string>();
  const groups = sections.map((section) => section.group);

  async function move(index: number, direction: "up" | "down") {
    const target = direction === "up" ? index - 1 : index + 1;
    const ids = groups.map((group) => group.id);
    [ids[index], ids[target]] = [ids[target]!, ids[index]!];
    setError(
      (await saveOrder({ people: [], groups: ids, calendars: {} })).error,
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <FormAlert message={error} />
      {sections.map((section, index) => (
        <GroupSection
          // The name in the key leaves edit mode after a saved rename.
          key={`${section.group.id}:${section.group.name}`}
          group={section.group}
          visibility={section.visibility}
          calendarCount={section.calendars.length}
          index={index}
          count={sections.length}
          setVisibility={(visible) => setVisibility(section.group.id, visible)}
          renameAction={renameAction.bind(null, section.group.id)}
          deleteAction={deleteAction.bind(null, section.group.id)}
          onMove={(direction) => void move(index, direction)}
        >
          <CalendarList
            calendars={section.calendars}
            timeZone={timeZone}
            leaveAction={leaveAction}
            groups={groups}
            assignAction={assignAction}
          />
        </GroupSection>
      ))}
    </div>
  );
}
