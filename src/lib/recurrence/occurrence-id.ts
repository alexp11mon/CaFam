// An occurrence without its own row is named after its series and original
// start, like Google's instance ids: "<uuid>_<YYYYMMDDTHHMMSSZ>" (plan
// "occurrence-id"). Pure: links of the views and the detail use it.

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const EVENT = new RegExp(`^${UUID}$`, "i");
const OCCURRENCE = new RegExp(
  `^(${UUID})_(\\d{4})(\\d{2})(\\d{2})T(\\d{2})(\\d{2})(\\d{2})Z$`,
  "i",
);

export type ParsedEventId =
  | { kind: "event"; id: string }
  | { kind: "occurrence"; seriesId: string; originalStart: string };

export function occurrenceId(seriesId: string, originalStart: string): string {
  const stamp = new Date(originalStart)
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
  return `${seriesId}_${stamp}`;
}

export function parseEventId(id: string): ParsedEventId | null {
  if (EVENT.test(id)) return { kind: "event", id };
  const match = OCCURRENCE.exec(id);
  if (!match) return null;
  const [, seriesId, year, month, day, hour, minute, second] = match;
  const iso = `${year}-${month}-${day}T${hour}:${minute}:${second}.000Z`;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime()) || date.toISOString() !== iso) return null;
  return { kind: "occurrence", seriesId: seriesId!, originalStart: iso };
}
