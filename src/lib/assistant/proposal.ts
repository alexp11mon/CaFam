import { z } from "zod";
import { addDays } from "@/lib/calendar/time-zone";
import { markDuplicates, type ExistingEvent } from "./duplicates";
import { MAX_PROPOSAL, TITLE_MAX } from "./limits";
import { matchPerson } from "./people-match";
import { rowInstants } from "./proposal-rows";
import { AssistantUnavailable } from "./provider";
import type { ProposalRow } from "./schemas";

// The model's proposal checked and completed with the session (spec 022, plan
// "proposal", D3, D8). The model only reads the images: which calendar, the
// limit, the zone and the duplicates are decided here. Writes nothing (RF-40).

export interface Proposal {
  id: string;
  rows: ProposalRow[];
  omitted: number;
}

export type ProposalResult =
  | { kind: "message"; text: string }
  | { kind: "proposal"; text: string; proposal: Proposal };

export interface ProposalCalendar {
  id: string;
  name: string;
  /** canWriteEvents of spec 009: role and provider permission (RF-26). */
  canWrite: boolean;
}

export interface ProposalDeps {
  calendars: readonly ProposalCalendar[];
  timeZone: string;
  /** Events the user sees in the range, series expanded (getEventsInRange). */
  loadEvents: (from: Date, to: Date) => Promise<readonly ExistingEvent[]>;
}

export const DEFAULT_TITLE = "Trabajo";

export const PROPOSAL_TEXTS = {
  nothingFound:
    "No he encontrado ningún horario ni evento en la imagen. Prueba con una foto más nítida o una captura.",
  noWritable: "No tienes ningún calendario en el que puedas crear eventos.",
} as const;

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
// The model sometimes writes "8:00": it is padded below.
const time = z.string().regex(/^\d{1,2}:\d{2}$/);
const text = z.string().max(1000).nullish();

/** Plan "Modelo de datos": the JSON the model must answer (D3). */
const modelSchema = z.object({
  question: text,
  calendar: text,
  person: text,
  unreadable: text,
  events: z
    .array(
      z.object({
        title: text,
        date,
        start: time.nullish(),
        end: time.nullish(),
        endDate: date.nullish(),
        allDay: z.boolean().nullish(),
      }),
    )
    .max(200)
    .default([]),
});

const pad = (value: string) => value.padStart(5, "0");
const names = (calendars: readonly ProposalCalendar[]) =>
  calendars
    .map((c) => c.name)
    .sort((a, b) => a.localeCompare(b, "es"))
    .join(", ");

/** RF-27 to RF-30: the calendar named in the conversation, or why not. */
function chooseCalendar(
  named: string | null | undefined,
  calendars: readonly ProposalCalendar[],
): { id: string } | { text: string } {
  const writable = calendars.filter((c) => c.canWrite);
  if (writable.length === 0) return { text: PROPOSAL_TEXTS.noWritable };
  const options = names(writable);
  if (!named?.trim()) {
    return {
      text: `¿En qué calendario creo los eventos? Puedes elegir: ${options}.`,
    };
  }
  const match = matchPerson(named, writable);
  if (match.status === "ok") return { id: match.person.id };
  if (match.status === "ambiguous") {
    return {
      text: `¿En cuál de estos calendarios? ${match.options.join(", ")}.`,
    };
  }
  const readOnly = matchPerson(named, calendars);
  if (readOnly.status === "ok") {
    return {
      text: `No puedes crear eventos en «${readOnly.person.name}». Puedes crear eventos en: ${options}.`,
    };
  }
  return {
    text: `No encuentro el calendario «${named.trim()}». Puedes crear eventos en: ${options}.`,
  };
}

type ModelEvent = z.infer<typeof modelSchema>["events"][number];

function toRow(event: ModelEvent, calendarId: string): ProposalRow {
  const start = event.start ? pad(event.start) : null;
  const end = event.end ? pad(event.end) : null;
  const allDay = Boolean(event.allDay) || !start || !end;
  // RF-18: a shift ending at or before its start ends the next day.
  const endDate =
    event.endDate ??
    (!allDay && end! <= start! ? addDays(event.date, 1) : event.date);
  const title = event.title?.trim().slice(0, TITLE_MAX) || DEFAULT_TITLE;
  return {
    key: "",
    title,
    startDate: event.date,
    start: allDay ? null : start,
    endDate,
    end: allDay ? null : end,
    allDay,
    calendarId,
    selected: true,
    duplicate: false,
  };
}

const sortKey = (row: ProposalRow) =>
  `${row.startDate}T${row.start ?? "00:00"}|${row.endDate}T${row.end ?? "24:00"}|${row.title}`;

export async function buildProposal(
  raw: string,
  deps: ProposalDeps,
): Promise<ProposalResult> {
  let parsed;
  try {
    parsed = modelSchema.safeParse(JSON.parse(raw));
  } catch {
    parsed = null;
  }
  // RF-54: an answer that is not the agreed JSON is the provider failing.
  if (!parsed?.success) throw new AssistantUnavailable("invalid proposal JSON");
  const answer = parsed.data;

  if (answer.question?.trim()) {
    return { kind: "message", text: answer.question.trim() };
  }
  if (answer.events.length === 0) {
    return { kind: "message", text: PROPOSAL_TEXTS.nothingFound };
  }
  const calendar = chooseCalendar(answer.calendar, deps.calendars);
  if ("text" in calendar) return { kind: "message", text: calendar.text };

  // Two images may repeat a day: the same row is proposed once.
  const unique = new Map<string, ProposalRow>();
  for (const event of answer.events) {
    const row = toRow(event, calendar.id);
    unique.set(sortKey(row), row);
  }
  const sorted = [...unique.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([, row]) => row);
  const kept = sorted
    .slice(0, MAX_PROPOSAL)
    .map((row, i) => ({ ...row, key: `r${i + 1}` }));

  const instants = kept
    .map((row) => rowInstants(row, deps.timeZone))
    .filter((range) => range !== null);
  const from = Math.min(...instants.map((r) => Date.parse(r.startsAt)));
  const to = Math.max(...instants.map((r) => Date.parse(r.endsAt)));
  const events = instants.length
    ? await deps.loadEvents(
        new Date(from - 86_400_000),
        new Date(to + 86_400_000),
      )
    : [];
  const rows = markDuplicates(kept, events, deps.timeZone);

  const omitted = sorted.length - kept.length;
  const lines = [
    rows.length === 1
      ? "He leído 1 evento. Revísalo y pulsa «Crear»."
      : `He leído ${rows.length} eventos. Revísalos y pulsa «Crear».`,
  ];
  if (omitted > 0) {
    lines.push(
      `He dejado fuera ${omitted} ${omitted === 1 ? "evento" : "eventos"}: como mucho propongo ${MAX_PROPOSAL}.`,
    );
  }
  if (answer.unreadable?.trim()) {
    lines.push(
      `No he podido leer: ${answer.unreadable.trim().replace(/\.$/, "")}.`,
    );
  }
  return {
    kind: "proposal",
    text: lines.join(" "),
    proposal: { id: crypto.randomUUID(), rows, omitted },
  };
}
