import { LinkButton } from "@/components/ui/link-button";
import { SCOPE_NAMES } from "@/lib/sync/scopes";

/**
 * An account that only reads, shown to its owner: connecting again with the
 * new permissions lets CaFam write in Google (spec 009 RF-3, RF-5).
 */
export function ReconnectNotice({
  email,
  missing = [],
}: {
  email: string;
  /** Permissions Google did not grant on the last connection. */
  missing?: string[];
}) {
  return (
    <section className="flex flex-col gap-3 rounded-3xl border border-control bg-paper p-4 sm:p-6">
      <p className="text-ink">
        La cuenta <span className="font-semibold break-all">{email}</span> solo
        puede leer. Vuelve a conectarla para crear y cambiar eventos de Google
        desde CaFam.
      </p>
      {missing.length > 0 ? (
        <div className="text-sm text-ink">
          <p>En Google no se marcó el permiso para:</p>
          <ul className="mt-1 list-disc pl-5">
            {missing.map((scope) => (
              <li key={scope}>{SCOPE_NAMES[scope]}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <div>
        <LinkButton href="/dashboard/connections/new?provider=google">
          Volver a conectar
        </LinkButton>
      </div>
    </section>
  );
}
