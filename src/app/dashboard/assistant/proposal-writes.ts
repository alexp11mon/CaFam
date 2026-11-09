import { markDuplicates } from "@/lib/assistant/duplicates";
import { rowError, rowInstants } from "@/lib/assistant/proposal-rows";
import type { ProposalRow } from "@/lib/assistant/schemas";
import { CALENDAR_MESSAGES } from "@/lib/calendar/error-messages";
import { getEventsInRange, getMyCalendars } from "@/lib/calendar/queries";
import { canWriteEvents } from "@/lib/sync/read-only";
import { createSingle, toRow, type Supabase } from "../events/event-writes";

// What the proposal actions do (spec 022 plan "actions", D4, D5, D8). Not a
// "use server" file: its exports must not become endpoints. Everything goes
// through the user's session, so RLS decides again what can be written.

export type CreateResult =
  | { key: string; ok: true; id: string }
  | { key: string; ok: false; error: string };

const DAY_MS = 86_400_000;

export const INVALID_PROPOSAL = "La propuesta no es válida. Empieza una nueva.";

async function writableIds(supabase: Supabase, userId: string) {
  const calendars = await getMyCalendars(supabase, userId);
  return new Set(calendars.filter(canWriteEvents).map((c) => c.id));
}

/** RF-39 and the calendars that stopped being writable (edge cases). */
export async function checkRows(
  supabase: Supabase,
  userId: string,
  timeZone: string,
  rows: readonly ProposalRow[],
): Promise<{ rows: ProposalRow[]; errors: Record<string, string> }> {
  const writable = await writableIds(supabase, userId);
  const errors: Record<string, string> = {};
  for (const row of rows) {
    if (!writable.has(row.calendarId)) {
      errors[row.key] = CALENDAR_MESSAGES.forbidden;
    }
  }
  const instants = rows
    .map((row) => (rowError(row) ? null : rowInstants(row, timeZone)))
    .filter((range) => range !== null);
  if (instants.length === 0) return { rows: [...rows], errors };
  const from = Math.min(...instants.map((r) => Date.parse(r.startsAt)));
  const to = Math.max(...instants.map((r) => Date.parse(r.endsAt)));
  const events = await getEventsInRange(
    supabase,
    new Date(from - DAY_MS),
    new Date(to + DAY_MS),
  );
  return { rows: markDuplicates(rows, events, timeZone), errors };
}

/**
 * RF-36, RF-38, RF-40, RF-43, RF-44, RF-46: the selected rows, one by one and
 * each in its own calendar; a failed row does not undo the others.
 */
export async function createRows(
  supabase: Supabase,
  userId: string,
  timeZone: string,
  rows: readonly ProposalRow[],
): Promise<CreateResult[]> {
  const writable = await writableIds(supabase, userId);
  const results: CreateResult[] = [];
  for (const row of rows.filter((r) => r.selected)) {
    const invalid = rowError(row);
    const instants = invalid ? null : rowInstants(row, timeZone);
    if (!instants) {
      results.push({ key: row.key, ok: false, error: invalid ?? "" });
      continue;
    }
    if (!writable.has(row.calendarId)) {
      results.push({
        key: row.key,
        ok: false,
        error: CALENDAR_MESSAGES.forbidden,
      });
      continue;
    }
    const created = await createSingle(
      supabase,
      userId,
      toRow({
        title: row.title.trim(),
        calendarId: row.calendarId,
        description: null,
        location: null,
        color: null,
        categoryId: null,
        allDay: row.allDay,
        ...instants,
      }),
    );
    results.push({ key: row.key, ...created });
  }
  return results;
}
