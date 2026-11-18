// Limits of the event search (spec 039).
/** Characters before searching while typing (RF-8). */
export const MIN_QUERY = 2;
/** Wait after the last key (RF-8). */
export const SEARCH_DEBOUNCE_MS = 350;
/** Rows at most; more says "afina la búsqueda" (RF-8). */
export const MAX_RESULTS = 100;
/** Default period for series occurrences, in years (RF-5, plan D4). */
export const YEARS_BACK = 1;
export const YEARS_AHEAD = 2;
/** "Buscar más atrás" widens the start by this many years (RF-5). */
export const MORE_BACK_YEARS = 2;
/** Last searches kept on the device (RF-9). */
export const MAX_RECENT = 5;
/** Longest query sent to the server. */
export const MAX_QUERY = 100;
