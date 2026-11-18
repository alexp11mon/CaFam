"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { applyOfflineChange } from "@/app/dashboard/offline-actions";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import { useConnection } from "@/lib/hooks/use-connection";
import { useOfflineQueue, useOfflineSnapshot } from "@/lib/hooks/use-offline";
import {
  changeTitle,
  conflictChoices,
  conflictKind,
  mineOf,
  recreateOf,
  versionRows,
} from "@/lib/offline/changes";
import { withTimeout } from "@/lib/offline/connection";
import type { Conflict, Rejected } from "@/lib/offline/db";
import { OFFLINE_MESSAGES } from "@/lib/offline/messages";
import {
  addConflict,
  addRejected,
  dropConflict,
  dropRejected,
} from "@/lib/offline/queue-store";

const M = OFFLINE_MESSAGES;

function Versions({
  rows,
  mineLabel,
  theirsLabel,
}: {
  rows: ReturnType<typeof versionRows>;
  mineLabel: string;
  theirsLabel?: string;
}) {
  if (rows.length === 0) return null;
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
      {rows.map((row) => (
        <div key={row.label} className="contents">
          <dt className="text-muted">{row.label}</dt>
          <dd className="flex flex-col select-text">
            <span>
              <span className="sr-only">{mineLabel}: </span>
              {row.mine}
            </span>
            {theirsLabel ? (
              <span className="text-muted">
                <span className="sr-only">{theirsLabel}: </span>
                {row.theirs}
              </span>
            ) : null}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function ConflictItem({
  conflict,
  timeZone,
  onResolve,
}: {
  conflict: Conflict;
  timeZone: string;
  onResolve: (conflict: Conflict, keepMine: boolean) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const kind = conflictKind(conflict.change, conflict.server);
  const choices = conflictChoices(kind);
  const canKeepMine = kind !== "gone" || recreateOf(conflict.change) !== null;
  const run = async (keepMine: boolean) => {
    setBusy(true);
    try {
      await onResolve(conflict, keepMine);
    } finally {
      setBusy(false);
    }
  };
  return (
    <li className="flex flex-col gap-3 rounded-control border border-line p-4">
      <h4 className="font-semibold text-ink">{changeTitle(conflict.change)}</h4>
      <p className="text-sm text-muted">
        {kind === "gone" ? M.goneByOther : M.changedByOther}
      </p>
      {kind !== "gone" ? (
        <>
          <p className="text-xs text-muted">
            {M.mine} arriba · {M.theirs.toLowerCase()} debajo
          </p>
          <Versions
            rows={versionRows(
              mineOf(conflict.change),
              conflict.server,
              timeZone,
            )}
            mineLabel={M.mine}
            theirsLabel={M.theirs}
          />
        </>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {canKeepMine ? (
          <Button disabled={busy} onClick={() => void run(true)}>
            {choices.mine}
          </Button>
        ) : null}
        <Button
          variant="secondary"
          disabled={busy}
          onClick={() => void run(false)}
        >
          {choices.theirs}
        </Button>
      </div>
    </li>
  );
}

function RejectedItem({
  rejected,
  timeZone,
}: {
  rejected: Rejected;
  timeZone: string;
}) {
  return (
    <li className="flex flex-col gap-2 rounded-control border border-line p-4">
      <h4 className="font-semibold text-ink">{changeTitle(rejected.change)}</h4>
      <p className="text-sm text-danger">{rejected.reason}</p>
      {/* Readable and selectable, to copy it somewhere else (RF-48). */}
      <Versions
        rows={versionRows(mineOf(rejected.change), null, timeZone)}
        mineLabel={M.mine}
      />
      <Button
        variant="secondary"
        className="self-start"
        onClick={() => void dropRejected(rejected.changeId)}
      >
        {M.discard}
      </Button>
    </li>
  );
}

/**
 * The changes that need the user (spec 034 RF-48, RF-50 to RF-53, RF-55,
 * RF-57 to RF-59): conflicts with both versions and their two answers, and
 * the changes the server refused. Both live in IndexedDB until answered.
 */
export function ChangesSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const { show } = useToast();
  const online = useConnection();
  const { queue, conflicts, rejected } = useOfflineQueue();
  const timeZone = useOfflineSnapshot()?.profile.timeZone ?? "Europe/Madrid";

  const resolve = async (conflict: Conflict, keepMine: boolean) => {
    if (!keepMine) {
      // Their version stays: the server's state replaces the user's (RF-59).
      await dropConflict(conflict.changeId);
      if (online) router.refresh();
      return;
    }
    if (!online) return show(M.needsNetwork);
    const kind = conflictKind(conflict.change, conflict.server);
    const change =
      kind === "gone" ? recreateOf(conflict.change) : conflict.change;
    if (!change) return;
    try {
      // The user's version, over the other one (RF-58).
      const result = await withTimeout(
        applyOfflineChange(change, { force: true }),
      );
      if ("unauthenticated" in result || result.status === "retry") {
        return show(M.needsNetwork);
      }
      await dropConflict(conflict.changeId);
      if (result.status === "conflict") {
        await addConflict({ ...conflict, server: result.server });
      } else if (result.status === "rejected") {
        await addRejected({
          changeId: conflict.changeId,
          change: conflict.change,
          reason: result.reason,
        });
      }
      router.refresh();
    } catch {
      // Offline again or too slow: the conflict stays for later (RF-57).
      show(M.needsNetwork);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title="Cambios">
      <div className="flex flex-col gap-6">
        {queue.length > 0 ? (
          <p className="text-sm text-muted">
            {M.pendingCount(queue.length)}:{" "}
            {online
              ? "se están enviando."
              : "se enviarán al volver la conexión."}
          </p>
        ) : null}
        {conflicts.length > 0 ? (
          <section className="flex flex-col gap-3">
            <h3 className="font-semibold text-ink">{M.conflicts}</h3>
            <ul className="flex flex-col gap-3">
              {conflicts.map((conflict) => (
                <ConflictItem
                  key={conflict.changeId}
                  conflict={conflict}
                  timeZone={timeZone}
                  onResolve={resolve}
                />
              ))}
            </ul>
          </section>
        ) : null}
        {rejected.length > 0 ? (
          <section className="flex flex-col gap-3">
            <h3 className="font-semibold text-ink">{M.unsent}</h3>
            <ul className="flex flex-col gap-3">
              {rejected.map((item) => (
                <RejectedItem
                  key={item.changeId}
                  rejected={item}
                  timeZone={timeZone}
                />
              ))}
            </ul>
          </section>
        ) : null}
        {queue.length + conflicts.length + rejected.length === 0 ? (
          <p className="text-sm text-muted">No hay cambios pendientes.</p>
        ) : null}
      </div>
    </Sheet>
  );
}
