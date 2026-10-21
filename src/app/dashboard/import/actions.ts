"use server";

import { revalidatePath } from "next/cache";
import { getProfileTimeZone, requireActionUser } from "@/lib/calendar/queries";
import { readString } from "@/lib/forms/form-state";
import { getImportErrorMessage } from "@/lib/ics/error-messages";
import { runImport } from "@/lib/ics/import-calendar";
import { EMPTY_IMPORT_VALUES, type ImportState } from "@/lib/ics/import-state";
import { getFile, readIcsSource } from "@/lib/ics/read-source";
import { parseImportForm } from "@/lib/ics/schemas";
import type { Json } from "@/types/database";

// Reads an .ics once (a link or a file) and creates a new calendar from it
// (spec 004). Neither the link nor the file is stored, and no message carries
// the link (RF-6).
export async function importCalendar(
  _prevState: ImportState,
  formData: FormData,
): Promise<ImportState> {
  const values = {
    ...EMPTY_IMPORT_VALUES,
    url: readString(formData, "url"),
    name: readString(formData, "name"),
    color: readString(formData, "color"),
  };

  const parsed = parseImportForm({
    url: values.url,
    hasFile: getFile(formData) !== null,
    name: values.name,
    color: values.color,
  });
  if (!parsed.ok) return { fieldErrors: parsed.fieldErrors, values };

  const { supabase, userId } = await requireActionUser();

  const source = await readIcsSource(formData);
  if (!source.ok) {
    return { formError: getImportErrorMessage(source.error), values };
  }

  // The zone of the profile comes from the database, never from the client (spec 002 RF-34).
  const profileTimeZone = await getProfileTimeZone(supabase, userId);
  const now = new Date();
  const imported = await runImport({
    source: source.source,
    profileTimeZone,
    today: {
      year: now.getUTCFullYear(),
      month: now.getUTCMonth() + 1,
      day: now.getUTCDate(),
    },
    name: parsed.data.name,
  });
  if (!imported.ok) {
    return { formError: getImportErrorMessage(imported.error), values };
  }

  // One transaction: the calendar and all its events, or nothing (RF-30).
  const { data, error } = await supabase.rpc("import_calendar", {
    p_name: imported.name,
    p_color: parsed.data.color,
    p_events: imported.events as unknown as Json,
  });
  if (error || !data) {
    return {
      formError: getImportErrorMessage({ kind: "create-failed" }),
      values,
    };
  }

  revalidatePath("/dashboard", "layout");
  return {
    values: EMPTY_IMPORT_VALUES,
    result: {
      calendarId: data,
      created: imported.events.length,
      skipped: imported.skipped,
      cutSeries: imported.cutSeries,
    },
  };
}
