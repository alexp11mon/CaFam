// Who created an event, as shown in its detail (spec 006, RF-34 to RF-36).
// created_by turns null when the author deletes the account (RF-20).

export const DELETED_ACCOUNT = "Cuenta borrada";
export const FORMER_MEMBER = "un antiguo miembro";

/** Name of the author among the calendar members, or the text for a gone author. */
export function authorLabel(
  createdBy: string | null,
  members: readonly { userId: string; name: string }[],
): string {
  if (createdBy === null) return DELETED_ACCOUNT;
  // Someone who left the calendar is no longer visible to its members (RF-36).
  return (
    members.find((member) => member.userId === createdBy)?.name ?? FORMER_MEMBER
  );
}
