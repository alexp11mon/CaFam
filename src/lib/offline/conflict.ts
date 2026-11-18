// Conflicts by comparing three versions: the copy the change was made on
// (base), the user's (mine) and the server's now (spec 034 RF-41, RF-50 to
// RF-55, plan D5). Pure, shared by the server action and the browser.
//
// - server equals mine: already applied (a resend, RF-41);
// - server equals base: nobody else touched it, apply;
// - otherwise someone else changed it: ask.

import type { SeriesBase } from "./outbox";

export type Verdict = "applied" | "apply" | "conflict";

type Fields = Record<string, unknown>;

const TIME_KEYS = new Set(["startsAt", "endsAt"]);

/** Same instant whatever the format ("…Z" or "…+00:00"); null and "" alike. */
function equal(key: string, a: unknown, b: unknown): boolean {
  if (TIME_KEYS.has(key) && typeof a === "string" && typeof b === "string") {
    return Date.parse(a) === Date.parse(b);
  }
  return (a ?? null) === (b ?? null) || (a ?? "") === (b ?? "");
}

/**
 * Whether two versions agree on the keys of `shape`. A key the base does not
 * know (undefined, the description of a partial event, plan R6) is left out.
 */
export function same(shape: Fields, a: Fields, b: Fields): boolean {
  return Object.keys(shape)
    .filter((key) => shape[key] !== undefined)
    .every((key) => equal(key, a[key], b[key]));
}

/** A change to something that still exists on the server. */
export function verdict(base: Fields, mine: Fields, server: Fields): Verdict {
  if (same(base, server, mine)) return "applied";
  if (same(base, server, base)) return "apply";
  return "conflict";
}

/**
 * A change to something that may be gone. Changing what someone else
 * deleted is a conflict (RF-51, RF-55); deleting it is already done.
 */
export function verdictOrGone(
  base: Fields,
  mine: Fields | null,
  server: Fields | null,
): Verdict {
  if (server === null) return mine === null ? "applied" : "conflict";
  if (mine === null) {
    // A delete: fine unless someone changed it meanwhile (RF-52).
    return same(base, server, base) ? "apply" : "conflict";
  }
  return verdict(base, mine, server);
}

/** A create sent again: done when the row already is what was sent (RF-41). */
export function createVerdict(mine: Fields, server: Fields | null): Verdict {
  if (server === null) return "apply";
  return same(mine, server, mine) ? "applied" : "conflict";
}

const instant = (value: string | null) =>
  value === null ? null : Date.parse(value);

/**
 * Whether a series is as the copy had it: its fields, rule, deleted dates and
 * what hangs from its exceptions (spec 035 RF-14, RF-15, plan D3).
 */
/** A series' base; its fields as the change was validated (description may be unknown). */
type SeriesLike = Omit<SeriesBase, "fields"> & { fields: object };

export function sameSeries(base: SeriesLike, now: SeriesLike): boolean {
  const dates = (list: string[]) =>
    list
      .map((date) => Date.parse(date))
      .sort((a, b) => a - b)
      .join();
  return (
    same(
      base.fields as unknown as Fields,
      base.fields as unknown as Fields,
      now.fields as unknown as Fields,
    ) &&
    base.recurrence === now.recurrence &&
    dates(base.exdates) === dates(now.exdates) &&
    base.totals.exceptions === now.totals.exceptions &&
    base.totals.images === now.totals.images &&
    base.totals.comments === now.totals.comments &&
    instant(base.totals.latest) === instant(now.totals.latest)
  );
}
