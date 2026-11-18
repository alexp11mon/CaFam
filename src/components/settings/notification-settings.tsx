"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { FormAlert } from "@/components/ui/form-alert";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  currentEndpoint,
  subscribeDevice,
  useBrowserSupport,
  type DeviceSubscription,
} from "@/lib/push/browser";
import { REMINDER_OPTIONS } from "@/lib/push/options";

// "Notificaciones" in Ajustes (spec 040 RF-1 to RF-4, RF-6, RF-14).

type Result = { error?: string };

export interface NotifyPrefs {
  joined: boolean;
  access: boolean;
  comments: boolean;
  changes: boolean;
}

export interface NotificationActions {
  save: (subscription: DeviceSubscription) => Promise<Result>;
  remove: (id: string) => Promise<Result>;
  test: (endpoint: string) => Promise<Result>;
  setNotify: (notify: NotifyPrefs) => Promise<Result>;
  setDefaults: (defaults: {
    timed: number | null;
    allDay: number | null;
  }) => Promise<Result>;
}

const KINDS: { key: keyof NotifyPrefs; label: string }[] = [
  { key: "joined", label: "Alguien se une a un calendario mío" },
  { key: "access", label: "Me dan acceso a un calendario o me cambian el rol" },
  {
    key: "comments",
    label: "Comentan en un evento que he creado o en el que he comentado",
  },
  { key: "changes", label: "Cambian o borran un evento que he creado" },
];

function ThisDevice({
  publicKey,
  subscribed,
  actions,
}: {
  publicKey: string | null;
  subscribed: string | null;
  actions: NotificationActions;
}) {
  const support = useBrowserSupport();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();

  if (support === "ios-install") {
    return (
      <p className="text-sm text-muted">
        En el iPhone los avisos solo funcionan con CaFam añadida a la pantalla
        de inicio.{" "}
        <Link href="/" className="font-medium text-accent-ink underline">
          Cómo añadirla
        </Link>
      </p>
    );
  }
  if (support === "unsupported" || !publicKey) {
    return (
      <p className="text-sm text-muted">
        Este navegador no puede recibir avisos.
      </p>
    );
  }
  if (support === "denied") {
    return (
      <p className="text-sm text-muted">
        Has bloqueado los avisos de CaFam en este navegador. Para activarlos,
        permite las notificaciones en los ajustes del sitio (el candado junto a
        la dirección) y vuelve aquí.
      </p>
    );
  }

  async function run(work: () => Promise<Result>, done?: string) {
    setPending(true);
    setError(undefined);
    setMessage(undefined);
    let result: Result;
    try {
      result = await work();
    } catch {
      result = { error: "No se ha podido conectar. Inténtalo de nuevo." };
    }
    setPending(false);
    if (result.error) setError(result.error);
    else if (done) setMessage(done);
  }

  return (
    <div className="flex flex-col gap-3">
      {subscribed ? (
        <>
          <p className="text-sm text-ink">Este dispositivo recibe avisos.</p>
          <Button
            variant="secondary"
            className="self-start"
            disabled={pending}
            onClick={() =>
              void run(() => actions.test(subscribed), "Aviso enviado.")
            }
          >
            Enviar un aviso de prueba
          </Button>
        </>
      ) : (
        <Button
          className="self-start"
          disabled={pending}
          onClick={() =>
            void run(async () => {
              const subscription = await subscribeDevice(publicKey);
              if (!subscription) {
                return {
                  error:
                    "No se han activado los avisos. Revisa el permiso del navegador.",
                };
              }
              return actions.save(subscription);
            })
          }
        >
          Activar en este dispositivo
        </Button>
      )}
      <FormAlert message={error} />
      {message ? (
        <p role="status" className="text-sm text-ink">
          {message}
        </p>
      ) : null}
    </div>
  );
}

function Defaults({
  defaults,
  save,
}: {
  defaults: { timed: number | null; allDay: number | null };
  save: NotificationActions["setDefaults"];
}) {
  const [value, setValue] = useState(defaults);
  const [error, setError] = useState<string>();

  async function change(next: typeof value) {
    const before = value;
    setValue(next);
    setError(undefined);
    const result = await save(next).catch(() => ({
      error: "No se ha podido guardar. Inténtalo de nuevo.",
    }));
    if (result.error) {
      setValue(before);
      setError(result.error);
    }
  }

  const read = (raw: string) => (raw === "none" ? null : Number(raw));
  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-base font-semibold text-ink">Aviso por defecto</h3>
      <p className="text-sm text-muted">
        Se pone en los eventos que creas; puedes cambiarlo en cada uno.
      </p>
      <Select
        label="Eventos con hora"
        name="reminder-timed"
        value={value.timed === null ? "none" : String(value.timed)}
        onChange={(e) => void change({ ...value, timed: read(e.target.value) })}
      >
        <option value="none">Ninguno</option>
        {REMINDER_OPTIONS.timed.map((o) => (
          <option key={o.minutes} value={o.minutes}>
            {o.label}
          </option>
        ))}
      </Select>
      <Select
        label="Eventos de todo el día"
        name="reminder-all-day"
        value={value.allDay === null ? "none" : String(value.allDay)}
        onChange={(e) =>
          void change({ ...value, allDay: read(e.target.value) })
        }
      >
        <option value="none">Ninguno</option>
        {REMINDER_OPTIONS.allDay.map((o) => (
          <option key={o.minutes} value={o.minutes}>
            {o.label}
          </option>
        ))}
      </Select>
      <FormAlert message={error} />
    </div>
  );
}

function Kinds({
  notify,
  save,
}: {
  notify: NotifyPrefs;
  save: NotificationActions["setNotify"];
}) {
  const [value, setValue] = useState(notify);
  const [error, setError] = useState<string>();

  async function toggle(key: keyof NotifyPrefs, next: boolean) {
    const before = value;
    const updated = { ...value, [key]: next };
    setValue(updated);
    setError(undefined);
    const result = await save(updated).catch(() => ({
      error: "No se ha podido guardar. Inténtalo de nuevo.",
    }));
    if (result.error) {
      setValue(before);
      setError(result.error);
      return false;
    }
    return true;
  }

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-base font-semibold text-ink">Avisarme cuando…</h3>
      {KINDS.map(({ key, label }) => (
        <Switch
          key={key}
          label={label}
          checked={value[key]}
          onCheckedChange={(next) => toggle(key, next)}
        />
      ))}
      <FormAlert message={error} />
    </div>
  );
}

export function NotificationSettings({
  publicKey,
  devices,
  defaults,
  notify,
  actions,
}: {
  publicKey: string | null;
  devices: { id: string; device: string; endpoint: string }[];
  defaults: { timed: number | null; allDay: number | null };
  notify: NotifyPrefs;
  actions: NotificationActions;
}) {
  const [endpoint, setEndpoint] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    void currentEndpoint()
      .then((value) => {
        if (live) setEndpoint(value);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [devices]);
  const subscribed = devices.some((d) => d.endpoint === endpoint)
    ? endpoint
    : null;

  return (
    <div className="flex flex-col gap-6">
      <ThisDevice
        publicKey={publicKey}
        subscribed={subscribed}
        actions={actions}
      />
      <div className="flex flex-col gap-2">
        <h3 className="text-base font-semibold text-ink">
          Dispositivos con avisos
        </h3>
        {devices.length === 0 ? (
          <p className="text-sm text-muted">
            Ningún dispositivo recibe avisos.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-line">
            {devices.map((d) => (
              <li
                key={d.id}
                className="flex min-h-11 items-center justify-between gap-3 py-1"
              >
                <span className="text-ink">
                  {d.device}
                  {d.endpoint === endpoint ? (
                    <span className="text-sm text-muted"> · este</span>
                  ) : null}
                </span>
                <Button
                  variant="quiet"
                  aria-label={`Quitar ${d.device}`}
                  onClick={() => void actions.remove(d.id)}
                >
                  Quitar
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <Defaults defaults={defaults} save={actions.setDefaults} />
      <Kinds notify={notify} save={actions.setNotify} />
    </div>
  );
}
