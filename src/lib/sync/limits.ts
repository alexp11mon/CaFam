// Limits of calendar sync (spec 007; plan D3, D17, D19).

/** Connected accounts per user (RF-8). */
export const MAX_ACCOUNTS = 5;

/** Synced calendars per connected account (RF-14). */
export const MAX_CALENDARS_PER_ACCOUNT = 20;

/** Events kept per calendar, the nearest to today (RF-19). */
export const MAX_EVENTS = 2000;

/** Events read from the provider at most, so a huge account fits in 60 s (plan D17). */
export const MAX_FETCHED_EVENTS = 10_000;

/** Window of events: months before and after today (RF-15). */
export const MONTHS_BACK = 6;
export const MONTHS_AHEAD = 12;

/** "Actualizar ahora" waits this long since the last update (RF-24). */
export const MANUAL_COOLDOWN_MS = 5 * 60_000;

/** Failed updates in a row before the user is told (RF-34). */
export const FAILURES_BEFORE_NOTICE = 3;

/** Every synced calendar is updated at least this often (RF-22). */
export const AUTO_INTERVAL_HOURS = 6;

// Fast sync (spec 020 plan D7 to D9). Mirrored in sync_due_calendars.

/** A calendar is checked at least this often (RF-23, RF-26). */
export const POLL_MINUTES = 15;

/** After a Google notice, wait this long since the last attempt (RF-24). */
export const PUSH_DEBOUNCE_MS = 60_000;

/** Everything is read again this often even if the version did not change (R3). */
export const FULL_READ_HOURS = 6;

/** A Google channel is renewed when it has less than this left (D8). */
export const CHANNEL_RENEW_HOURS = 24;

/** What a Google channel is asked to last; Google caps it at 7 days (T1). */
export const CHANNEL_TTL_DAYS = 7;
