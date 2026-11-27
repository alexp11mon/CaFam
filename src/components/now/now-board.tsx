"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { T } from "@/components/i18n/locale-provider";
import { EmptyState } from "@/components/ui/empty-state";
import { LinkButton } from "@/components/ui/link-button";
import { todayKey } from "@/lib/calendar/format";
import { useLiveCalendar } from "@/lib/hooks/use-live-calendar";
import { useNow } from "@/lib/hooks/use-now";
import { buildNowCards, type NowInput } from "@/lib/now/cards";
import { NowCard } from "./now-card";

export type NowBoardData = NowInput & {
  /** Day the events were read for, YYYY-MM-DD in the profile's zone. */
  day: string;
  /** Server time of the read: the cards before the client clock exists. */
  readAt: number;
};

/**
 * Every followed person at this minute (spec 054 RF-1, RF-19, RF-20, RF-27,
 * plan D2). `live` off for the offline app, which has no server to refresh.
 */
export function NowBoard({
  data,
  live = true,
}: {
  data: NowBoardData;
  live?: boolean;
}) {
  const router = useRouter();
  const now = useNow() ?? data.readAt;
  const day = todayKey(data.timeZone, new Date(now));
  useLiveCalendar(live ? data.userId : undefined);

  // Past midnight the read no longer covers today and tomorrow (plan step 5).
  const stale = live && day !== data.day;
  useEffect(() => {
    if (stale) router.refresh();
  }, [stale, router]);

  const cards = buildNowCards(data, now);
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 tab:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => (
          <NowCard
            key={card.person.id}
            card={card}
            day={day}
            timeZone={data.timeZone}
          />
        ))}
      </div>
      {cards.length === 1 && (
        <EmptyState
          title="Aún no sigues a nadie"
          action={
            <LinkButton href="/dashboard/join" variant="secondary">
              <T>{"Unirme con código"}</T>
            </LinkButton>
          }
        >
          <T>
            {
              "Únete al calendario de alguien con su ID y PIN, o pídele que te lo comparta con un enlace. Lo verás aquí."
            }
          </T>
        </EmptyState>
      )}
    </div>
  );
}
