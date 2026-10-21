"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, type ReactNode } from "react";

// `next` is read in the browser, not in the page, so login and signup stay
// prerendered (plan D10). The action validates it again on the server (D9).
function useNext(): string {
  return useSearchParams()?.get("next") ?? "";
}

function HiddenNext() {
  return <input type="hidden" name="next" value={useNext()} />;
}

/** Carries the `next` of the URL into the form (RF-7). */
export function NextField() {
  return (
    <Suspense fallback={null}>
      <HiddenNext />
    </Suspense>
  );
}

function KeepNextLink({
  href,
  className,
  children,
}: {
  href: string;
  className: string;
  children: ReactNode;
}) {
  const next = useNext();
  const target = next ? `${href}?next=${encodeURIComponent(next)}` : href;
  return (
    <Link href={target} className={className}>
      {children}
    </Link>
  );
}

/** Link between login and signup that keeps the invite the person came from. */
export function LinkKeepingNext(props: {
  href: string;
  className: string;
  children: ReactNode;
}) {
  return (
    <Suspense
      fallback={
        <Link href={props.href} className={props.className}>
          {props.children}
        </Link>
      }
    >
      <KeepNextLink {...props} />
    </Suspense>
  );
}
