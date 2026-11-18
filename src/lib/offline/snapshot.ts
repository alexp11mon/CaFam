// The copy of the user's data kept on the device (spec 034 RF-1 to RF-6,
// plan "Modelo de datos", D9). Pure: no storage, no network.
import type { DayRange, EventWindow } from "@/lib/calendar/event-window";
import type {
  CalendarEventRecord,
  CalendarProfile,
  CalendarRecord,
  CategoryOptionRecord,
  getGroups,
  getPeople,
  getPreferences,
} from "@/lib/calendar/queries";
import type { AccentId } from "@/lib/theme/accents";
import type { ThemeId } from "@/lib/theme/theme";
import type { Note } from "@/lib/notes/types";
import type { SeriesTotals } from "./outbox";

/** Bumped when the shape changes: an older copy is dropped (plan R1). */
export const SNAPSHOT_FORMAT = 2;

/** An event as the copy keeps it: what the views draw plus the detail. */
export interface OfflineEvent extends CalendarEventRecord {
  description: string | null;
  createdBy: string | null;
  createdByName: string | null;
  /** "Cada semana el lunes" for an occurrence; null for a single event. */
  seriesSummary: string | null;
  /** An exception that differs from its series (spec 013 RF-16). */
  seriesChanged: boolean;
  /** Seen in a window the page read again: no description or author yet (D9). */
  partial?: boolean;
}

/** A series of the range as its row is (spec 035 RF-12, RF-13, plan D3). */
export interface OfflineSeries {
  id: string;
  calendarId: string;
  title: string;
  description: string | null;
  location: string | null;
  color: string | null;
  categoryId: string | null;
  startsAt: string;
  endsAt: string;
  allDay: boolean;
  recurrence: string;
  recurrenceTz: string | null;
  recurrenceUntil: string | null;
  exdates: string[];
  /** What another person could change in the whole series (D3). */
  totals: SeriesTotals;
}

/** An exception of the range: its event is in `events` with this id. */
export interface OfflineException {
  id: string;
  seriesId: string;
  originalStart: string;
}

/** One of the 50 latest comments of an event (spec 035 RF-17). */
export interface OfflineComment {
  id: string;
  eventId: string;
  authorId: string | null;
  authorName: string;
  body: string;
  createdAt: string;
  editedAt: string | null;
}

/** A ready image of an event of the range; its thumbnail is in "thumbs" (RF-29). */
export interface OfflineImage {
  id: string;
  eventId: string;
  /** Where its objects are in Storage (`<objectId>/thumb.jpg`). */
  objectId: string;
  uploadedBy: string | null;
  createdAt: string;
  width: number;
  height: number;
}

export interface OfflineProfile extends CalendarProfile {
  displayName: string;
  accent: AccentId;
  theme: ThemeId;
}

export interface Snapshot {
  format: number;
  userId: string;
  /** ISO instant of the last full reading (RF-9). */
  savedAt: string;
  /** Today when it was read, in the profile's zone: the range is fixed (R7). */
  today: string;
  range: DayRange;
  profile: OfflineProfile;
  calendars: CalendarRecord[];
  categories: CategoryOptionRecord[];
  groups: Awaited<ReturnType<typeof getGroups>>;
  people: Awaited<ReturnType<typeof getPeople>>;
  preferences: Awaited<ReturnType<typeof getPreferences>>;
  events: OfflineEvent[];
  notes: Note[];
  /** Spec 035 (format 2): series of the range with their totals (RF-13). */
  series: OfflineSeries[];
  exceptions: OfflineException[];
  comments: OfflineComment[];
  images: OfflineImage[];
}

/** Whether a stored copy can be used by this version of the app (R1). */
export function isUsable(snapshot: unknown): snapshot is Snapshot {
  return (
    typeof snapshot === "object" &&
    snapshot !== null &&
    (snapshot as { format?: unknown }).format === SNAPSHOT_FORMAT
  );
}

/** What a page window carries of an event (`toViewEvents` with `ownColor`). */
export interface WindowEvent {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  allDay: boolean;
  calendarId: string;
  categoryId?: string | null;
  location?: string | null;
  ownColor?: string | null;
  imageCount?: number;
  commentCount?: number;
  seriesId?: string | null;
}

const DAY_MS = 86_400_000;

/** Whether an event touches the days of a window, with a day of slack for zones. */
function touches(
  event: { startsAt: string; endsAt: string },
  range: DayRange,
): boolean {
  const from = Date.parse(`${range.from}T00:00:00Z`) - DAY_MS;
  const to = Date.parse(`${range.to}T00:00:00Z`) + 2 * DAY_MS;
  return Date.parse(event.startsAt) < to && Date.parse(event.endsAt) >= from;
}

/**
 * The copy with a window the page just read again (RF-5, RNF-4, plan D9):
 * its events replace those of its days, keeping the detail the window does
 * not carry; a new one stays `partial` until the next full reading.
 */
export function mergeWindow(
  events: readonly OfflineEvent[],
  window: EventWindow<WindowEvent>,
): OfflineEvent[] {
  const known = new Map(events.map((event) => [event.id, event]));
  const fresh = new Set(window.events.map((event) => event.id));
  const kept = events.filter(
    (event) => fresh.has(event.id) || !touches(event, window.range),
  );
  const byId = new Map(kept.map((event) => [event.id, event]));
  for (const item of window.events) {
    const before = known.get(item.id);
    byId.set(item.id, {
      id: item.id,
      title: item.title,
      startsAt: item.startsAt,
      endsAt: item.endsAt,
      allDay: item.allDay,
      calendarId: item.calendarId,
      categoryId: item.categoryId ?? null,
      location: item.location ?? null,
      color: item.ownColor ?? null,
      imageCount: item.imageCount ?? 0,
      commentCount: item.commentCount ?? 0,
      seriesId: item.seriesId ?? null,
      description: before?.description ?? null,
      createdBy: before?.createdBy ?? null,
      createdByName: before?.createdByName ?? null,
      seriesSummary: before?.seriesSummary ?? null,
      seriesChanged: before?.seriesChanged ?? false,
      ...(before && !before.partial ? {} : { partial: true }),
    });
  }
  return [...byId.values()].sort((a, b) =>
    a.startsAt === b.startsAt
      ? a.id.localeCompare(b.id)
      : a.startsAt < b.startsAt
        ? -1
        : 1,
  );
}
