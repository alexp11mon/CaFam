// What a series change made offline would lose, counted in the copy (spec
// 035 RF-13): the exceptions the change removes, with their images and
// comments. The same rule as series_loss on the server. Pure.
import type { Loss } from "@/lib/forms/form-state";
import type { LossQuery } from "@/lib/recurrence/series-write";
import type {
  OfflineComment,
  OfflineException,
  OfflineImage,
} from "./snapshot";

export interface LossCopy {
  exceptions: readonly OfflineException[];
  images: readonly OfflineImage[];
  comments: readonly OfflineComment[];
}

/** null when nothing is lost (no question to ask). */
export function lossInCopy(
  seriesId: string,
  query: LossQuery,
  copy: LossCopy,
): Loss | null {
  if (query === null) return null;
  const from = query.from ? Date.parse(query.from) : null;
  const only = query.only ? Date.parse(query.only) : null;
  const lost = new Set(
    copy.exceptions
      .filter((exception) => {
        if (exception.seriesId !== seriesId) return false;
        const at = Date.parse(exception.originalStart);
        return (from === null || at >= from) && (only === null || at === only);
      })
      .map((exception) => exception.id),
  );
  const loss = {
    exceptions: lost.size,
    images: copy.images.filter((image) => lost.has(image.eventId)).length,
    comments: copy.comments.filter((comment) => lost.has(comment.eventId))
      .length,
  };
  return loss.exceptions + loss.images + loss.comments > 0 ? loss : null;
}
