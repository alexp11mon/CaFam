import type { FormState } from "@/lib/forms/form-state";
import type { ImportField } from "./schemas";

/** What a finished import reports (RF-31). */
export interface ImportSummaryData {
  calendarId: string;
  created: number;
  skipped: number;
  cutSeries: number;
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
};
