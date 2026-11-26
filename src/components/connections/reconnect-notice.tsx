import { LinkButton } from "@/components/ui/link-button";
import { SCOPE_NAMES } from "@/lib/sync/scopes";
import { T } from "@/components/i18n/locale-provider";

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
    <section className="flex flex-col gap-3 rounded-card border border-control bg-paper p-4 sm:p-6">
      <p className="text-ink">
        <T>{"La cuenta"}</T>{" "}
        <span className="font-semibold break-all">{email}</span>{" "}
        <T>
          {
            "solo puede leer. Vuelve a conectarla para crear y cambiar eventos de Google desde CaFam."
          }
        </T>
      </p>
      {missing.length > 0 ? (
        <div className="text-sm text-ink">
          <p>
            <T>{"En Google no se marcó el permiso para:"}</T>
          </p>
          <ul className="mt-1 list-disc pl-5">
            {missing.map((scope) => (
              <li key={scope}>{SCOPE_NAMES[scope]}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <div>
        <LinkButton href="/dashboard/connections/new?provider=google">
          <T>{"Volver a conectar"}</T>
        </LinkButton>
      </div>
    </section>
  );
}
