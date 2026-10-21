import Link from "next/link";
import type { ReactNode } from "react";

interface AuthCardProps {
  title: string;
  children: ReactNode;
  footer: { text: string; linkLabel: string; href: string };
}

export function AuthCard({ title, children, footer }: AuthCardProps) {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm rounded-2xl border border-brand-soft bg-white p-6 shadow-sm">
        <p className="mb-1 text-sm font-semibold text-brand">CalenderFam</p>
        <h1 className="mb-6 text-2xl font-bold text-ink">{title}</h1>
        {children}
        <p className="mt-6 text-sm text-ink">
          {footer.text}{" "}
          <Link
            href={footer.href}
            className="font-semibold text-brand underline"
          >
            {footer.linkLabel}
          </Link>
        </p>
      </div>
    </main>
  );
}
