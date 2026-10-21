import { convertOccurrences, type EventRow } from "./convert-events";
import type { ImportError } from "./error-messages";
import { fetchIcs as defaultFetchIcs, type FetchResult } from "./fetch-ics";
import { MAX_EVENTS } from "./limits";
import { parseIcs } from "./parse-ics";
import type { IcsSource } from "./read-source";

const DEFAULT_NAME = "Calendario importado";
const MAX_NAME = 50;

export interface RunImportInput {
  source: IcsSource;
  /** Zone of the profile, read on the server: floating times use it (plan D3). */
  profileTimeZone: string;
  today: { year: number; month: number; day: number };
  /** The name typed in the form, or null to use the one of the .ics (RF-8, RF-9). */
  name: string | null;
}

export type RunImportResult =
  | {
      ok: true;
      name: string;
      events: EventRow[];
      /** Events that could not be converted (RF-29). */
      skipped: number;
      /** Series cut at the one-year horizon (RF-23). */
      cutSeries: number;
    }
  | { ok: false; error: ImportError };

/**
 * Source -> text -> occurrences -> event rows, applying the 2,000-event limit
 * to the events that can actually be created (RF-27). It does not touch the
 * database, so it can be tested without network (plan "Módulos").
 */
export async function runImport(
  input: RunImportInput,
  deps: { fetchIcs?: (url: URL) => Promise<FetchResult> } = {},
): Promise<RunImportResult> {
  let text: string;
  if (input.source.kind === "text") {
    text = input.source.text;
  } else {
    const downloaded = await (deps.fetchIcs ?? defaultFetchIcs)(
      input.source.url,
    );
    if (!downloaded.ok) return { ok: false, error: { kind: downloaded.error } };
    text = downloaded.text;
  }

  const parsed = parseIcs(text, { today: input.today });
  if (!parsed.ok) return { ok: false, error: { kind: parsed.error } };

  const { events, skipped } = convertOccurrences(
    parsed.occurrences,
    input.profileTimeZone,
  );
  if (events.length === 0) return { ok: false, error: { kind: "no-events" } };
  if (parsed.capped || events.length > MAX_EVENTS) {
    return {
      ok: false,
      error: {
        kind: "too-many",
        count: parsed.capped ? parsed.occurrences.length : events.length,
        capped: parsed.capped,
      },
    };
  }

  const name =
    input.name ??
    (parsed.calendarName
      ? Array.from(parsed.calendarName).slice(0, MAX_NAME).join("")
      : DEFAULT_NAME);
  return {
    ok: true,
    name,
    events,
    skipped: skipped + parsed.unreadable,
    cutSeries: parsed.cutSeries,
  };
}
