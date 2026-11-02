import { quotaDayStart } from "@/lib/assistant/dates";
import {
  INVALID_TEXT,
  QUESTION_MESSAGES,
  QUOTA_TEXT,
  SESSION_TEXT,
  UNAVAILABLE_TEXT,
} from "@/lib/assistant/error-messages";
import { DAILY_QUESTIONS } from "@/lib/assistant/limits";
import {
  AssistantUnavailable,
  PROVIDER_TRAINS_ON_DATA,
  chat,
} from "@/lib/assistant/provider";
import { runAssistant } from "@/lib/assistant/run";
import { assistantRequestSchema } from "@/lib/assistant/schemas";
import { runTool } from "@/lib/assistant/tools";
import { getProfileTimeZone } from "@/lib/calendar/queries";
import { createClient } from "@/lib/supabase/server";

// Spec 015 plan assistant-route (D3): one question of the chat. The thread is
// not stored (RF-6); only answered questions count for the quota (D9).
export const maxDuration = 30;

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims.sub;
  if (!userId) return Response.json({ error: SESSION_TEXT }, { status: 401 });

  const parsed = assistantRequestSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    // A bad question gets its own message (RF-3); anything else is a broken thread.
    const known = Object.values(QUESTION_MESSAGES) as string[];
    const message = parsed.error.issues.find((issue) =>
      known.includes(issue.message),
    )?.message;
    return Response.json({ error: message ?? INVALID_TEXT }, { status: 400 });
  }

  const timeZone = await getProfileTimeZone(supabase, userId);
  const now = new Date();
  const { count, error: countError } = await supabase
    .from("assistant_questions")
    .select("id", { count: "exact", head: true })
    .gte("asked_at", quotaDayStart(now, timeZone).toISOString());
  if (countError) throw countError;
  const used = count ?? 0;
  if (used >= DAILY_QUESTIONS) {
    return Response.json({ error: QUOTA_TEXT }, { status: 429 });
  }

  let result;
  try {
    result = await runAssistant(
      parsed.data.messages,
      {
        chat,
        // RF-29: the tools always act as the session user, whatever the thread says.
        runTool: (name, args, refs) =>
          runTool(name, args, {
            supabase,
            userId,
            timeZone,
            now,
            refs,
            excludeSynced: PROVIDER_TRAINS_ON_DATA,
          }),
        now,
        timeZone,
      },
      request.signal,
    );
  } catch (error) {
    // The user cancelled (RF-4): nobody reads this answer.
    if (request.signal.aborted) return new Response(null, { status: 499 });
    if (!(error instanceof AssistantUnavailable)) console.error(error);
    return Response.json({ error: UNAVAILABLE_TEXT }, { status: 503 });
  }

  const { error: insertError } = await supabase
    .from("assistant_questions")
    .insert({ user_id: userId });
  if (insertError) console.error(insertError);

  return Response.json({
    answer: result.answer,
    events: result.events,
    remaining: DAILY_QUESTIONS - used - 1,
  });
}
