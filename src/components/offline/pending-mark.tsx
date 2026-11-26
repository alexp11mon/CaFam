import { PendingIcon } from "@/components/shell/icons";
import { OFFLINE_MESSAGES } from "@/lib/offline/messages";
import { T } from "@/components/i18n/locale-provider";

/**
 * Mark of an event or a note with changes not sent yet (spec 034 RF-28,
 * RF-37), as the other marks of a block: the words always reach screen
 * readers, the icon only where it fits. `label` also shows the words.
 */
export function PendingMark({
  pending,
  icon = true,
  label = false,
}: {
  pending?: boolean;
  icon?: boolean;
  label?: boolean;
}) {
  if (!pending) return null;
  if (label) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2 py-0.5 text-xs font-semibold text-accent-ink">
        <PendingIcon />
        <T>{OFFLINE_MESSAGES.pending}</T>
      </span>
    );
  }
  return (
    <>
      {icon ? (
        <>
          {" "}
          <PendingIcon />
        </>
      ) : null}
      <span className="sr-only">
        {" "}
        <T>{OFFLINE_MESSAGES.pending}</T>
      </span>
    </>
  );
}
