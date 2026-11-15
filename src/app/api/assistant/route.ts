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
  jsonChat,
  visionChat,
} from "@/lib/assistant/provider";
import type { Proposal, ProposalDeps } from "@/lib/assistant/proposal";
import { runAssistant, runProposal } from "@/lib/assistant/run";
import { assistantRequestSchema } from "@/lib/assistant/schemas";
import {
  encodeLine,
  NDJSON,
  STATUS,
  type StreamLine,
} from "@/lib/assistant/stream";
import { runTool } from "@/lib/assistant/tools";
import {
  getEventsInRange,
  getMyCalendars,
  getProfileTimeZone,
} from "@/lib/calendar/queries";
import { canWriteEvents } from "@/lib/sync/read-only";
import { createClient } from "@/lib/supabase/server";

// Spec 015 plan assistant-route (D3): one question of the chat. The thread is
// not stored (RF-6); only answered questions count for the quota (D9).
// Spec 022: images are read in the same request and never stored (RF-13).
// Up to 35 s waiting for Groq's per-minute limit plus a 20 s read (plan D6).
export const maxDuration = 60;

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** Spec 022: what the proposal may use, always with the session (RF-26, D8). */
async function proposalDeps(
  supabase: Supabase,
  userId: string,
  timeZone: string,
): Promise<ProposalDeps> {
  const calendars = await getMyCalendars(supabase, userId);
  return {
    calendars: calendars.map((calendar) => ({
      id: calendar.id,
      name: calendar.name,
      canWrite: canWriteEvents(calendar),
    })),
    timeZone,
    loadEvents: async (from, to) =>
      (await getEventsInRange(supabase, from, to)).map((event) => ({
        calendarId: event.calendarId,
        startsAt: event.startsAt,
        endsAt: event.endsAt,
      })),
  };
}

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

  const { messages, proposal } = parsed.data;
  const last = messages.at(-1);
  // Spec 022: images, or a pending proposal to correct, make a proposal.
  const proposing =
    (last?.role === "user" && (last.images?.length ?? 0) > 0) ||
    (proposal?.length ?? 0) > 0;

  // From here on the answer is a stream of lines (spec 024 RF-16, plan D7):
  // what is being done, then the answer. The quota and the session were
  // checked above, with their own status codes.
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      let open = true;
      const send = (line: StreamLine) => {
        if (!open) return;
        try {
          controller.enqueue(encoder.encode(encodeLine(line)));
        } catch {
          // The reader left (cancelled): nothing else to send.
          open = false;
        }
      };
      const status = (text: string) => send({ type: "status", text });
      status(
        !proposing
          ? STATUS.start
          : last?.role === "user" && (last.images?.length ?? 0) > 0
            ? STATUS.image
            : STATUS.proposal,
      );
      try {
        const result = proposing
          ? await runProposal(
              messages,
              proposal,
              {
                json: (input, vision, signal) =>
                  vision
                    ? visionChat(input, signal)
                    : jsonChat(input, undefined, signal),
                proposal: await proposalDeps(supabase, userId, timeZone),
                now,
                timeZone,
              },
              request.signal,
            )
          : await runAssistant(
              messages,
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
                onStatus: status,
              },
              request.signal,
            );
        send({
          type: "done",
          answer: result.answer,
          events: result.events,
          ...("proposal" in result && result.proposal
            ? { proposal: result.proposal as Proposal }
            : {}),
          remaining: DAILY_QUESTIONS - used - 1,
        });
        // Only answered questions count (plan D9 of 015). After the answer
        // is on its way, before the stream closes.
        const { error: insertError } = await supabase
          .from("assistant_questions")
          .insert({ user_id: userId });
        if (insertError) console.error(insertError);
      } catch (error) {
        // The user cancelled (RF-4 of 015): nobody reads this answer.
        if (!request.signal.aborted) {
          // The reason (status and Groq's code, no user data) shows in Vercel's logs.
          if (error instanceof AssistantUnavailable) {
            console.warn(`assistant unavailable: ${error.message}`);
          } else console.error(error);
          send({ type: "error", text: UNAVAILABLE_TEXT, retry: true });
        }
      }
      if (open) controller.close();
    },
  });

  return new Response(body, {
    headers: {
      "Content-Type": `${NDJSON}; charset=utf-8`,
      "Cache-Control": "no-store, no-transform",
      // Proxies that buffer would hold the progress until the end (plan R4).
      "X-Accel-Buffering": "no",
    },
  });
}

/**
 * Wakes the function up when the chat opens, so the first question does not
 * pay the cold start (spec 024 RF-19). No session, no data.
 */
export function GET() {
  return new Response(null, {
    status: 204,
    headers: { "Cache-Control": "no-store" },
  });
}
