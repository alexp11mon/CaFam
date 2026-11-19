import type { FormState } from "@/lib/forms/form-state";
import type { ImportField } from "./schemas";

/** What a finished import reports (RF-31). */
export interface ImportSummaryData {
  calendarId: string;
  /** Imported into a calendar that already existed (spec 044 RF-3). */
  into?: { name: string; existing: number };
  created: number;
  skipped: number;
  cutSeries: number;
  /** Kept updated from its link, or the link could not be saved (spec 044 RF-5). */
  kept?: "yes" | "failed";
}

/** Result of the `importCalendar` Server Action: the usual form state plus the summary. */
export type ImportState = FormState<ImportField> & {
  result?: ImportSummaryData;
};

export const EMPTY_IMPORT_VALUES: ImportState["values"] = {
  url: "",
  file: "",
  name: "",
  color: "",
  destination: "new",
  calendar: "",
  keep: "",
};
