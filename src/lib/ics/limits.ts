// Limits of an .ics import (spec 004; plan D6, D8, D12).

/** Largest file or download accepted: 2 MB (RF-26). */
export const MAX_BYTES = 2 * 1024 * 1024;

/** Most events a calendar may be created with, once repetitions are expanded (RF-27). */
export const MAX_EVENTS = 2000;

/** Counting stops here so the message can say "more than 20,000" (plan D8). */
export const COUNT_CAP = 20_000;

/** Open-ended series are created this many months ahead of the import day (RF-23). */
export const HORIZON_MONTHS = 12;

/** Longest wait for a download (RF-5). */
export const FETCH_TIMEOUT_MS = 15_000;

/** Redirects followed when downloading, each one validated again (plan D6). */
export const MAX_REDIRECTS = 3;
