"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { LinkButton } from "@/components/ui/link-button";
import {
  dropShared,
  imagesOf,
  kindOf,
  PENDING_IMAGES_KEY,
  readShared,
  type SharedItem,
} from "@/lib/share/inbox";
import { useT } from "@/components/i18n/locale-provider";

type State =
  | { kind: "loading" }
  | { kind: "gone" }
  | { kind: "none" }
  | { kind: "images"; count: number };

/**
 * What another app shared, read from the device (spec 047 RF-6 to RF-8): an
 * .ics goes to the import, text to the new event's phrase, and images ask.
 * Nothing is saved until the person confirms there.
 */
export function ShareInbox({ id }: { id: string | null }) {
  const t = useT();
  const router = useRouter();
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    let live = true;
    const decide = (item: SharedItem | null) => {
      if (!live) return;
      if (!item) return setState({ kind: "gone" });
      const kind = kindOf(item);
      if (kind === "ics") {
        router.replace(`/dashboard/import?shared=${item.id}`);
      } else if (kind === "text") {
        void dropShared(item.id);
        router.replace(
          `/dashboard/events/new?text=${encodeURIComponent(item.text.slice(0, 300))}`,
        );
      } else if (kind === "images") {
        setState({ kind: "images", count: imagesOf(item).length });
      } else {
        void dropShared(item.id);
        setState({ kind: "none" });
      }
    };
    if (id) void readShared(id).then(decide);
    else decide(null);
    return () => {
      live = false;
    };
  }, [id, router]);

  if (state.kind === "loading")
    return (
      <p role="status" className="text-muted">
        {t("Abriendo lo compartido…")}
      </p>
    );

  if (state.kind === "gone" || state.kind === "none")
    return (
      <EmptyState
        title={
          state.kind === "gone"
            ? t("Lo compartido ya no está")
            : t("No sabemos qué hacer con esto")
        }
        action={
          <LinkButton href="/dashboard/calendar" variant="secondary">
            {t("Ir al calendario")}
          </LinkButton>
        }
      >
        {state.kind === "gone"
          ? t("Se guarda en este dispositivo 10 minutos. Vuelve a compartirlo.")
          : "CaFam recibe archivos .ics, imágenes y texto."}
      </EmptyState>
    );

  const one = state.count === 1;
  return (
    <Card className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold text-ink">
        {one
          ? t("¿Qué hago con esta imagen?")
          : t("¿Qué hago con estas imágenes?")}
      </h2>
      <Button
        onClick={() => router.replace(`/dashboard/assistant?shared=${id}`)}
      >
        {t("Preguntar a Venito")}
      </Button>
      <Button
        variant="secondary"
        onClick={() => {
          // The detail of the event found offers to add them (RF-7).
          try {
            sessionStorage.setItem(PENDING_IMAGES_KEY, id!);
          } catch {}
          router.push("/dashboard/search");
        }}
      >
        {t("Añadir a un evento")}
      </Button>
      <p className="text-sm text-muted">
        {one ? t("La imagen sigue") : t("Las imágenes siguen")}{" "}
        {t("solo en este dispositivo hasta que elijas.")}
      </p>
    </Card>
  );
}
