import { ChevronIcon } from "@/components/shell/icons";

/**
 * The mark of something that folds: down when open, to the side when folded,
 * turning with the motion tokens (spec 032 RF-4, RF-10; spec 021 RF-2).
 */
export function FoldChevron({ open }: { open: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`flex transition-[rotate] duration-(--motion-base-in) ease-(--ease-in-out) ${open ? "" : "-rotate-90"}`}
    >
      <ChevronIcon direction="down" />
    </span>
  );
}
