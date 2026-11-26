import { spanishT, type T } from "@/lib/i18n/translate";
// The trash screen (spec 046 RF-3 to RF-6): pure texts and grouping.

const DAY = 86_400_000;

export const TRASH_ERRORS = {
  gone: "Ya no está en la papelera.",
} as const;

export interface TrashEntry {
  id: string;
  calendarId: string;
  kind: "event" | "occurrence" | "series";
  title: string;
  startsAt: string;
  endsAt: string;
  allDay: boolean;
  occurrences: number | null;
  images: number;
  comments: number;
  deletedByName: string | null;
  createdAt: string;
  expiresAt: string;
}

export interface TrashCalendar {
  id: string;
  name: string;
  color: string;
  isOwner: boolean;
}

export interface TrashGroup {
  calendar: TrashCalendar;
  entries: TrashEntry[];
}

/** By calendar, in the order of "Mis calendarios"; the newest deletion first. */
export function groupTrash(
  entries: readonly TrashEntry[],
  calendars: readonly TrashCalendar[],
): TrashGroup[] {
  return calendars
    .map((calendar) => ({
      calendar,
      entries: entries
        .filter((entry) => entry.calendarId === calendar.id)
        .toSorted((a, b) => b.createdAt.localeCompare(a.createdAt)),
    }))
    .filter((group) => group.entries.length > 0);
}

/** "Borrado por Ana hace 2 días"; a deleted account or one who left says so. */
export function deletedText(
  entry: TrashEntry,
  now: Date,
  t: T = spanishT,
): string {
  const who = entry.deletedByName ?? t("una cuenta borrada");
  const days = Math.floor((now.getTime() - Date.parse(entry.createdAt)) / DAY);
  if (days <= 0) return t("Borrado por {who} hoy", { who });
  if (days === 1) return t("Borrado por {who} ayer", { who });
  return t("Borrado por {who} hace {days} días", { who, days });
}

/** "Quedan 28 días" until pg_cron deletes it for good (RF-7). */
export function remainingText(
  expiresAt: string,
  now: Date,
  t: T = spanishT,
): string {
  const days = Math.ceil((Date.parse(expiresAt) - now.getTime()) / DAY);
  if (days <= 1) return t("Queda menos de 1 día");
  return t("Quedan {days} días", { days });
}

/** "serie, 24 repeticiones", "repetición de una serie", or nothing. */
export function kindText(entry: TrashEntry, t: T = spanishT): string | null {
  if (entry.kind === "occurrence") return t("repetición de una serie");
  if (entry.kind !== "series") return null;
  if (!entry.occurrences) return t("serie");
  return entry.occurrences === 1
    ? t("serie, 1 repetición")
    : t("serie, {count} repeticiones", { count: entry.occurrences });
}
