import {
  CALENDAR_MESSAGES,
  getCalendarErrorMessage,
} from "@/lib/calendar/error-messages";
import {
  canSeeCalendar,
  getEvent,
  type EventRecord,
} from "@/lib/calendar/queries";
import type { EventData } from "@/lib/calendar/schemas";
import {
  COMMENT_MESSAGES,
  getCommentErrorMessage,
} from "@/lib/comments/error-messages";
import { commentRowFor } from "@/lib/comments/queries";
import {
  getImageErrorMessage,
  IMAGE_MESSAGES,
} from "@/lib/images/error-messages";
import { purgeDeps, purgeObjects } from "@/lib/images/purge";
import { getNoteErrorMessage, NOTE_MESSAGES } from "@/lib/notes/error-messages";
import { getNote } from "@/lib/notes/queries";
import type { Note } from "@/lib/notes/types";
import {
  createVerdict,
  sameSeries,
  verdictOrGone,
} from "@/lib/offline/conflict";
import { OFFLINE_MESSAGES } from "@/lib/offline/messages";
import type { NoteFields, SeriesBase } from "@/lib/offline/outbox";
import type { ParsedChange } from "@/lib/offline/schemas";
import { utcDateKey, zonedDateKey } from "@/lib/calendar/time-zone";
import { resolveRepeat } from "@/lib/recurrence/presets";
import {
  planSeriesChange,
  planSeriesDelete,
} from "@/lib/recurrence/series-write";
import { writeEngineDeps } from "@/lib/sync/engine";
import type { WritableEvent } from "@/lib/sync/google-payload";
import { writeErrorText } from "@/lib/sync/write-errors";
import { readSyncedEvent } from "@/lib/sync/write-event";
import {
  changeOccurrence,
  convertToSeries,
  createSeries,
  createSingle,
  deleteOccurrences,
  deleteSingle,
  materializeWith,
  toRow,
  unconfirmedLoss,
  updateSingle,
  type Supabase,
} from "./events/event-writes";
import { seriesValues } from "./events/quick-writes";
import { totalsOf } from "./offline-reads-detail";

// Applies one change made offline with the user's session (spec 034 RF-41,
// RF-46, RF-47, RF-50 to RF-55, RF-58; plan D5 to D8). It reuses the writes
// of always, so RLS and the limits decide as with a connection (RNF-5).

type Fields = Record<string, unknown>;
/** EventData is an interface: plain fields for the comparisons of conflict.ts. */
const fields = (value: object) => value as Fields;

export type ApplyResult =
  | { status: "applied" }
  | { status: "conflict"; server: Fields | null }
  | { status: "rejected"; reason: string }
  | { status: "retry" }
  /** The account of a synced calendar needs reconnecting: kept (spec 035 RF-7, D8). */
  | { status: "held"; connectionId: string };

const APPLIED: ApplyResult = { status: "applied" };

/** A message of the writes of always: the network is "retry", the rest "rejected". */
function failed(message: string | undefined): ApplyResult {
  if (!message || message === CALENDAR_MESSAGES.connection) {
    return { status: "retry" };
  }
  if (message === NOTE_MESSAGES.connection) return { status: "retry" };
  return { status: "rejected", reason: message };
}

function eventData(event: EventRecord): EventData {
  return {
    title: event.title,
    calendarId: event.calendarId,
    allDay: event.allDay,
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    description: event.description,
    location: event.location,
    color: event.color,
    categoryId: event.categoryId,
  };
}

type EventChange = Extract<ParsedChange, { type: `event.${string}` }>;

const RECURRENCE_INVALID = "La repetición no es válida.";
const NO_SERIES = { series: null };

/** "Repetir" as the form sends it, resolved with the event's date (RF-11). */
function repeatOf(
  repeat: string | undefined,
  data: Pick<EventData, "allDay" | "startsAt">,
  timeZone: string,
) {
  const date = data.allDay
    ? utcDateKey(data.startsAt)
    : zonedDateKey(data.startsAt, timeZone);
  return resolveRepeat(repeat ?? "none", date);
}

/** The message of a form state: its own, or that of its first field. */
function formMessage(state: {
  formError?: string;
  fieldErrors?: Partial<Record<string, string>>;
}): string | undefined {
  return (
    state.formError ?? Object.values(state.fieldErrors ?? {}).find(Boolean)
  );
}

const REVOKED = new Set([
  writeErrorText("revoked", "google"),
  writeErrorText("revoked", "icloud"),
]);

/**
 * The account of a synced calendar the user may write in, when it is only
 * the account that cannot now: it needs reconnecting (spec 035 RF-7, RF-8).
 * Once marked, the database refuses every write with "no permission", and an
 * Editor cannot read the account's state: the calendar's own fields tell.
 */
async function heldConnection(
  supabase: Supabase,
  userId: string,
  calendarId: string,
): Promise<string | null> {
  const [member, synced] = await Promise.all([
    supabase
      .from("calendar_members")
      .select("role")
      .eq("calendar_id", calendarId)
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("synced_calendars")
      .select("connection_id, state, google_access, can_write")
      .eq("calendar_id", calendarId)
      .maybeSingle(),
  ]);
  const role = member.data?.role;
  const row = synced.data;
  if (!row || (role !== "owner" && role !== "editor")) return null;
  const writable =
    row.state === "active" &&
    (row.google_access === "owner" || row.google_access === "writer");
  return writable && !row.can_write ? row.connection_id : null;
}

/**
 * A write of always that failed: an account to reconnect keeps the change
 * (spec 035 RF-7); anything else as in the 034.
 */
async function failedSynced(
  supabase: Supabase,
  userId: string,
  calendarId: string,
  message: string | undefined,
): Promise<ApplyResult> {
  if (
    message &&
    (REVOKED.has(message) || message === CALENDAR_MESSAGES.forbidden)
  ) {
    const connectionId = await heldConnection(supabase, userId, calendarId);
    if (connectionId) return { status: "held", connectionId };
  }
  return failed(message);
}

/** CaFam's event with the fields its provider has now (spec 035 D1). */
function withProvider(event: EventRecord, now: WritableEvent): EventRecord {
  return {
    ...event,
    title: now.title,
    description: now.description,
    location: now.location,
    startsAt: now.starts_at,
    endsAt: now.ends_at,
    allDay: now.all_day,
  };
}

type Current =
  { ok: true; event: EventRecord | null } | { ok: false; result: ApplyResult };

/**
 * The event to compare with: CaFam's row, or for a synced calendar the one
 * the provider has now, read just before writing (spec 035 RF-5, RF-6, D1).
 */
async function currentOf(
  supabase: Supabase,
  userId: string,
  server: EventRecord | null,
): Promise<Current> {
  if (!server || server.series) return { ok: true, event: server };
  const read = await readSyncedEvent(
    server.calendarId,
    server.id,
    writeEngineDeps(supabase),
  );
  switch (read.status) {
    case "normal":
    case "local":
      return { ok: true, event: server };
    case "read":
      return {
        ok: true,
        event: read.event ? withProvider(server, read.event) : null,
      };
    case "dbError":
      // A Reader, or a calendar the provider only lets read (RF-2).
      return {
        ok: false,
        result: await failedSynced(
          supabase,
          userId,
          server.calendarId,
          getCalendarErrorMessage(read.error),
        ),
      };
    case "failed":
      return {
        ok: false,
        result:
          read.failure === "revoked"
            ? { status: "held", connectionId: read.connectionId }
            : read.failure === "transient"
              ? { status: "retry" }
              : failed(writeErrorText(read.failure, read.provider)),
      };
  }
}

async function applyEvent(
  supabase: Supabase,
  userId: string,
  timeZone: string,
  change: EventChange,
  force: boolean,
): Promise<ApplyResult> {
  const server = await getEvent(supabase, change.id);
  const current = server ? fields(eventData(server)) : null;

  if (change.type === "event.create") {
    const repeat = repeatOf(change.repeat, change.data, timeZone);
    if (!repeat.ok) return failed(RECURRENCE_INVALID);
    if (repeat.rule) {
      // A series created with the browser's id: a resend finds it (RF-11).
      if (server) return APPLIED;
      const data = {
        ...change.data,
        description: change.data.description ?? null,
      };
      const created = await createSeries(
        supabase,
        userId,
        {
          data,
          rule: repeat.rule,
          timeZone,
          values: {
            ...seriesValues(NO_SERIES, data, timeZone),
            repeat: change.repeat ?? "none",
          },
        },
        change.id,
      );
      return "id" in created ? APPLIED : failed(formMessage(created));
    }
    const verdict = createVerdict(fields(change.data), current);
    if (verdict === "applied") return APPLIED;
    if (verdict === "conflict" && !force) {
      return { status: "conflict", server: current };
    }
    const data = {
      ...change.data,
      description: change.data.description ?? null,
    };
    const created = await createSingle(
      supabase,
      userId,
      toRow(data),
      change.id,
    );
    // shortcut: in a synced calendar the provider gives the id, so a resend
    // after a lost answer creates it twice; fixing it needs sync_commit_event
    // to take the browser's id (a migration).
    return created.ok
      ? APPLIED
      : failedSynced(supabase, userId, change.data.calendarId, created.error);
  }

  const mine = change.type === "event.update" ? change.data : null;
  const asked = change.type === "event.update" ? change.repeat : undefined;
  // Only "Repetir" changed: the fields agree, but there is still a write.
  const converting = Boolean(
    asked && asked !== "none" && server && !server.series,
  );
  // Expelled from its calendar: not "deleted by another", just not allowed (RF-47).
  if (!server && !(await canSeeCalendar(supabase, change.base.calendarId))) {
    return failed(CALENDAR_MESSAGES.forbidden);
  }
  const now = await currentOf(supabase, userId, server);
  if (!now.ok) return now.result;
  const latest = now.event ? fields(eventData(now.event)) : null;
  if (!force) {
    const verdict = verdictOrGone(
      fields(change.base),
      mine && fields(mine),
      latest,
    );
    if (verdict === "conflict") return { status: "conflict", server: latest };
    // Gone only in the provider: deleting it there takes it out of CaFam too.
    if (verdict === "applied" && (mine || !server) && !converting) {
      return APPLIED;
    }
  }
  if (!server || (!now.event && mine)) {
    return mine ? failed(CALENDAR_MESSAGES.notFound) : APPLIED;
  }

  if (!mine) {
    if (server.series) {
      const result = await deleteOccurrences(
        supabase,
        server.series,
        "this",
        true,
      );
      return result ? failed(result.formError) : APPLIED;
    }
    const result = await deleteSingle(supabase, server.id, "page");
    // Already deleted in the provider: CaFam dropped it too (spec 009 RF-25).
    if (!result || !now.event) return APPLIED;
    return failedSynced(supabase, userId, server.calendarId, result.formError);
  }

  // A partial event did not know the description: it keeps the server's (R6).
  const data: EventData = {
    ...mine,
    description:
      mine.description === undefined ? server.description : mine.description,
  };
  const values = seriesValues(server, data, timeZone);
  const repeat = repeatOf(asked, data, timeZone);
  if (!repeat.ok) return failed(RECURRENCE_INVALID);
  if (!server.series && repeat.rule) {
    // Convert into a series (spec 035 RF-11), as the form does.
    const converted = await convertToSeries(supabase, now.event ?? server, {
      data,
      rule: repeat.rule,
      timeZone,
      values: { ...values, repeat: asked ?? "none" },
    });
    return "id" in converted ? APPLIED : failed(formMessage(converted));
  }
  const saved = server.series
    ? await changeOccurrence(
        supabase,
        { ...server, series: server.series },
        { data, values, scope: "this", confirmLoss: true, timeZone },
      )
    : // Against what the provider has, so only what changed is sent (D1).
      await updateSingle(supabase, now.event ?? server, data, values);
  // Deleted in the provider while writing: as RF-6.
  if (typeof saved === "string") return { status: "conflict", server: null };
  if ("id" in saved) return APPLIED;
  const field = Object.values(saved.fieldErrors ?? {}).find(Boolean);
  return failedSynced(
    supabase,
    userId,
    server.calendarId,
    saved.formError ?? field,
  );
}

type SeriesChange = Extract<ParsedChange, { type: `series.${string}` }>;

/** The series as it is now, in the shape of the copy's base (spec 035 D3). */
async function seriesNow(
  supabase: Supabase,
  seriesId: string,
): Promise<SeriesBase | null> {
  const { data, error } = await supabase
    .from("events")
    .select(
      "id, calendar_id, title, description, location, color, category_id, starts_at, ends_at, all_day, recurrence, exdates",
    )
    .eq("id", seriesId)
    .maybeSingle();
  if (error) throw error;
  if (!data?.recurrence) return null;
  const { totals } = await totalsOf(supabase, [seriesId]);
  return {
    fields: {
      title: data.title,
      calendarId: data.calendar_id,
      allDay: data.all_day,
      startsAt: data.starts_at,
      endsAt: data.ends_at,
      description: data.description,
      location: data.location,
      color: data.color,
      categoryId: data.category_id,
    },
    recurrence: data.recurrence,
    exdates: data.exdates ?? [],
    totals: totals.get(seriesId) ?? {
      exceptions: 0,
      images: 0,
      comments: 0,
      latest: null,
    },
  };
}

/**
 * A change of a series made offline: applied in the chosen scope when the
 * series and what hangs from it are as the copy had them; otherwise a
 * conflict with the series now and what forcing it would lose (spec 035
 * RF-14, RF-15, plan D3).
 */
async function applySeries(
  supabase: Supabase,
  timeZone: string,
  change: SeriesChange,
  force: boolean,
): Promise<ApplyResult> {
  const server = await getEvent(supabase, change.id);
  const mine = change.type === "series.update" ? change.data : null;
  if (!server) {
    if (!(await canSeeCalendar(supabase, change.base.fields.calendarId))) {
      return failed(CALENDAR_MESSAGES.forbidden);
    }
    return mine ? { status: "conflict", server: null } : APPLIED;
  }
  // No longer a series (made single by someone else): ask with what it is.
  if (!server.series) {
    return { status: "conflict", server: fields(eventData(server)) };
  }
  const series = server.series;

  // A partial event did not know the description: it keeps the server's (R6).
  const data: EventData | null = mine && {
    ...mine,
    description:
      mine.description === undefined ? server.description : mine.description,
  };
  const values = data && {
    ...seriesValues(server, data, timeZone),
    repeat: change.type === "series.update" ? change.repeat : "none",
  };

  if (!force) {
    const now = await seriesNow(supabase, series.id);
    // shortcut: a resend after a lost answer finds the series changed and
    // asks; telling it apart from another person's change needs a mark.
    if (!now || !sameSeries(change.base, now)) {
      const plan =
        data && values
          ? planSeriesChange({
              series,
              occurrence: server,
              row: toRow(data),
              repeat: values.repeat,
              startDate: values.startDate,
              scope: change.scope,
              timeZone,
            })
          : {
              kind: "delete" as const,
              ...planSeriesDelete(series, change.scope),
            };
      const loss =
        plan.kind === "error"
          ? null
          : await unconfirmedLoss(supabase, series.id, plan.loss, false);
      return {
        status: "conflict",
        server: now
          ? {
              ...fields(now.fields),
              recurrence: now.recurrence,
              exdates: now.exdates,
              totals: now.totals,
              loss,
            }
          : null,
      };
    }
  }

  if (!data || !values) {
    const result = await deleteOccurrences(
      supabase,
      series,
      change.scope,
      true,
    );
    return result ? failed(result.formError) : APPLIED;
  }
  const saved = await changeOccurrence(
    supabase,
    { ...server, series },
    { data, values, scope: change.scope, confirmLoss: true, timeZone },
  );
  return "id" in saved ? APPLIED : failed(formMessage(saved));
}

type CommentChange = Extract<ParsedChange, { type: `comment.${string}` }>;

/** Whether the event of a comment can still be seen (not deleted, not expelled). */
async function eventVisible(supabase: Supabase, eventId: string) {
  return (await commentRowFor(supabase, eventId)) !== null;
}

/** Comments made offline (spec 035 RF-21, RF-22, RF-26 to RF-28). */
async function applyComment(
  supabase: Supabase,
  change: CommentChange,
  force: boolean,
): Promise<ApplyResult> {
  if (change.type === "comment.add") {
    const row = await commentRowFor(supabase, change.eventId);
    if (row === null) return failed(COMMENT_MESSAGES.gone);
    let eventId = row?.id;
    if (!eventId) {
      // An occurrence without its own row gets one first, as with a connection.
      const created = await materializeWith(supabase, change.eventId);
      if ("error" in created) return failed(COMMENT_MESSAGES.gone);
      eventId = created.eventId;
    }
    const { error } = await supabase.from("event_comments").insert({
      event_id: eventId,
      body: change.body,
      client_id: change.clientId,
    });
    // The same client id: it was saved by an earlier send (RF-22).
    if (error && error.code !== "23505") {
      return failed(getCommentErrorMessage(error));
    }
    return APPLIED;
  }

  const { data: current, error } = await supabase
    .from("event_comments")
    .select("body")
    .eq("id", change.id)
    .maybeSingle();
  if (error) throw error;
  if (!current) {
    // Deleted event or expelled: refused; only the comment gone: as asked.
    if (!(await eventVisible(supabase, change.eventId))) {
      return failed(COMMENT_MESSAGES.gone);
    }
    return change.type === "comment.delete"
      ? APPLIED
      : failed(COMMENT_MESSAGES.commentGone);
  }
  const mine = change.type === "comment.update" ? { body: change.body } : null;
  if (!force) {
    const verdict = verdictOrGone(change.base, mine, current);
    if (verdict === "applied") return APPLIED;
    if (verdict === "conflict") return { status: "conflict", server: current };
  }
  const write =
    change.type === "comment.update"
      ? supabase
          .from("event_comments")
          .update({ body: change.body })
          .eq("id", change.id)
          .select("id")
      : supabase
          .from("event_comments")
          .delete()
          .eq("id", change.id)
          .select("id");
  const { data: rows, error: writeError } = await write;
  if (writeError) return failed(getCommentErrorMessage(writeError));
  return rows && rows.length > 0 ? APPLIED : failed(COMMENT_MESSAGES.forbidden);
}

/** An image deleted offline: with the policy of always (spec 035 RF-38). */
async function applyImageDelete(
  supabase: Supabase,
  id: string,
): Promise<ApplyResult> {
  const { data, error } = await supabase
    .from("event_images")
    .delete()
    .eq("id", id)
    .select("object_id");
  if (error) return failed(getImageErrorMessage(error));
  if (!data || data.length === 0) {
    const { data: visible, error: readError } = await supabase
      .from("event_images")
      .select("id")
      .eq("id", id)
      .maybeSingle();
    if (readError) throw readError;
    // Still there: not allowed. Gone already: nothing left to do.
    return visible ? failed(IMAGE_MESSAGES.forbidden) : APPLIED;
  }
  // The trigger queued the objects; if this fails the hourly purge does it.
  try {
    const { supabase: anon, secret } = purgeDeps();
    await purgeObjects(
      anon,
      secret,
      data.map((row) => row.object_id),
    );
  } catch {}
  return APPLIED;
}

function noteFields(note: Note): Fields {
  return {
    title: note.title,
    body: note.body,
    color: note.color,
    pinned: note.pinned,
    archived: note.archived,
    dueDate: note.dueDate,
  };
}

function noteRow({ dueDate, ...rest }: NoteFields) {
  return { ...rest, ...(dueDate !== undefined ? { due_date: dueDate } : {}) };
}

async function itemNow(supabase: Supabase, id: string) {
  const { data, error } = await supabase
    .from("note_items")
    .select("text, done")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** One write of notes: an error in the user's words, or "gone" for 0 rows. */
async function noteWrite(
  write: PromiseLike<{
    data: unknown[] | null;
    error: { code?: string; message?: string } | null;
  }>,
): Promise<ApplyResult> {
  const { data, error } = await write;
  if (error) return failed(getNoteErrorMessage(error));
  return data && data.length > 0 ? APPLIED : failed(NOTE_MESSAGES.gone);
}

type NoteChange = Extract<
  ParsedChange,
  { type: `note.${string}` | `item.${string}` }
>;

async function applyNote(
  supabase: Supabase,
  change: NoteChange,
  force: boolean,
): Promise<ApplyResult> {
  switch (change.type) {
    case "note.create": {
      if (await getNote(supabase, change.id)) return APPLIED;
      const { title, ...rest } = change.fields;
      const inserted = await noteWrite(
        supabase
          .from("notes")
          .insert({
            id: change.id,
            kind: change.kind,
            title: title ?? "",
            calendar_id: change.calendarId,
          })
          .select("id"),
      );
      if (inserted.status !== "applied" || Object.keys(rest).length === 0) {
        return inserted;
      }
      return noteWrite(
        supabase
          .from("notes")
          .update(noteRow(rest))
          .eq("id", change.id)
          .select("id"),
      );
    }
    case "note.update":
    case "note.delete": {
      const note = await getNote(supabase, change.id);
      const current = note ? noteFields(note) : null;
      const mine =
        change.type === "note.update"
          ? { ...change.base, ...change.fields }
          : null;
      if (!force) {
        const verdict = verdictOrGone(change.base, mine, current);
        if (verdict === "applied") return APPLIED;
        if (verdict === "conflict")
          return { status: "conflict", server: current };
      }
      if (!note) return mine ? failed(NOTE_MESSAGES.gone) : APPLIED;
      return change.type === "note.update"
        ? noteWrite(
            supabase
              .from("notes")
              .update(noteRow(change.fields))
              .eq("id", change.id)
              .select("id"),
          )
        : noteWrite(
            supabase.from("notes").delete().eq("id", change.id).select("id"),
          );
    }
    case "item.add": {
      if (await itemNow(supabase, change.id)) return APPLIED;
      const { error } = await supabase.from("note_items").insert({
        id: change.id,
        note_id: change.noteId,
        text: change.text,
        position: change.position,
        done: change.done,
      });
      if (!error) return APPLIED;
      return failed(
        error.code === "42501"
          ? NOTE_MESSAGES.gone
          : getNoteErrorMessage(error),
      );
    }
    case "item.update":
    case "item.delete": {
      const current = await itemNow(supabase, change.id);
      const mine =
        change.type === "item.update"
          ? { ...change.base, ...change.change }
          : null;
      if (!force) {
        const verdict = verdictOrGone(change.base, mine, current);
        if (verdict === "applied") return APPLIED;
        if (verdict === "conflict")
          return { status: "conflict", server: current };
      }
      if (!current) return mine ? failed(NOTE_MESSAGES.gone) : APPLIED;
      return change.type === "item.update"
        ? noteWrite(
            supabase
              .from("note_items")
              .update(change.change)
              .eq("id", change.id)
              .select("id"),
          )
        : noteWrite(
            supabase
              .from("note_items")
              .delete()
              .eq("id", change.id)
              .select("id"),
          );
    }
    case "item.move": {
      // The order never asks (decision of the user, plan): it goes over the
      // current one, and items that are gone are left out.
      const results = await Promise.all(
        change.positions.map(({ id, position }) =>
          supabase
            .from("note_items")
            .update({ position })
            .eq("id", id)
            .eq("note_id", change.noteId),
        ),
      );
      const error = results.find((result) => result.error)?.error;
      return error ? failed(getNoteErrorMessage(error)) : APPLIED;
    }
  }
}

/** One change of the queue, in the user's session (plan "Contratos"). */
export async function applyChange(
  supabase: Supabase,
  userId: string,
  timeZone: string,
  change: ParsedChange,
  force = false,
): Promise<ApplyResult> {
  try {
    if (change.type.startsWith("event.")) {
      return await applyEvent(
        supabase,
        userId,
        timeZone,
        change as EventChange,
        force,
      );
    }
    if (change.type.startsWith("note.") || change.type.startsWith("item.")) {
      return await applyNote(supabase, change as NoteChange, force);
    }
    if (change.type.startsWith("series.")) {
      return await applySeries(
        supabase,
        timeZone,
        change as SeriesChange,
        force,
      );
    }
    if (change.type.startsWith("comment.")) {
      return await applyComment(supabase, change as CommentChange, force);
    }
    if (change.type === "image.delete") {
      return await applyImageDelete(supabase, change.id);
    }
    return failed(OFFLINE_MESSAGES.needsNetwork);
  } catch {
    // The network or Supabase failed: keep it for later (RF-46).
    return { status: "retry" };
  }
}
