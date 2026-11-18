# Plan 044 — Importar a un calendario existente y actualizar lo importado

Spec: `specs/044-importar-y-actualizar-ics/spec.md`.

> Estado: aprobado de antemano por el usuario en el prompt de arranque (2026-11-18).

## Resumen de arquitectura

```
/dashboard/import ── importIcs (acción) ── runImport (004) ── EventRow + externalId
   ├ destino nuevo     → import_calendar v2 (guarda external_id)
   ├ destino existente → import_into_calendar(p_calendar_id, p_events)  (insert … on conflict do nothing)
   └ "mantener"        → create_ics_subscription(p_calendar_id, p_url)  (URL a Vault)
pg_cron ics-refresh-due ── ics_trigger() ── POST /api/ics/refresh (hasCronSecret)
   /api/ics/refresh: ics_claim_due(p_secret) → ics_get_url(p_secret, id) → fetchIcs → runImport
                     → ics_apply_events(p_secret, id, events, p_read_at, p_from, p_to) | ics_fail(p_secret, id, kind)
"Actualizar ahora" ── refreshSubscription (acción, comprueba con RLS) ── el mismo motor
```

El motor (`lib/ics/refresh.ts`) sigue el patrón de `run-sync.ts`: dependencias inyectadas y sin `service_role`, con `CRON_SECRET` como `p_secret`.

## Módulos y responsabilidades

| Módulo | Cambio |
|--------|--------|
| `supabase/migrations/20261125100000_ics_subscriptions.sql` | Tabla, índice único `(calendar_id, external_id)` ya existente reutilizado, `import_calendar` v2, `import_into_calendar`, funciones de suscripción y del motor, avisos `ics_failing`, `pg_cron` |
| `src/lib/ics/convert-events.ts` | `EventRow.external_id` = `UID` o `UID#<instante UTC>` en repeticiones (RF-2) |
| `src/lib/ics/refresh.ts` | Motor con dependencias inyectadas (RF-7, RF-10) |
| `src/lib/ics/refresh-engine.ts` | Dependencias reales (cliente con clave publicable + secreto) |
| `src/app/api/ics/refresh/route.ts` | Tandas, `maxDuration` 60 |
| `src/app/dashboard/import/actions.ts`, `src/components/import/import-form.tsx`, `import-summary.tsx` | Destino, casilla y resumen (RF-1, RF-3, RF-5) |
| `src/app/dashboard/calendars/ics-actions.ts`, `src/components/import/ics-subscription-status.tsx` | Estado, "Actualizar ahora", "Dejar de actualizar" (RF-6) |
| `src/lib/account/notices` (avisos existentes) | Tipo `ics_failing` (RF-10) |

## Modelo de datos

- `ics_subscriptions (calendar_id uuid primary key → calendars cascade, created_by uuid → profiles on delete set null, secret_id uuid (Vault), state text check in ('active','paused'), last_read_at, last_summary jsonb, consecutive_failures int, last_error text, claimed_at, created_at, updated_at)`. RLS: los miembros del calendario leen `calendar_id`, `state`, `last_read_at`, `last_summary`, `last_error` (permisos por columna); la URL vive en Vault y solo la devuelve `ics_get_url` (con secreto) o `my_ics_url(p_calendar_id)` a `created_by` (RF-11).
- `import_into_calendar(p_calendar_id, p_events jsonb) returns jsonb {added, existing}`: `SECURITY INVOKER` (RLS de `events` exige Propietario o Editor y calendario no traído), `on conflict (calendar_id, external_id) do nothing`, tope de 10.000 con `external_id` → `CF429`.
- `ics_apply_events`: la lógica de `sync_apply_events` (009 + 038) sobre la suscripción: no pisa `updated_at >= p_read_at`, solo borra `external_id` no nulos dentro de `[p_from, p_to)`.
- `ics_claim_due` (6 h; manual 5 min), `ics_fail` (`transient`, `gone` → pausa a la 3.ª), `ics_trigger()` y `pg_cron` `ics-refresh-due` cada 15 minutos.
- Trigger: si `created_by` deja de ser Propietario o Editor del calendario, `state = 'paused'` (RF-13).

## Decisiones

- D1: Calendario editable y no de solo lectura: el usuario puede querer colorear o comentar los eventos del colegio; la regla "gana el último cambio" de la 009 ya está probada.
- D2: Repeticiones como filas sueltas (como la 004) y no series: convertir RRULE arbitrarias de terceros a series de CaFam es frágil y la 004 ya lo decidió.
- D3: URL en Vault: los enlaces privados de Google ("dirección secreta en formato iCal") son credenciales (P4).
- D4: No se reutiliza `synced_calendars`: esa tabla y sus funciones asumen una cuenta conectada y escritura en el proveedor; una tabla propia es más clara que añadir casos.
- D5: Las importaciones únicas antiguas no tienen `external_id`: no se deduplican contra ellas (se documenta).

## Pasos de producción (los ejecuta el usuario)

```
npx supabase link --project-ref yznbdoskvtxeasujtirk
npx supabase db push
npx supabase link --project-ref uthubyzhonrtrmbcqcjh
```

`cron_secret` y `sync_app_url` de Vault ya existen en prod (spec 007).

## Riesgos

- En dev `pg_cron` no llega a `localhost`: se prueba llamando a mano a `/api/ics/refresh`.
