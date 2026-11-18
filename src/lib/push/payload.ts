import { formatDayHeading, todayKey } from "@/lib/calendar/format";
import {
  addDays,
  formatTime,
  utcDateKey,
  zonedDateKey,
} from "@/lib/calendar/time-zone";

// What a notification says and opens (spec 040 RF-11, RF-13; plan D5: small,
// well under the 4 KB of Web Push).

export interface PushPayload {
  title: string;
  body: string;
  /** Opened when the notification is pressed. */
  url: string;
  /** A newer notice with the same tag replaces the older one. */
  tag: string;
}

const capitalize = (text: string) =>
  text.charAt(0).toUpperCase() + text.slice(1);

const shortTime = (instant: string, timeZone: string) =>
  formatTime(instant, timeZone).replace(/^0(?=\d)/, "");

/** "Hoy", "Mañana" or "Viernes, 27 de noviembre". */
function dayWord(day: string, timeZone: string, now: Date): string {
  const today = todayKey(timeZone, now);
  if (day === today) return "Hoy";
  if (day === addDays(today, 1)) return "Mañana";
  return capitalize(formatDayHeading(day));
}

/** "Hoy a las 18:30 · en Calle Mayor 3" (RF-11). */
export function reminderPayload(
  event: {
    eventId: string;
    title: string;
    location: string | null;
    startsAt: string;
    allDay: boolean;
  },
  timeZone: string,
  now: Date,
): PushPayload {
  const day = event.allDay
    ? utcDateKey(event.startsAt)
    : zonedDateKey(event.startsAt, timeZone);
  const when = event.allDay
    ? `${dayWord(day, timeZone, now)} · todo el día`
    : `${dayWord(day, timeZone, now)} a las ${shortTime(event.startsAt, timeZone)}`;
  return {
    title: event.title,
    body: event.location ? `${when} · en ${event.location}` : when,
    url: `/dashboard/events/${event.eventId}`,
    tag: `event:${event.eventId}`,
  };
}

export type SocialNotice =
  | { kind: "joined"; actor: string; calendar: string; calendarId: string }
  | {
      kind: "access";
      actor: string;
      calendar: string;
      calendarId: string;
      role: string;
    }
  | {
      kind: "comment";
      actor: string;
      title: string;
      eventId: string;
      body: string;
    }
  | {
      kind: "changed" | "deleted";
      actor: string;
      title: string;
      eventId: string;
    };

const ROLES: Record<string, string> = {
  owner: "Propietario",
  editor: "Editor",
  viewer: "Lector",
};

const MAX_BODY = 160;

function cut(text: string): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length <= MAX_BODY ? flat : `${flat.slice(0, MAX_BODY - 1)}…`;
}

/** The text of a social notice (RF-13). */
export function socialPayload(notice: SocialNotice): PushPayload {
  switch (notice.kind) {
    case "joined":
      return {
        title: notice.calendar,
        body: `${notice.actor} se ha unido al calendario`,
        url: `/dashboard/calendars/${notice.calendarId}/members`,
        tag: `calendar:${notice.calendarId}`,
      };
    case "access":
      return {
        title: notice.calendar,
        body: `${notice.actor} te ha dado acceso como ${ROLES[notice.role] ?? notice.role}`,
        url: "/dashboard/calendars",
        tag: `calendar:${notice.calendarId}`,
      };
    case "comment":
      return {
        title: notice.title,
        body: cut(`${notice.actor}: ${notice.body}`),
        url: `/dashboard/events/${notice.eventId}`,
        tag: `comment:${notice.eventId}`,
      };
    case "changed":
      return {
        title: notice.title,
        body: `${notice.actor} ha cambiado el evento`,
        url: `/dashboard/events/${notice.eventId}`,
        tag: `event:${notice.eventId}`,
      };
    case "deleted":
      return {
        title: notice.title,
        body: `${notice.actor} ha borrado el evento`,
        url: "/dashboard/calendar",
        tag: `event:${notice.eventId}`,
      };
  }
}
