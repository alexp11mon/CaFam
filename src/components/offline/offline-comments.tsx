"use client";

import { useId } from "react";
import { useUndoToast } from "@/components/calendar/use-undo-toast";
import { CommentForm } from "@/components/comments/comment-form";
import { CommentItem } from "@/components/comments/comment-item";
import { CommentsSkeleton } from "@/components/comments/comments-skeleton";
import { Button } from "@/components/ui/button";
import { commentBodySchema } from "@/lib/comments/schemas";
import { useNow } from "@/lib/hooks/use-now";
import { useOfflineQueue, useOfflineSnapshot } from "@/lib/hooks/use-offline";
import { offlineComments } from "@/lib/offline/comment-view";
import { OFFLINE_MESSAGES } from "@/lib/offline/messages";
import type { OfflineChange } from "@/lib/offline/outbox";
import { addChange } from "@/lib/offline/queue-store";
import { PERSON_TINTS, assignTints } from "@/lib/people/avatar";
import { PendingMark } from "./pending-mark";

const UNDO_TEXT = {
  added: "Comentario guardado",
  edited: "Comentario editado",
  deleted: "Comentario borrado",
};

/**
 * "Comentarios" without a connection: the ones the copy keeps, and what is
 * added, edited or deleted waits in the queue with its "Deshacer" (spec 035
 * RF-18 to RF-25).
 */
export function OfflineComments({
  eventId,
  calendarId,
  timeZone,
}: {
  eventId: string;
  calendarId: string;
  timeZone: string;
}) {
  const headingId = useId();
  const reasonId = useId();
  const now = useNow();
  const copy = useOfflineSnapshot();
  const { queue } = useOfflineQueue();
  const showUndo = useUndoToast();
  const role =
    copy?.calendars.find((calendar) => calendar.id === calendarId)?.role ??
    "viewer";
  const { comments, hasOlder } = offlineComments(
    {
      userId: copy?.userId ?? "",
      userName: copy?.profile.displayName ?? "",
      comments: copy?.comments ?? [],
    },
    queue,
    eventId,
    role,
  );

  async function queueIt(change: OfflineChange, text: string) {
    const changeId = await addChange(change);
    showUndo(text, { kind: "offline", changeId });
    return { ok: true };
  }

  const tints = assignTints(
    comments.flatMap((comment) => (comment.authorId ? [comment.authorId] : [])),
  );

  return (
    <section
      aria-labelledby={headingId}
      className="flex flex-col gap-4 border-t border-line pt-4"
    >
      <h3 id={headingId} className="text-lg font-semibold text-ink">
        Comentarios
      </h3>
      {hasOlder ? (
        <div className="flex flex-col items-start gap-1">
          <Button variant="secondary" disabled aria-describedby={reasonId}>
            Ver anteriores
          </Button>
          <p id={reasonId} className="text-sm text-muted">
            {OFFLINE_MESSAGES.needsNetwork}
          </p>
        </div>
      ) : null}
      {now === null ? (
        <CommentsSkeleton />
      ) : comments.length === 0 ? (
        <p className="text-muted">Aún no hay comentarios.</p>
      ) : (
        <ul aria-labelledby={headingId} className="flex flex-col gap-4">
          {comments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              mark={<PendingMark pending={comment.pending} label />}
              tint={
                (comment.authorId && tints.get(comment.authorId)) ||
                PERSON_TINTS[0]
              }
              timeZone={timeZone}
              now={now ?? 0}
              onEdit={(id, body) => {
                // The limits of always, said here as the server would (RF-23).
                const parsed = commentBodySchema.safeParse(body);
                if (!parsed.success) {
                  return Promise.resolve({
                    ok: false,
                    fieldError: parsed.error.issues[0]?.message,
                  });
                }
                return queueIt(
                  {
                    type: "comment.update",
                    id,
                    eventId,
                    base: { body: comment.saved },
                    body: parsed.data,
                  },
                  UNDO_TEXT.edited,
                );
              }}
              onDelete={(id) =>
                queueIt(
                  {
                    type: "comment.delete",
                    id,
                    eventId,
                    base: { body: comment.saved },
                  },
                  UNDO_TEXT.deleted,
                )
              }
            />
          ))}
        </ul>
      )}
      <CommentForm
        onSend={(body, clientId) =>
          queueIt(
            { type: "comment.add", eventId, clientId, body },
            UNDO_TEXT.added,
          )
        }
      />
    </section>
  );
}
