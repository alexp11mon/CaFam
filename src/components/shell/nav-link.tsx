"use client";

import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { useConnection } from "@/lib/hooks/use-connection";
import { navReason } from "@/lib/offline/gates";
import type { NavItem } from "@/lib/shell/nav";

/**
 * A destination of the navigation. Without a connection, one that needs it
 * is shown disabled with "Necesita conexión" (spec 034 RF-17, plan D15).
 */
export function NavLink({
  item,
  className,
  children,
  showReason = false,
  ...rest
}: {
  item: NavItem;
  className: string;
  children: ReactNode;
  /** The reason as text too, where there is room (the "Más" sheet). */
  showReason?: boolean;
} & Omit<ComponentProps<typeof Link>, "href" | "className" | "children">) {
  const reason = navReason(item, useConnection());
  if (!reason) {
    return (
      <Link href={item.href} className={className} {...rest}>
        {children}
      </Link>
    );
  }
  return (
    <span
      role="link"
      aria-disabled="true"
      aria-label={`${item.label}: ${reason}`}
      title={reason}
      className={`${className} cursor-not-allowed opacity-50`}
    >
      {children}
      {showReason ? (
        <span aria-hidden="true" className="ml-auto text-sm text-muted">
          {reason}
        </span>
      ) : null}
    </span>
  );
}
