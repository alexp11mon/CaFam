export type LiveDecision = "ignore" | "hold" | "refresh";

/**
 * What a change message does (spec 019 plan D5, D6): the user's own changes
 * are already on screen; the rest refresh, after any drag, quick window or
 * edit form is done (RF-43).
 */
export function liveDecision({
  actor,
  me,
  held,
}: {
  actor: string | null;
  me: string;
  held: boolean;
}): LiveDecision {
  if (actor === me) return "ignore";
  return held ? "hold" : "refresh";
}
