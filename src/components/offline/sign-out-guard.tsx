"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { useConnection } from "@/lib/hooks/use-connection";
import { useOfflineQueue } from "@/lib/hooks/use-offline";
import { OFFLINE_MESSAGES } from "@/lib/offline/messages";
import { waitingCount } from "@/lib/offline/queue-store";
import { forgetDevice } from "@/lib/offline/snapshot-store";
import { forgetPushSubscription } from "@/lib/push/browser";
import { removeDeviceSubscription } from "@/app/dashboard/settings/push-actions";

/**
 * "Cerrar sesión" (spec 034 RF-60 to RF-62, plan D12): it needs the network,
 * because the session cookie can only go on the server; it warns when changes
 * still wait, and leaves nothing of the user on the device.
 */
export function SignOutGuard({
  action,
  className,
  children,
}: {
  action: () => Promise<void>;
  className: string;
  children: ReactNode;
}) {
  const online = useConnection();
  const waiting = waitingCount(useOfflineQueue());
  const [asking, setAsking] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (asking && !element.open) element.showModal();
    // Closed in the cleanup too: Activity keeps hidden routes (spec 008 R6).
    return () => {
      if (element.open) element.close();
    };
  }, [asking]);

  const signOut = async () => {
    // This device stops getting the user's notices (spec 040 RF-18).
    await forgetPushSubscription(removeDeviceSubscription);
    try {
      await forgetDevice();
    } catch {
      // No IndexedDB here: nothing was saved.
    }
    await action();
  };

  if (!online) {
    return (
      <button
        type="button"
        disabled
        className={`${className} cursor-not-allowed opacity-50`}
      >
        {children}
        <span className="ml-auto text-sm text-muted">
          {OFFLINE_MESSAGES.needsNetwork}
        </span>
      </button>
    );
  }

  return (
    <form action={signOut}>
      {waiting > 0 ? (
        <button
          type="button"
          className={className}
          onClick={() => setAsking(true)}
        >
          {children}
        </button>
      ) : (
        <button type="submit" className={className}>
          {children}
        </button>
      )}
      <dialog
        ref={dialog}
        aria-labelledby={titleId}
        onCancel={(event) => {
          event.preventDefault();
          setAsking(false);
        }}
        className="m-auto w-[calc(100%-2rem)] max-w-md rounded-control surface-float p-6 text-ink backdrop:bg-scrim/50"
      >
        <div className="flex flex-col gap-4">
          <h2 id={titleId} className="text-lg font-semibold">
            Cerrar sesión
          </h2>
          <p>{OFFLINE_MESSAGES.signOutWarning(waiting)}</p>
          <div className="flex flex-wrap justify-end gap-3">
            <Button variant="secondary" onClick={() => setAsking(false)}>
              {OFFLINE_MESSAGES.cancel}
            </Button>
            <Button type="submit" variant="danger">
              {OFFLINE_MESSAGES.signOutAnyway}
            </Button>
          </div>
        </div>
      </dialog>
    </form>
  );
}
