// The own time zone of an event (spec 045). Instants stay in UTC; the zone
// only says in which wall clock the event is edited and its original hours.
import { formatTime, offsetMs } from "./time-zone";

export interface ZonedRow {
  startsAt: string;
  endsAt: string;
  allDay: boolean;
  startTz: string | null;
  endTz: string | null;
  /** A series' zone is its own (RF-8). */
  recurrenceTz?: string | null;
}

/** The zones the form edits in: own, the series' or the profile's (RF-3, RF-6). */
export function editZones(
  row: Pick<ZonedRow, "startTz" | "endTz" | "recurrenceTz">,
  profileZone: string,
): { start: string; end: string } {
  const start = row.startTz ?? row.recurrenceTz ?? profileZone;
  return { start, end: row.endTz ?? start };
}

/** "New_York" -> "New York": the last part of the IANA id. */
export function zoneCity(zone: string): string {
  return (zone.split("/").pop() ?? zone).replaceAll("_", " ");
}

function named(zone: string): string {
  return `${zoneCity(zone)} (${zone})`;
}

/** "18:00–20:00 en New York (America/New_York)", or null when it is the reader's (RF-5). */
export function originalLabel(
  row: ZonedRow,
  viewerZone: string,
): string | null {
  if (row.allDay) return null;
  const { start, end } = editZones(row, viewerZone);
  if (start === viewerZone && end === viewerZone) return null;
  const from = formatTime(row.startsAt, start);
  const to = formatTime(row.endsAt, end);
  if (start === end) return `${from}–${to} en ${named(start)}`;
  return `${from} en ${named(start)} – ${to} en ${named(end)}`;
}

/** "GMT+5:30", "GMT−5", "GMT" at an instant (summer and winter differ). */
export function offsetLabel(zone: string, now: number): string {
  const minutes = Math.round(offsetMs(now, zone) / 60_000);
  if (minutes === 0) return "GMT";
  const abs = Math.abs(minutes);
  const hours = Math.floor(abs / 60);
  const rest = abs % 60;
  return `GMT${minutes < 0 ? "−" : "+"}${hours}${rest ? `:${String(rest).padStart(2, "0")}` : ""}`;
}

// Old browsers without Intl.supportedValuesOf (plan "Riesgos").
const FALLBACK_ZONES = [
  "UTC",
  "Europe/Lisbon",
  "Europe/London",
  "Europe/Madrid",
  "Atlantic/Canary",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Rome",
  "Europe/Athens",
  "Europe/Moscow",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Mexico_City",
  "America/Bogota",
  "America/Lima",
  "America/Santiago",
  "America/Argentina/Buenos_Aires",
  "America/Sao_Paulo",
];

function allZones(): string[] {
  try {
    const zones = Intl.supportedValuesOf("timeZone");
    // Some engines leave UTC out of the list.
    return zones.includes("UTC") ? zones : [...zones, "UTC"];
  } catch {
    return FALLBACK_ZONES;
  }
}

export interface ZoneOption {
  id: string;
  label: string;
  recent: boolean;
}

/** Every IANA zone with its offset now, the user's recent ones first (RF-1). */
export function zoneOptions(now: number, recent: string[]): ZoneOption[] {
  const zones = allZones();
  const option = (id: string, isRecent: boolean): ZoneOption => ({
    id,
    label: `${zoneCity(id)} (${offsetLabel(id, now)})`,
    recent: isRecent,
  });
  // Not checked against the list: engines name some zones differently
  // (Asia/Calcutta and Asia/Kolkata), and Intl accepts both.
  const first = recent.filter((id) => validZone(id) !== null);
  const rest = zones.filter((id) => !first.includes(id));
  return [
    ...first.map((id) => option(id, true)),
    ...rest.map((id) => option(id, false)),
  ];
}

export const RECENT_ZONES_KEY = "cafam-recent-zones";
const RECENT_MAX = 8;

/** The zone goes first, without repeats, keeping the last 8 (plan D3). */
export function pushRecentZone(list: string[], zone: string): string[] {
  return [zone, ...list.filter((id) => id !== zone)].slice(0, RECENT_MAX);
}

/** A valid IANA zone for Intl, or null. */
export function validZone(zone: string): string | null {
  if (!zone) return null;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: zone });
    return zone;
  } catch {
    return null;
  }
}
