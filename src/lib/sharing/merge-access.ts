export interface MergeMember {
  calendarId: string;
  userId: string;
  name: string;
  role: "owner" | "editor" | "viewer";
}

export interface MergeAccess {
  /** Lose access: they only belonged to calendars that disappear (RF-36). */
  losing: string[];
  /** Start seeing events of the other merged calendars (RF-37). */
  gaining: string[];
}

function uniqueNames(members: MergeMember[]): string[] {
  const byUser = new Map(members.map((m) => [m.userId, m.name]));
  return [...byUser.values()].sort((a, b) => a.localeCompare(b, "es"));
}

/**
 * Who is affected by merging `sourceIds` into `targetId` (null = a new
 * calendar, which starts with no members). The owner never appears: they own
 * every merged calendar (plan D15).
 */
export function getMergeAccess({
  sourceIds,
  targetId,
  members,
}: {
  sourceIds: string[];
  targetId: string | null;
  members: MergeMember[];
}): MergeAccess {
  const others = members.filter((m) => m.role !== "owner");
  const inTarget = new Set(
    others.filter((m) => m.calendarId === targetId).map((m) => m.userId),
  );

  const losing = others.filter(
    (m) =>
      sourceIds.includes(m.calendarId) &&
      m.calendarId !== targetId &&
      !inTarget.has(m.userId),
  );
  const gaining = others.filter((m) => m.calendarId === targetId);

  return { losing: uniqueNames(losing), gaining: uniqueNames(gaining) };
}
