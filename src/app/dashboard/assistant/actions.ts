"use server";

import { proposalSchema, type ProposalRow } from "@/lib/assistant/schemas";
import { getCalendarErrorMessage } from "@/lib/calendar/error-messages";
import { getProfileTimeZone, requireActionUser } from "@/lib/calendar/queries";
import { refresh } from "../events/event-writes";
import {
  INVALID_PROPOSAL,
  checkRows,
  createRows,
  type CreateResult,
} from "./proposal-writes";

// The proposal's actions (spec 022 plan "actions", D4). The rows come from
// the browser: validated here, and the zone is the profile's (RF-19).

export type CheckResult =
  { rows: ProposalRow[]; errors: Record<string, string> } | { error: string };

export type CreateProposalResult =
  { results: CreateResult[] } | { error: string };

/** RF-39: duplicates and permissions after an edit. */
export async function checkProposal(rows: unknown): Promise<CheckResult> {
  const parsed = proposalSchema.safeParse(rows);
  if (!parsed.success) return { error: INVALID_PROPOSAL };
  const { supabase, userId } = await requireActionUser();
  try {
    const timeZone = await getProfileTimeZone(supabase, userId);
    return await checkRows(supabase, userId, timeZone, parsed.data);
  } catch (error) {
    return { error: getCalendarErrorMessage(error) };
  }
}

/** RF-40, RF-43: only now is anything written. */
export async function createProposedEvents(
  rows: unknown,
): Promise<CreateProposalResult> {
  const parsed = proposalSchema.safeParse(rows);
  if (!parsed.success) return { error: INVALID_PROPOSAL };
  const { supabase, userId } = await requireActionUser();
  try {
    const timeZone = await getProfileTimeZone(supabase, userId);
    const results = await createRows(supabase, userId, timeZone, parsed.data);
    if (results.some((result) => result.ok)) refresh();
    return { results };
  } catch (error) {
    return { error: getCalendarErrorMessage(error) };
  }
}
