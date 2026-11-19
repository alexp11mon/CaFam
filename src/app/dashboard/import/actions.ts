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

// Reads an .ics (a link or a file) into a new calendar (spec 004) or one that
// exists (spec 044). The link is stored only when the user asks to keep the
// calendar updated, and then in Vault (spec 044 plan D3); no message carries
// it (RF-6).
export async function importCalendar(
  _prevState: ImportState,
  formData: FormData,
): Promise<ImportState> {
  const values = {
    ...EMPTY_IMPORT_VALUES,
    url: readString(formData, "url"),
    name: readString(formData, "name"),
    color: readString(formData, "color"),
    destination: readString(formData, "destination") || "new",
    calendar: readString(formData, "calendar"),
    keep: readString(formData, "keep"),
  };

  const parsed = parseImportForm({
    url: values.url,
    hasFile: getFile(formData) !== null,
    name: values.name,
    color: values.color,
    destination: values.destination,
    calendarId: values.calendar,
    keep: values.keep === "on",
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

  // Saves the link to keep the calendar updated (spec 044 RF-5). The events are
  // already in: a failure here only says so in the summary.
  const subscribe = async (calendarId: string) => {
    if (!parsed.data.keep || source.source.kind !== "url") return undefined;
    const { error } = await supabase.rpc("create_ics_subscription", {
      p_calendar_id: calendarId,
      p_url: source.source.url.href,
      p_ids: imported.events.map((event) => event.external_id),
    });
    return error ? ("failed" as const) : ("yes" as const);
  };

  const into = parsed.data.into;
  if (into) {
    // Into a calendar that exists: what is already there stays (spec 044 RF-2).
    const [{ data, error }, { data: calendar }] = await Promise.all([
      supabase.rpc("import_into_calendar", {
        p_calendar_id: into,
        p_events: imported.events as unknown as Json,
      }),
      supabase.from("calendars").select("name").eq("id", into).maybeSingle(),
    ]);
    if (error || !data) {
      const kind =
        error?.code === "CF429"
          ? "too-many-imported"
          : error?.code === "CF404" || error?.code === "22023"
            ? "not-writable"
            : "create-failed";
      return { formError: getImportErrorMessage({ kind }), values };
    }
    const counts = data as { added: number; existing: number };
    const kept = await subscribe(into);
    revalidatePath("/dashboard", "layout");
    return {
      values: {
        ...EMPTY_IMPORT_VALUES,
        destination: "existing",
        calendar: into,
      },
      result: {
        calendarId: into,
        into: { name: calendar?.name ?? "", existing: counts.existing },
        created: counts.added,
        skipped: imported.skipped,
        cutSeries: imported.cutSeries,
        kept,
      },
    };
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

  const kept = await subscribe(data);
  revalidatePath("/dashboard", "layout");
  return {
    values: EMPTY_IMPORT_VALUES,
    result: {
      calendarId: data,
      created: imported.events.length,
      skipped: imported.skipped,
      cutSeries: imported.cutSeries,
      kept,
    },
  };
}
