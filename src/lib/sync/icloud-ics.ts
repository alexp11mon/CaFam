import ICAL from "ical.js";
import { utcToZonedParts } from "@/lib/calendar/time-zone";
import { convertOccurrences, instantOf } from "@/lib/ics/convert-events";
import {
  isCancelled,
  occurrenceOf,
  toTime,
  zoneOf,
  type IcsOccurrence,
} from "@/lib/ics/parse-ics";
import type { ConvertResult, SyncedEventRow } from "./event-row";
import { vtimezone } from "@/lib/ics/vtimezone";
import type { WritableEvent } from "./google-payload";

// Server-only: iCloud's .ics resources to and from CaFam rows (spec 018 plan
// D5 to D7). CaFam expands series itself with ical.js, as the import does.

/** Floating times have no zone; read them in the default profile zone (spec 001). */
const FLOATING_ZONE = "Europe/Madrid";

export interface Window {
  from: Date;
  to: Date;
}

/** `20261102T080000Z` for a time, `20261015` for a date (plan D6). */
function recurrenceKey(
  time: ICAL.Time,
  component: ICAL.Component,
  property: "dtstart" | "recurrence-id",
): string | null {
  if (time.isDate) {
    return `${time.year}${pad(time.month)}${pad(time.day)}`;
  }
  const zone = zoneOf(component, property) ?? { kind: "floating" };
  const instant = instantOf(toTime(time, zone), FLOATING_ZONE);
  if (instant === null) return null;
  return new Date(instant).toISOString().replace(/[-:]|\.\d{3}/g, "");
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** The id of a repetition in CaFam: the resource and its RECURRENCE-ID (plan D6). */
export function occurrenceExternalId(href: string, key: string): string {
  return `${href}#${key}`;
}

/** Splits an external id back into the resource and the repetition, if any. */
export function splitExternalId(id: string): {
  href: string;
  recurrenceId: string | null;
} {
  const hash = id.lastIndexOf("#");
  return hash === -1
    ? { href: id, recurrenceId: null }
    : { href: id.slice(0, hash), recurrenceId: id.slice(hash + 1) };
}

function toRow(
  occurrence: IcsOccurrence,
  externalId: string,
): SyncedEventRow | null {
  const { events } = convertOccurrences([occurrence], FLOATING_ZONE);
  return events[0] ? { ...events[0], external_id: externalId } : null;
}

function overlaps(row: SyncedEventRow, window: Window): boolean {
  return (
    Date.parse(row.ends_at) >= window.from.getTime() &&
    Date.parse(row.starts_at) < window.to.getTime()
  );
}

export function parseResource(ics: string): ICAL.Component | null {
  try {
    const root = new ICAL.Component(ICAL.parse(ics));
    return root.name === "vcalendar" ? root : null;
  } catch {
    return null;
  }
}

/**
 * One iCloud resource as CaFam rows: a single event keeps the href as its id;
 * a series expands in the window with EXDATE, modified and cancelled
 * repetitions (RF-21 to RF-25). What cannot be placed is counted in `skipped`.
 */
export function expandObject(
  href: string,
  ics: string,
  window: Window,
): ConvertResult {
  const result: ConvertResult = { events: [], skipped: 0 };
  const root = parseResource(ics);
  if (!root) return { events: [], skipped: 1 };

  const vevents = root
    .getAllSubcomponents("vevent")
    .filter((c) => c.hasProperty("dtstart"));
  const master = vevents.find((c) => !c.hasProperty("recurrence-id"));
  const exceptions = vevents.filter((c) => c.hasProperty("recurrence-id"));

  const push = (row: SyncedEventRow | null) => {
    if (!row) result.skipped++;
    else if (overlaps(row, window)) result.events.push(row);
  };

  if (!master) {
    // Modified repetitions whose series is not in the resource stand on their own.
    for (const exception of exceptions) {
      if (isCancelled(exception)) continue;
      const event = new ICAL.Event(exception);
      const key = recurrenceKey(event.recurrenceId, exception, "recurrence-id");
      push(
        key === null
          ? null
          : toRow(
              occurrenceOf(exception, event.startDate, event.endDate),
              occurrenceExternalId(href, key),
            ),
      );
    }
    return result;
  }

  if (isCancelled(master)) return result;
  const event = new ICAL.Event(master);
  if (!event.isRecurring()) {
    push(toRow(occurrenceOf(master, event.startDate, event.endDate), href));
    return result;
  }

  for (const exception of exceptions) {
    event.relateException(new ICAL.Event(exception));
  }
  const iterator = event.iterator();
  let next: ICAL.Time | null | undefined;
  while ((next = iterator.next())) {
    const key = recurrenceKey(next, master, "dtstart");
    if (key === null) {
      result.skipped++;
      break;
    }
    const details = event.getOccurrenceDetails(next);
    const item = details.item.component;
    if (isCancelled(item)) continue;
    const row = toRow(
      occurrenceOf(item, details.startDate, details.endDate),
      occurrenceExternalId(href, key),
    );
    if (row && Date.parse(row.starts_at) >= window.to.getTime()) break;
    push(row);
  }
  return result;
}

// Writing (plan D7): only the fields that changed, keeping alarms, guests,
// attachments and properties CaFam does not know. Never color or category (RF-44).

function timeOf(
  value: string,
  allDay: boolean,
  zone: string | null,
): ICAL.Time {
  if (allDay) return ICAL.Time.fromDateString(value.slice(0, 10));
  // Wall clock of the zone, marked with TZID by setTime (spec 045 RF-9).
  if (zone) {
    return ICAL.Time.fromData({
      ...utcToZonedParts(new Date(value), zone),
      isDate: false,
    });
  }
  return ICAL.Time.fromJSDate(new Date(value), true);
}

/** The TZID a component already has: kept by a change without zones (RF-11). */
function currentZone(component: ICAL.Component, name: string): string | null {
  const zone = zoneOf(component, name as "dtstart");
  return zone?.kind === "tzid" ? zone.tzid : null;
}

/** start and end zones a write uses. */
function zonesFor(component: ICAL.Component, event: WritableEvent) {
  if (event.all_day) return { start: null, end: null };
  const start =
    event.start_tz === undefined
      ? currentZone(component, "dtstart")
      : event.start_tz;
  const end =
    event.start_tz === undefined
      ? currentZone(component, "dtend")
      : (event.end_tz ?? start);
  return { start, end: end ?? start };
}

/**
 * Every zone used gets its VTIMEZONE, before the events as the iPhone writes
 * them (spec 018 trap: iCloud relates times by their TZID).
 */
function ensureZones(root: ICAL.Component) {
  const have = new Set(
    root
      .getAllSubcomponents("vtimezone")
      .map((c) => String(c.getFirstPropertyValue("tzid"))),
  );
  const events = root.getAllSubcomponents("vevent");
  const needed = new Set<string>();
  for (const event of events) {
    for (const name of ["dtstart", "dtend"]) {
      const zone = currentZone(event, name);
      if (zone && !have.has(zone)) needed.add(zone);
    }
  }
  if (needed.size === 0) return;
  for (const event of events) root.removeSubcomponent(event);
  const year = new Date().getUTCFullYear();
  for (const zone of needed) {
    root.addSubcomponent(
      ICAL.Component.fromString(vtimezone(zone, year).join("\r\n")),
    );
  }
  for (const event of events) root.addSubcomponent(event);
}

/**
 * Adds the RECURRENCE-ID or EXDATE of a repetition written like the series'
 * DTSTART (same TZID wall time), as the iPhone does and as ical.js matches.
 */
function addSeriesTime(
  component: ICAL.Component,
  name: "recurrence-id" | "exdate",
  key: string,
  master: ICAL.Component,
) {
  const [, y, m, d, h, min, sec] =
    /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})Z)?$/.exec(key) ?? [];
  if (!y) throw new Error(`Invalid recurrence key ${key}`);
  const property = new ICAL.Property(name);
  component.addProperty(property);
  if (h === undefined) {
    property.setValue(ICAL.Time.fromDateString(`${y}-${m}-${d}`));
    return;
  }
  const instant = new Date(`${y}-${m}-${d}T${h}:${min}:${sec}Z`);
  const zone = zoneOf(master, "dtstart") ?? { kind: "floating" };
  if (zone.kind === "utc") {
    property.setValue(ICAL.Time.fromJSDate(instant, true));
    return;
  }
  const tzid = zone.kind === "tzid" ? zone.tzid : FLOATING_ZONE;
  property.setValue(
    ICAL.Time.fromData({ ...utcToZonedParts(instant, tzid), isDate: false }),
  );
  if (zone.kind === "tzid") property.setParameter("tzid", tzid);
}

function setTime(
  component: ICAL.Component,
  name: string,
  time: ICAL.Time,
  zone: string | null = null,
) {
  component.removeAllProperties(name);
  const property = component.addPropertyWithValue(name, time);
  if (zone) property.setParameter("tzid", zone);
}

function setText(
  component: ICAL.Component,
  name: string,
  value: string | null,
) {
  if (value === null || value === "") component.removeAllProperties(name);
  else component.updatePropertyWithValue(name, value);
}

function stamp(component: ICAL.Component) {
  component.updatePropertyWithValue(
    "dtstamp",
    ICAL.Time.fromJSDate(new Date(), true),
  );
}

function setTimes(component: ICAL.Component, event: WritableEvent) {
  const { start, end } = zonesFor(component, event);
  component.removeAllProperties("duration");
  setTime(
    component,
    "dtstart",
    timeOf(event.starts_at, event.all_day, start),
    start,
  );
  setTime(component, "dtend", timeOf(event.ends_at, event.all_day, end), end);
}

function timesChanged(before: WritableEvent, after: WritableEvent): boolean {
  return (
    after.all_day !== before.all_day ||
    Date.parse(after.starts_at) !== Date.parse(before.starts_at) ||
    Date.parse(after.ends_at) !== Date.parse(before.ends_at) ||
    (after.start_tz !== undefined &&
      (after.start_tz !== (before.start_tz ?? null) ||
        (after.end_tz ?? after.start_tz) !==
          (before.end_tz ?? before.start_tz ?? null)))
  );
}

/** Applies to `component` what changed between `before` and `after`. */
function applyChanges(
  component: ICAL.Component,
  before: WritableEvent,
  after: WritableEvent,
) {
  if (after.title !== before.title) setText(component, "summary", after.title);
  if (after.description !== before.description)
    setText(component, "description", after.description);
  if (after.location !== before.location)
    setText(component, "location", after.location);
  if (timesChanged(before, after)) setTimes(component, after);
  stamp(component);
}

/** A new resource with one event (RF-38). */
export function newEventIcs(uid: string, event: WritableEvent): string {
  const root = new ICAL.Component("vcalendar");
  root.addPropertyWithValue("version", "2.0");
  root.addPropertyWithValue("prodid", "-//CaFam//ES");
  const vevent = new ICAL.Component("vevent");
  vevent.addPropertyWithValue("uid", uid);
  stamp(vevent);
  setText(vevent, "summary", event.title);
  setText(vevent, "description", event.description);
  setText(vevent, "location", event.location);
  setTimes(vevent, event);
  root.addSubcomponent(vevent);
  ensureZones(root);
  return root.toString();
}

function readRoot(ics: string): ICAL.Component {
  const root = parseResource(ics);
  if (!root) throw new Error("Not an iCalendar resource");
  return root;
}

function masterOf(root: ICAL.Component): ICAL.Component {
  const master = root
    .getAllSubcomponents("vevent")
    .find((c) => !c.hasProperty("recurrence-id"));
  if (!master) throw new Error("No main event in the resource");
  return master;
}

function exceptionFor(
  root: ICAL.Component,
  key: string,
): ICAL.Component | undefined {
  return root.getAllSubcomponents("vevent").find((c) => {
    if (!c.hasProperty("recurrence-id")) return false;
    const id = new ICAL.Event(c).recurrenceId;
    return recurrenceKey(id, c, "recurrence-id") === key;
  });
}

/**
 * Changes a single event (`recurrenceId` null) or one repetition, in its own
 * VEVENT with RECURRENCE-ID: a copy of the series with its alarms (RF-39, RF-40).
 */
export function patchIcs(
  ics: string,
  recurrenceId: string | null,
  before: WritableEvent,
  after: WritableEvent,
): string {
  const root = readRoot(ics);
  const master = masterOf(root);
  if (recurrenceId === null) {
    applyChanges(master, before, after);
    ensureZones(root);
    return root.toString();
  }

  const existing = exceptionFor(root, recurrenceId);
  if (existing) {
    applyChanges(existing, before, after);
    ensureZones(root);
    return root.toString();
  }
  const exception = ICAL.Component.fromString(master.toString());
  for (const name of ["rrule", "rdate", "exdate"]) {
    exception.removeAllProperties(name);
  }
  exception.removeAllProperties("recurrence-id");
  addSeriesTime(exception, "recurrence-id", recurrenceId, master);
  // The copy carries the series' first times: the repetition's go in always.
  setTimes(exception, before);
  applyChanges(exception, before, after);
  root.addSubcomponent(exception);
  ensureZones(root);
  return root.toString();
}

/** Deletes one repetition: EXDATE in the series and no VEVENT of its own (RF-40). */
export function removeOccurrence(ics: string, recurrenceId: string): string {
  const root = readRoot(ics);
  const master = masterOf(root);
  const existing = exceptionFor(root, recurrenceId);
  if (existing) root.removeSubcomponent(existing);
  addSeriesTime(master, "exdate", recurrenceId, master);
  stamp(master);
  return root.toString();
}
