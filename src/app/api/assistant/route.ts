import { writeTools } from "@/app/dashboard/assistant/assistant-writes";
import type { AssistantAction } from "@/lib/assistant/actions";
import type { Refs } from "@/lib/assistant/citations";
import {
  INVALID_TEXT,
  QUESTION_MESSAGES,
  QUOTA_TEXT,
  SESSION_TEXT,
  UNAVAILABLE_TEXT,
} from "@/lib/assistant/error-messages";
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
import { runTool, type CitedEvent } from "@/lib/assistant/tools";
import {
  getEventsInRange,
  getMyCalendars,
  getProfileLocale,
  getProfileTimeZone,
} from "@/lib/calendar/queries";
import { canWriteEvents } from "@/lib/sync/read-only";
import { createClient } from "@/lib/supabase/server";
import { translator } from "@/i18n/translator";
import type { T } from "@/lib/i18n/translate";

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
  t: T,
): Promise<ProposalDeps> {
  const calendars = await getMyCalendars(supabase, userId);
  return {
    calendars: calendars.map((calendar) => ({
      id: calendar.id,
      name: calendar.name,
      canWrite: canWriteEvents(calendar),
    })),
    timeZone,
    t,
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

  const [timeZone, locale] = await Promise.all([
    getProfileTimeZone(supabase, userId),
    getProfileLocale(supabase, userId),
  ]);
  // Spec 053 RF-6 (plan D11): statuses and proposals in the profile's language.
  const t = translator(locale);
  const now = new Date();
  // Spec 051 RF-4: the slot is reserved atomically before calling the model,
  // so parallel questions never pass the 30 of the day.
  const { data: slots, error: quotaError } =
    await supabase.rpc("assistant_reserve");
  if (quotaError?.code === "CF429") {
    return Response.json({ error: QUOTA_TEXT }, { status: 429 });
  }
  if (quotaError || !slots?.[0]) throw quotaError ?? new Error("No slot");
  const { id: questionId, remaining } = slots[0];

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
      // Spec 036 (plan D12): each card goes out as soon as it exists, so a
      // cancelled answer still shows what was already written (RF-44).
      const actions: AssistantAction[] = [];
      let writes: ReturnType<typeof writeTools> | null = null;
      const writesFor = (refs: Refs<CitedEvent>) =>
        (writes ??= writeTools({
          supabase,
          userId,
          timeZone,
          now,
          refs,
          signal: request.signal,
          onAction: (action) => {
            actions.push(action);
            send({ type: "action", action });
          },
        }));
      status(
        t(
          !proposing
            ? STATUS.start
            : last?.role === "user" && (last.images?.length ?? 0) > 0
              ? STATUS.image
              : STATUS.proposal,
        ),
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
                proposal: await proposalDeps(supabase, userId, timeZone, t),
                now,
                timeZone,
                locale,
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
                    writes: writesFor(refs),
                  }),
                now,
                timeZone,
                locale,
                t,
                onStatus: status,
                // Spec 036 RF-18: where the user can create, for the prompt.
                write: {
                  calendars: async () =>
                    (await getMyCalendars(supabase, userId))
                      .filter(canWriteEvents)
                      .map((calendar) => calendar.name),
                },
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
          ...(actions.length ? { actions } : {}),
          remaining,
        });
        // Only answered questions count (plan D9 of 015). After the answer
        // is on its way, before the stream closes.
        const { error: answerError } = await supabase.rpc(
          "assistant_answered",
          { p_id: questionId },
        );
        if (answerError) console.error(answerError);
      } catch (error) {
        // Failed or cancelled: the slot is free again (spec 051 RF-5).
        const { error: releaseError } = await supabase.rpc(
          "assistant_release",
          { p_id: questionId },
        );
        if (releaseError) console.error(releaseError);
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
