# Plan 045 — Zona horaria por evento

Spec: `specs/045-zona-horaria-por-evento/spec.md`.

> Estado: aprobado de antemano por el usuario en el prompt de arranque (2026-11-18).

## Resumen de arquitectura

- `events` gana `start_tz text` y `end_tz text` (nulas = sin zona propia). Los instantes `starts_at`/`ends_at` no cambian de significado.
- La zona efectiva para **editar** es `start_tz ?? recurrence_tz ?? zona del perfil`. Para **mostrar** se sigue usando la del lector; el detalle añade la original si difiere.
- En una serie, `recurrence_tz` es la zona; al guardar con zona elegida se escribe `recurrence_tz = start_tz` (y `start_tz` igual, para un solo camino de lectura).
- Las acciones de eventos reciben `startTz`/`endTz` del formulario (validado contra `Intl`) y convierten con `zonedLocalToUtc` en esa zona en lugar de la del perfil.

## Módulos y responsabilidades

| Módulo | Cambio |
|--------|--------|
| `supabase/migrations/20261126100000_event_time_zone.sql` | Columnas, trigger de validación (como `validate_time_zone`), día completo → nulas; `copy_calendar_for_owner`, `restore_event`/`snapshot_event` y `sync_apply_events` conservan las columnas |
| `src/lib/calendar/event-zone.ts` (puro) | `editZone(row, profileZone)`, `originalLabel(row, viewerZone, now)`, `zoneOptions(now, recent)` con desfase |
| `src/lib/calendar/schemas.ts` | `startTz`/`endTz` opcionales |
| `src/app/dashboard/events/actions.ts`, `quick-writes.ts`, `event-writes.ts` | Conversión con la zona del evento (RF-3, RF-11) |
| `src/components/calendar/time-zone-field.tsx` | Selector plegado con búsqueda (RF-1, RF-2) |
| `src/components/calendar/event-form.tsx`, `event-panel.tsx`, `event-card.tsx` | Campo y línea original (RF-5) |
| `src/lib/sync/google-payload.ts`, `google-events.ts`, `icloud-ics.ts` | `timeZone` y `TZID` (RF-9) |
| `src/lib/ics/convert-events.ts`, `write-ics.ts` (043) | Importar y exportar la zona (RF-10) |
| `src/lib/offline/describe.ts`, `snapshot.ts` | Campo en la copia y la cola (RF-12) |
| `src/lib/assistant/write-times.ts` | Conserva la zona al editar (RF-11) |

## Decisiones

- D1: Dos columnas y no una: los vuelos son el caso que más pide la zona y tienen zonas distintas en inicio y fin (RF-2).
- D2: Guardar la zona y no cambiar los instantes: todo lo que lee rangos (vistas, sincronización, búsqueda, recordatorios) sigue funcionando sin cambios.
- D3: Las 8 zonas recientes se guardan en el dispositivo (`localStorage` `cafam-recent-zones`): sin columna nueva en `profiles`.
- D4: El formulario de alta rápida no lleva zona (se crea en la del perfil); la zona es una opción del formulario completo, como en Google Calendar.

## Pasos de producción (los ejecuta el usuario)

```
npx supabase link --project-ref yznbdoskvtxeasujtirk
npx supabase db push
npx supabase link --project-ref uthubyzhonrtrmbcqcjh
```

Aplicar antes de desplegar la app (la app nueva escribe las columnas nuevas).

## Riesgos

- `Intl.supportedValuesOf` no existe en navegadores antiguos: respaldo a una lista corta (las europeas, las americanas y UTC).
