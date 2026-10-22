import { Logo } from "@/components/brand/logo";
import type { ReactNode } from "react";
import { LinkKeepingNext } from "@/components/auth/next-field";

interface AuthCardProps {
  title: string;
  children: ReactNode;
  footer: { text: string; linkLabel: string; href: string };
}

export function AuthCard({ title, children, footer }: AuthCardProps) {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm rounded-3xl bg-paper p-6">
        <p className="mb-6">
          <Logo />
        </p>
        <h1 className="mb-6 text-2xl font-bold text-ink">{title}</h1>
        {children}
        <p className="mt-6 text-sm text-ink">
          {footer.text}{" "}
          <LinkKeepingNext
            href={footer.href}
            className="font-semibold text-ink underline decoration-control underline-offset-4 hover:decoration-ink"
          >
            {footer.linkLabel}
          </LinkKeepingNext>
        </p>
      </div>
    </main>
  );
}
