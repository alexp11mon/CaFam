// The cron secret for materialize_occurrence (spec 013 T14), kept out of the
// Server Actions file that client components import (no-secrets guard, P4).
export function cronSecret(): string {
  return process.env.CRON_SECRET ?? "";
}
