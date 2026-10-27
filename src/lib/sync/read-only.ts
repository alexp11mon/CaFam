import type { Database } from "@/types/database";

// Synced calendars are read-only in CaFam; the database refuses the writes
// anyway (RF-20, RF-21, RF-45, T2). These only decide what the screens offer.

export interface SyncedInfo {
  lastSyncedAt: string | null;
  /** Account it comes from; RLS shows it only to the owner (RF-26). */
  accountEmail: string | null;
}

interface CalendarAccess {
  role: Database["public"]["Enums"]["calendar_role"];
  synced: SyncedInfo | null;
}

/** Can create, edit or delete events in it (RF-20, RF-21). */
export function canWriteEvents(calendar: CalendarAccess): boolean {
  return calendar.role !== "viewer" && !calendar.synced;
}

/** Can be merged: owned and not synced (RF-45, RF-53 of spec 002). */
export function canMerge(calendar: CalendarAccess): boolean {
  return calendar.role === "owner" && !calendar.synced;
}
