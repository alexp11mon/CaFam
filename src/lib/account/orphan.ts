// Deadline of a calendar without owner (spec 006, RF-21, RF-26). Pure: the
// caller passes "now", so Server Components do not read the clock in their body.

const DAY_MS = 24 * 60 * 60 * 1000;
export const ORPHAN_DAYS = 15;

/** When the members' decision is applied at the latest. */
export function orphanDeadline(orphanedAt: string): Date {
  return new Date(Date.parse(orphanedAt) + ORPHAN_DAYS * DAY_MS);
}

/** Whole days left until the deadline; a started day counts as one, 0 once it has passed. */
export function daysLeft(orphanedAt: string, now: number): number {
  const remaining = orphanDeadline(orphanedAt).getTime() - now;
  return remaining > 0 ? Math.ceil(remaining / DAY_MS) : 0;
}

/** daysLeft from the current time, for Server Components (React lint forbids Date.now() there). */
export function daysLeftNow(orphanedAt: string): number {
  return daysLeft(orphanedAt, Date.now());
}
