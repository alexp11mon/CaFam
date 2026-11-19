"use server";

import type { EventDetailData } from "@/components/calendar/event-detail";
import { authorLabel } from "@/lib/account/author-label";
import { originalLabel } from "@/lib/calendar/event-zone";
import {
  getCalendar,
  getEvent,
  getProfileTimeZone,
  requireActionUser,
} from "@/lib/calendar/queries";
import { parseEventId } from "@/lib/recurrence/occurrence-id";
import { getMembers } from "@/lib/sharing/queries";
import {
  canWriteEvents,
  readOnlyReason,
  type ReadOnlyReason,
} from "@/lib/sync/read-only";
import type { ProviderName } from "@/lib/sync/providers/types";

export interface EventCardData {
  description: string | null;
  author: string;
  repeat: EventDetailData["repeat"];
  readOnly: ReadOnlyReason | null;
  provider?: ProviderName;
  canEdit: boolean;
  /** The hours in the event's own zone, if not the reader's (spec 045 RF-5). */
  originalTime: string | null;
}

/**
 * What the detail card does not get from the view: description, author and
 * rule, read with RLS once the card is open (spec 019 RF-4, RF-5, RF-7; plan D9).
 */
export async function loadEventCard(
  id: string,
): Promise<EventCardData | { gone: true }> {
  if (typeof id !== "string" || !parseEventId(id)) return { gone: true };
  const { supabase, userId } = await requireActionUser();
  const event = await getEvent(supabase, id);
  if (!event) return { gone: true };
  const [calendar, members, timeZone] = await Promise.all([
    getCalendar(supabase, userId, event.calendarId),
    getMembers(supabase, [event.calendarId]),
    getProfileTimeZone(supabase, userId),
  ]);
  if (!calendar) return { gone: true };
  return {
    description: event.description,
    author: authorLabel(event.createdBy, members),
    repeat: event.series
      ? {
          summary: event.series.summary,
          changed: event.series.changed,
          limitReached: !event.rowId && event.series.exceptions >= 100,
        }
      : null,
    readOnly: readOnlyReason(calendar.synced),
    provider: calendar.synced?.provider,
    canEdit: canWriteEvents(calendar),
    originalTime: originalLabel(
      { ...event, recurrenceTz: event.series?.recurrenceTz },
      timeZone,
    ),
  };
}
