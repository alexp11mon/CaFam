// Limits of spec 013. The database enforces the per-calendar and per-series
// ones (enforce_series_rules); these feed validation and messages.

/** "Cada N días, semanas, meses o años" (RF-3). */
export const MAX_INTERVAL = 99;
/** "Tras N repeticiones" (RF-4). */
export const MAX_COUNT = 999;
export const MAX_SERIES_PER_CALENDAR = 500; // RF-31
export const MAX_EXCEPTIONS = 100; // RF-32
/** Same as the check of events.recurrence. */
export const MAX_RRULE_LENGTH = 200;
