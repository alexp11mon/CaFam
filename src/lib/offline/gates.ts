// What works without a connection (spec 034 RF-17, RF-23 to RF-25, RF-35,
// plan D15): one table the components read with useConnection(). Pure.
import type { NavItem } from "@/lib/shell/nav";
// Only the type: series-write imports ical.js, which stays off the client (D2).
import type { SeriesScope } from "@/lib/recurrence/series-write";
import {
  canWriteEvents,
  moveTargets,
  readOnlyReason,
  type SyncedInfo,
} from "@/lib/sync/read-only";
import { OFFLINE_MESSAGES } from "./messages";

/** Why a destination is disabled, or null (RF-17). */
export function navReason(item: NavItem, online: boolean): string | null {
  return !online && item.needsNetwork ? OFFLINE_MESSAGES.needsNetwork : null;
}

/** The scopes of a change to an occurrence: offline, only this one (RF-23, D8). */
export function allowedScopes(online: boolean): readonly SeriesScope[] {
  return online ? ["this", "following", "all"] : ["this"];
}

/**
 * Why a series cannot be made, changed as a whole or split (RF-24), or why
 * a note cannot change between personal and shared (RF-35): the same reason.
 */
export function networkReason(online: boolean): string | null {
  return online ? null : OFFLINE_MESSAGES.needsNetwork;
}

const SERIES_SCOPES: readonly SeriesScope[] = ["this", "following", "all"];

// Spec 035: what the copy allows without a connection, with the same rules
// as with one.

type Role = "owner" | "editor" | "viewer";
interface CalendarGate {
  role: Role;
  synced: SyncedInfo | null;
}

/**
 * Whether events of a calendar can be written offline: synced ones too, by
 * whoever could with a connection (RF-1, RF-2).
 */
export function canWriteOffline(calendar: CalendarGate): boolean {
  return canWriteEvents(calendar);
}

/** Why a synced calendar stays read-only offline: the reasons of always (RF-2). */
export function offlineReadOnly(calendar: CalendarGate) {
  return readOnlyReason(calendar.synced, true);
}

/** Where an event may move offline: within the same account, as online (RF-3). */
export function offlineMoveTargets<T extends CalendarGate>(
  source: CalendarGate,
  calendars: T[],
): T[] {
  return moveTargets(source, calendars);
}

/** "Repetir" and the three scopes: normal calendars only (RF-10, RF-11, RF-16). */
export function seriesOffline(calendar: CalendarGate): {
  scopes: readonly SeriesScope[];
  repeat: boolean;
} {
  return calendar.synced
    ? { scopes: ["this"], repeat: false }
    : { scopes: SERIES_SCOPES, repeat: true };
}

/** Only the author edits a comment (RF-23). */
export function canEditComment(
  comment: { authorId: string | null },
  userId: string,
): boolean {
  return comment.authorId !== null && comment.authorId === userId;
}

/** The author or the owner of the calendar delete a comment (RF-24). */
export function canDeleteComment(
  comment: { authorId: string | null },
  userId: string,
  role: Role,
): boolean {
  return canEditComment(comment, userId) || role === "owner";
}

/** Who uploaded it, the owner and the Editors delete an image (RF-36). */
export function canDeleteImage(
  image: { uploadedBy: string | null },
  userId: string,
  role: Role,
): boolean {
  return image.uploadedBy === userId || role !== "viewer";
}
