// The comments of an event without a connection: the copy's with the queue
// on top (spec 035 RF-18 to RF-25). Pure.
import { COMMENTS_PAGE } from "@/lib/comments/limits";
import type { CommentView } from "@/lib/comments/queries";
import { canDeleteComment, canEditComment } from "./gates";
import type { OutboxEntry } from "./outbox";
import type { OfflineComment } from "./snapshot";

export type OfflineCommentView = CommentView & {
  pending?: true;
  /** The comment's text as the copy had it: the base of an edit or a delete. */
  saved: string;
};

interface CommentCopy {
  userId: string;
  /** The name of whoever writes, for what they add offline. */
  userName: string;
  comments: readonly OfflineComment[];
}

export function offlineComments(
  copy: CommentCopy,
  queue: readonly OutboxEntry[],
  eventId: string,
  role: "owner" | "editor" | "viewer",
): { comments: OfflineCommentView[]; hasOlder: boolean } {
  const view = (
    comment: Pick<OfflineComment, "id" | "authorId" | "body" | "createdAt">,
    author: string,
    edited: boolean,
  ): OfflineCommentView => ({
    id: comment.id,
    author,
    authorId: comment.authorId,
    body: comment.body,
    saved: comment.body,
    createdAt: comment.createdAt,
    edited,
    canEdit: canEditComment(comment, copy.userId),
    canDelete: canDeleteComment(comment, copy.userId, role),
  });
  const saved = copy.comments
    .filter((comment) => comment.eventId === eventId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const byId = new Map(
    saved.map((comment) => [
      comment.id,
      view(comment, comment.authorName, comment.editedAt !== null),
    ]),
  );
  for (const { change, createdAt } of queue) {
    if (!("eventId" in change) || change.eventId !== eventId) continue;
    if (change.type === "comment.add") {
      byId.set(change.clientId, {
        ...view(
          {
            id: change.clientId,
            authorId: copy.userId,
            body: change.body,
            createdAt,
          },
          copy.userName,
          false,
        ),
        pending: true,
      });
    } else if (change.type === "comment.update") {
      const comment = byId.get(change.id);
      if (comment) {
        byId.set(change.id, {
          ...comment,
          body: change.body,
          edited: true,
          pending: true,
        });
      }
    } else if (change.type === "comment.delete") {
      byId.delete(change.id);
    }
  }
  return {
    comments: [...byId.values()],
    // The copy keeps the latest 50: there may be older ones (RF-17, RF-18).
    hasOlder: saved.length >= COMMENTS_PAGE,
  };
}
