"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { ConfirmDialog } from "@/components/calendar/confirm-dialog";
import { formatWhen } from "@/components/connections/sync-status";
import { AssignGroupSelect } from "@/components/groups/assign-group-select";
import { IcsSubscriptionStatus } from "@/components/import/ics-subscription-status";
import type { IcsSubscriptionInfo } from "@/lib/ics/subscription-queries";
import { LinkButton } from "@/components/ui/link-button";
import type { ConfirmState } from "@/lib/forms/form-state";
import { providerName } from "@/lib/sync/provider-labels";
import type { SyncedInfo } from "@/lib/sync/read-only";
import type { Database } from "@/types/database";
import { FoldChevron } from "@/components/ui/fold-chevron";
import { StaggerList } from "@/components/ui/stagger-list";

type CalendarRole = Database["public"]["Enums"]["calendar_role"];

export interface CalendarListItem {
  id: string;
  name: string;
  color: string;
  role: CalendarRole;
  synced: SyncedInfo | null;
  /** Without owner, shown inside one of the user's groups (spec 007 RF-46). */
  orphan?: boolean;
  groupId?: string | null;
  /** Own, normal and with an account that writes (spec 009 RF-34, RF-38). */
  canUpload?: boolean;
  /** Kept updated from an .ics link (spec 044 RF-6). */
  ics?: IcsSubscriptionInfo | null;
}

const ROLE_LABELS: Record<CalendarRole, string> = {
  owner: "Propietario",
  editor: "Editor",
  viewer: "Lector",
};

const ACTION_LINK =
  "inline-flex min-h-11 items-center text-sm font-semibold text-ink underline decoration-control underline-offset-4 hover:decoration-ink";

const BADGE =
  "shrink-0 rounded-full bg-stone px-2.5 py-0.5 text-sm font-medium text-ink";

/**
 * Calendars the user belongs to, in the order received (RF-13, RF-41, RF-45).
 * Each one is a short row; touching it unfolds its details and actions, one
 * at a time (spec 032 RF-12).
 */
export function CalendarList({
  calendars,
  timeZone,
  leaveAction,
  groups,
  assignAction,
}: {
  calendars: CalendarListItem[];
  timeZone: string;
  /** The user's groups, to move each calendar to one (spec 007 RF-36). */
  groups?: { id: string; name: string }[];
  assignAction?: (
    calendarId: string,
    groupId: string | null,
  ) => Promise<{ error?: string }>;
  /** Leaves a calendar that belongs to someone else (RF-27, RF-34). */
  leaveAction: (calendarId: string) => Promise<ConfirmState>;
}) {
  if (calendars.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-card bg-paper px-4 py-6 text-center text-ink">
        <p>Todavía no tienes calendarios.</p>
        <LinkButton href="/dashboard/calendars/new">
          Crear calendario
        </LinkButton>
      </div>
    );
  }

  return (
    <CalendarRows
      calendars={calendars}
      timeZone={timeZone}
      leaveAction={leaveAction}
      groups={groups}
      assignAction={assignAction}
    />
  );
}

function CalendarRows({
  calendars,
  timeZone,
  leaveAction,
  groups,
  assignAction,
}: {
  calendars: CalendarListItem[];
  timeZone: string;
  groups?: { id: string; name: string }[];
  assignAction?: (
    calendarId: string,
    groupId: string | null,
  ) => Promise<{ error?: string }>;
  leaveAction: (calendarId: string) => Promise<ConfirmState>;
}) {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <StaggerList className="grid items-start gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {calendars.map((calendar) => (
        <CalendarRow
          key={calendar.id}
          calendar={calendar}
          open={openId === calendar.id}
          onToggle={() =>
            setOpenId((id) => (id === calendar.id ? null : calendar.id))
          }
          timeZone={timeZone}
          leaveAction={leaveAction}
          groups={groups}
          assignAction={assignAction}
        />
      ))}
    </StaggerList>
  );
}

function CalendarRow({
  calendar,
  open,
  onToggle,
  timeZone,
  leaveAction,
  groups,
  assignAction,
}: {
  calendar: CalendarListItem;
  open: boolean;
  onToggle: () => void;
  timeZone: string;
  groups?: { id: string; name: string }[];
  assignAction?: (
    calendarId: string,
    groupId: string | null,
  ) => Promise<{ error?: string }>;
  leaveAction: (calendarId: string) => Promise<ConfirmState>;
}) {
  const detailsId = useId();

  return (
    <li className="flex min-w-0 flex-col rounded-card bg-paper">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={detailsId}
        onClick={onToggle}
        className="press-quiet flex min-h-14 min-w-0 items-center gap-3 rounded-card px-4 py-2 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
      >
        <span
          data-testid="calendar-color"
          aria-hidden="true"
          className="size-4 shrink-0 rounded-full ring-1 ring-pastel-ink/20"
          style={{ backgroundColor: calendar.color }}
        />
        <span className="flex min-w-0 flex-1 flex-col">
          <span
            data-testid="calendar-name"
            className="min-w-0 truncate font-semibold text-ink"
          >
            {calendar.name}
          </span>
          {calendar.synced ? (
            <span className="text-xs text-muted">
              {providerName(calendar.synced.provider)}
            </span>
          ) : null}
        </span>
        {calendar.orphan ? (
          <span className={`${BADGE} max-sm:hidden`}>Sin propietario</span>
        ) : null}
        <span className={BADGE}>{ROLE_LABELS[calendar.role]}</span>
        <span className="text-muted">
          <FoldChevron open={open} />
        </span>
      </button>
      <div
        id={detailsId}
        hidden={!open}
        className="flex flex-col gap-2 border-t border-line px-4 pt-2 pb-3"
      >
        {calendar.orphan ? (
          <p className="text-sm text-muted sm:hidden">Sin propietario</p>
        ) : null}
        {calendar.synced ? (
          // Every member sees the last update; only the owner the account (spec 007 RF-26).
          <p className="text-sm text-muted tabular-nums">
            {calendar.synced.lastSyncedAt
              ? `Traído de ${providerName(calendar.synced.provider)}, actualizado el ${formatWhen(calendar.synced.lastSyncedAt, timeZone)}.`
              : `Traído de ${providerName(calendar.synced.provider)}, todavía no se ha actualizado.`}
            {calendar.synced.accountEmail
              ? ` Cuenta: ${calendar.synced.accountEmail}.`
              : null}
          </p>
        ) : null}
        {calendar.ics ? (
          <IcsSubscriptionStatus
            calendarId={calendar.id}
            calendarName={calendar.name}
            info={calendar.ics}
            canWrite={calendar.role !== "viewer"}
            timeZone={timeZone}
          />
        ) : null}
        {groups && groups.length > 0 && assignAction ? (
          <AssignGroupSelect
            calendarName={calendar.name}
            groupId={calendar.groupId ?? null}
            groups={groups}
            action={assignAction.bind(null, calendar.id)}
          />
        ) : null}
        <div className="flex flex-wrap items-center gap-x-4">
          {calendar.role === "owner" ? (
            <Link
              href={`/dashboard/calendars/${calendar.id}/edit`}
              aria-label={`Editar ${calendar.name}`}
              className={ACTION_LINK}
            >
              Editar
            </Link>
          ) : null}
          {calendar.canUpload ? (
            <Link
              href={`/dashboard/calendars/${calendar.id}/upload`}
              aria-label={`Subir ${calendar.name} a Google o iCloud`}
              className={ACTION_LINK}
            >
              Subir a Google o iCloud
            </Link>
          ) : null}
          {/* A file download, not a page: a plain link (spec 043 RF-1). */}
          <a
            href={`/api/ics/export?calendar=${calendar.id}`}
            download
            aria-label={`Exportar ${calendar.name} (.ics)`}
            className={ACTION_LINK}
          >
            Exportar (.ics)
          </a>
          {calendar.role !== "viewer" ? (
            <Link
              href={`/dashboard/calendars/${calendar.id}/categories`}
              aria-label={`Categorías de ${calendar.name}`}
              className={ACTION_LINK}
            >
              Categorías
            </Link>
          ) : null}
          {calendar.role === "owner" ? (
            <Link
              href={`/dashboard/calendars/${calendar.id}/share`}
              aria-label={`Compartir y miembros de ${calendar.name}`}
              className={ACTION_LINK}
            >
              Compartir y miembros
            </Link>
          ) : (
            <>
              <Link
                href={`/dashboard/calendars/${calendar.id}/members`}
                aria-label={`Miembros de ${calendar.name}`}
                className={ACTION_LINK}
              >
                Miembros
              </Link>
              <ConfirmDialog
                triggerLabel="Salir"
                triggerAriaLabel={`Salir de ${calendar.name}`}
                title={`¿Salir de «${calendar.name}»?`}
                description="Dejarás de verlo. Los eventos que creaste se quedan, y solo podrás volver con una invitación nueva."
                confirmLabel="Sí, salir"
                action={leaveAction.bind(null, calendar.id)}
              />
            </>
          )}
        </div>
      </div>
    </li>
  );
}
