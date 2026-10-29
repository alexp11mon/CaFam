import type { Database } from "@/types/database";
import type { GoogleAccess } from "./providers/google";

// What the screens offer in synced calendars; the database decides anyway
// (spec 007 T2, spec 009 T3). Since spec 009 they are writable when the
// account can write (RF-6 to RF-9, RF-20).

export interface SyncedInfo {
  lastSyncedAt: string | null;
  /** Account it comes from; RLS shows it only to the owner (RF-26 of 007). */
  accountEmail: string | null;
  /** Calendars of one account share it: events only move among them (RF-19). */
  connectionId: string;
  /** The database's can_write_synced (plan D11). */
  canWrite: boolean;
  googleAccess: GoogleAccess | null;
}

interface CalendarAccess {
  role: Database["public"]["Enums"]["calendar_role"];
  synced: SyncedInfo | null;
}

/** Can create, edit or delete events in it (RF-6, RF-7, RF-9). */
export function canWriteEvents(calendar: CalendarAccess): boolean {
  return (
    calendar.role !== "viewer" && (!calendar.synced || calendar.synced.canWrite)
  );
}

/** Can be merged: owned and not synced (RF-45 of 007, RF-53 of spec 002). */
export function canMerge(calendar: CalendarAccess): boolean {
  return calendar.role === "owner" && !calendar.synced;
}

/** Where an event of `source` may go: same kind and, if synced, same account (RF-19, RF-20). */
export function moveTargets<T extends CalendarAccess>(
  source: CalendarAccess,
  calendars: T[],
): T[] {
  return calendars.filter(
    (calendar) =>
      canWriteEvents(calendar) &&
      (source.synced
        ? calendar.synced?.connectionId === source.synced.connectionId
        : !calendar.synced),
  );
}

/** Why a synced calendar is read-only: Google allows only reading, or the account must reconnect (RF-3, RF-8). */
export function readOnlyReason(
  synced: SyncedInfo | null,
): "google" | "reconnect" | null {
  if (!synced || synced.canWrite) return null;
  return synced.googleAccess === "reader" ? "google" : "reconnect";
}
