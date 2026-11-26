import type { Metadata } from "next";
import { PageShell } from "@/components/calendar/page-shell";
import { JoinCodeForm } from "@/components/sharing/join-code-form";
import { joinWithCode } from "./actions";
import { T } from "@/components/i18n/locale-provider";

export const metadata: Metadata = { title: "Unirme con código" };

export default function JoinPage() {
  return (
    <PageShell title="Unirme con código">
      <p className="text-ink">
        <T>
          {
            "Escribe el ID del calendario y el PIN que te ha dado su propietario."
          }
        </T>
      </p>
      <JoinCodeForm action={joinWithCode} />
    </PageShell>
  );
}
