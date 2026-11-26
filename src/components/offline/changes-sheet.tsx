"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { applyOfflineChange } from "@/app/dashboard/offline-actions";
import { lossText } from "@/components/recurrence/series-scope-dialog";
import { Button } from "@/components/ui/button";
import { BUTTON_BASE, BUTTON_VARIANTS } from "@/components/ui/button-styles";
import type { Loss } from "@/lib/forms/form-state";
import { fromRRule } from "@/lib/recurrence/rule";
import { summarizeRule } from "@/lib/recurrence/summary";
import { Sheet } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import { useConnection } from "@/lib/hooks/use-connection";
import { useOfflineQueue, useOfflineSnapshot } from "@/lib/hooks/use-offline";
import {
  changeTitle,
  conflictChoices,
  conflictRows,
  conflictKind,
  mineOf,
  recreateOf,
  versionRows,
} from "@/lib/offline/changes";
import { withTimeout } from "@/lib/offline/connection";
import {
  deletePendingImages,
  getPendingImage,
  type Conflict,
  type Rejected,
} from "@/lib/offline/db";
import { OFFLINE_MESSAGES } from "@/lib/offline/messages";
import {
  addConflict,
  addRejected,
  dropConflict,
  dropRejected,
} from "@/lib/offline/queue-store";
import { useT } from "@/components/i18n/locale-provider";

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

/** A series in conflict: how it repeats now and what keeping mine would lose (spec 035 RF-14, RF-15). */
function SeriesNow({ server }: { server: Record<string, unknown> | null }) {
  const rule =
    typeof server?.recurrence === "string"
      ? fromRRule(server.recurrence)
      : null;
  const loss = server?.loss as Loss | null | undefined;
  if (!rule && !loss) return null;
  return (
    <div className="flex flex-col gap-1 text-sm">
      {rule ? (
        <p className="text-muted">{M.repeatsNow(summarizeRule(rule))}</p>
      ) : null}
      {loss ? <p className="text-danger">{lossText(loss)}</p> : null}
    </div>
  );
}

/** "Descargar" of an image the server refused, so it is not lost (spec 035 RF-40). */
async function downloadPending(localId: string) {
  const image = await getPendingImage(localId);
  if (!image) return;
  const url = URL.createObjectURL(image.full);
  const link = document.createElement("a");
  link.href = url;
  link.download = "imagen-cafam.jpg";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
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
  const t = useT();
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
            {t("{mine} arriba ·", { mine: M.mine })} {M.theirs.toLowerCase()}{" "}
            {t("debajo")}
          </p>
          <Versions
            rows={conflictRows(conflict.change, conflict.server, timeZone)}
            mineLabel={M.mine}
            theirsLabel={M.theirs}
          />
        </>
      ) : null}
      <SeriesNow server={conflict.server} />
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
  const image = rejected.change.type === "image.add" ? rejected.change : null;
  return (
    <li className="flex flex-col gap-2 rounded-control border border-line p-4">
      <h4 className="font-semibold text-ink">{changeTitle(rejected.change)}</h4>
      <p className="text-sm text-danger">{rejected.reason}</p>
      {/* Readable and selectable, to copy it somewhere else (RF-48). */}
      <Versions
        rows={versionRows(mineOf(rejected.change), null, timeZone)}
        mineLabel={M.mine}
      />
      <div className="flex flex-wrap gap-2">
        {image ? (
          <Button
            variant="secondary"
            onClick={() => void downloadPending(image.localId)}
          >
            {M.download}
          </Button>
        ) : null}
        <Button
          variant="secondary"
          onClick={async () => {
            await dropRejected(rejected.changeId);
            // Its bytes go with it (RF-47).
            if (image) await deletePendingImages([image.localId]);
          }}
        >
          {M.discard}
        </Button>
      </div>
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
  const t = useT();
  const router = useRouter();
  const { show } = useToast();
  const online = useConnection();
  const { queue, conflicts, rejected, held } = useOfflineQueue();
  const heldAccounts = [...new Set(held.map((item) => item.connectionId))];
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
      // The account must be connected again first (spec 035 RF-7).
      if (!("unauthenticated" in result) && result.status === "held") {
        return show(M.held);
      }
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
    <Sheet open={open} onClose={onClose} title={t("Cambios")}>
      <div className="flex flex-col gap-6">
        {queue.length > 0 ? (
          <p className="text-sm text-muted">
            {M.pendingCount(queue.length)}:{" "}
            {online
              ? t("se están enviando.")
              : t("se enviarán al volver la conexión.")}
          </p>
        ) : null}
        {heldAccounts.length > 0 ? (
          <section className="flex flex-col gap-3">
            <p className="text-sm text-muted">{M.held}</p>
            <ul className="flex flex-col gap-3">
              {heldAccounts.map((connectionId) => (
                <li key={connectionId} className="flex flex-col gap-2">
                  <ul className="text-sm text-ink">
                    {queue
                      .filter((entry) =>
                        held.some(
                          (item) =>
                            item.changeId === entry.changeId &&
                            item.connectionId === connectionId,
                        ),
                      )
                      .map((entry) => (
                        <li key={entry.changeId}>
                          {changeTitle(entry.change)}
                        </li>
                      ))}
                  </ul>
                  <Link
                    href={`/dashboard/connections/${connectionId}`}
                    className={`${BUTTON_BASE} ${BUTTON_VARIANTS.secondary} self-start`}
                  >
                    {M.reconnect}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
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
          <p className="text-sm text-muted">
            {t("No hay cambios pendientes.")}
          </p>
        ) : null}
      </div>
    </Sheet>
  );
}
