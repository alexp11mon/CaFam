// What works without a connection (spec 034 RF-17, RF-23 to RF-25, RF-35,
// plan D15): one table the components read with useConnection(). Pure.
import type { NavItem } from "@/lib/shell/nav";
import type { SeriesScope } from "@/lib/recurrence/series-write";
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
