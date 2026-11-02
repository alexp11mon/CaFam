// Limits of the chat assistant (spec 015).

/** RF-3: a question has 1 to 500 characters. */
export const QUESTION_MAX = 500;
/** Assistant answers sent back in the thread (plan contract). */
export const ANSWER_MAX = 4000;
/** Messages of the thread sent with each question (plan D4). */
export const MAX_MESSAGES = 20;
/** RF-27: answered questions per user and day. */
export const DAILY_QUESTIONS = 30;
/** RF-24: longest period for free time. */
export const MAX_FREE_DAYS = 31;
/** Longest period for list_events (plan contract). */
export const MAX_LIST_DAYS = 62;
/** Edge case "muchos eventos": events sent to the model per list. */
export const MAX_LISTED_EVENTS = 50;
/** RF-9: matches returned by search_events. */
export const MAX_SEARCH_RESULTS = 20;
/** search_events looks this many days back and ahead (plan D11). */
export const SEARCH_WINDOW_DAYS = 365;
/** D8: shorter free gaps are not worth proposing. */
export const MIN_FREE_MINUTES = 30;
/** R1: model-tools rounds per question. */
export const MAX_TOOL_ROUNDS = 3;

export interface TimeRange {
  start: string; // HH:MM
  end: string; // HH:MM, "24:00" = midnight
}

/** RF-17: morning, afternoon and night in the asker's zone. */
export const DEFAULT_RANGES: readonly TimeRange[] = [
  { start: "08:00", end: "14:00" },
  { start: "16:00", end: "21:00" },
  { start: "21:00", end: "24:00" },
];
