import {
  addDays,
  utcDateKey,
  zonedDateKey,
  formatTime,
} from "@/lib/calendar/time-zone";
import { weekdayName } from "./dates";
import { COMMENT_CHARS } from "./limits";

// What the model receives about an event (spec 015 RF-8, RF-30, plan D5):
// a short reference, the local date and hours, title, calendar and place.
// Never ids, emails or account names.

export interface SourceEvent {
  id: string;
  startsAt: string;
  endsAt: string;
  allDay: boolean;
  title: string;
  location: string | null;
  calendarId: string;
  commentCount?: number;
}

export interface ModelEvent {
  ref: string;
  date: string;
  /** The model got weekdays wrong when it had to work them out (T12). */
  weekday: string;
  endDate?: string;
  start?: string;
  end?: string;
  allDay?: true;
  title: string;
  calendar: string;
  /** T14, D15: how many to ask get_comments for; left out when there are none. */
  comments?: number;
  /** Calendars brought from an account, so "what's in my iCloud" can be answered. */
  source?: EventSource;
  location?: string;
}

export type EventSource = "Google" | "iCloud";

export function toModelEvent(
  ref: string,
  event: SourceEvent,
  calendar: string,
  timeZone: string,
  source?: EventSource,
): ModelEvent {
  const location = event.location?.trim() || undefined;
  const from = {
    ...(source ? { source } : {}),
    ...(event.commentCount ? { comments: event.commentCount } : {}),
  };
  if (event.allDay) {
    // All-day events are read by UTC date (spec 002 D6); the end is exclusive.
    const date = utcDateKey(event.startsAt);
    const last = addDays(utcDateKey(event.endsAt), -1);
    return {
      ref,
      date,
      weekday: weekdayName(date),
      ...(last > date ? { endDate: last } : {}),
      allDay: true,
      title: event.title,
      calendar,
      ...from,
      ...(location ? { location } : {}),
    };
  }
  const date = zonedDateKey(event.startsAt, timeZone);
  const endDate = zonedDateKey(event.endsAt, timeZone);
  return {
    ref,
    date,
    weekday: weekdayName(date),
    ...(endDate > date ? { endDate } : {}),
    start: formatTime(event.startsAt, timeZone),
    end: formatTime(event.endsAt, timeZone),
    title: event.title,
    calendar,
    ...from,
    ...(location ? { location } : {}),
  };
}

export interface ModelComment {
  author: string;
  date: string;
  time: string;
  text: string;
}

/** RF-35: the author as CaFam shows it, never an email; the text cut for the quota (D15). */
export function toModelComment(
  comment: { author: string; createdAt: string; body: string },
  timeZone: string,
): ModelComment {
  const chars = [...comment.body];
  return {
    author: comment.author,
    date: zonedDateKey(comment.createdAt, timeZone),
    time: formatTime(comment.createdAt, timeZone),
    text:
      chars.length > COMMENT_CHARS
        ? `${chars.slice(0, COMMENT_CHARS).join("")}…`
        : comment.body,
  };
}
