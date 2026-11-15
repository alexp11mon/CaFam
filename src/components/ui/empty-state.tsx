import type { ReactNode } from "react";
import { Venito } from "@/components/brand/venito";

/**
 * Nothing here yet: a drawing (Venito, spec 027), what it means and the one
 * thing to do about it (spec 025 RF-6).
 */
export function EmptyState({
  title,
  children,
  art = <Venito mood="idle" className="size-24" />,
  action,
}: {
  title: string;
  children?: ReactNode;
  /** Decorative: hidden from screen readers. Venito by default (spec 027 RF-7); `null` for none. */
  art?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
      {art ? <div aria-hidden="true">{art}</div> : null}
      <p className="text-lg font-bold text-ink">{title}</p>
      {children ? <div className="max-w-sm text-muted">{children}</div> : null}
      {action ? <div className="pt-2">{action}</div> : null}
    </div>
  );
}
