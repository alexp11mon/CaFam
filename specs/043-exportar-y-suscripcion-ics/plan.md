# Plan 043 — Exportar a `.ics` y suscripción de solo lectura

Spec: `specs/043-exportar-y-suscripcion-ics/spec.md`.

> Estado: aprobado de antemano por el usuario en el prompt de arranque (2026-11-18).

## Resumen de arquitectura

```
Exportar:  GET /api/ics/export?calendar=<id> | ?visible=1  (con sesión, RLS) ──▶ writeIcs(rows) ──▶ descarga
Suscribir: GET /api/ics/<token>.ics (pública) ──▶ ics_feed(p_token) SECURITY DEFINER ──▶ writeIcs ──▶ text/calendar
Gestión:   share/actions.ts: createIcsFeed, disableIcsFeed (solo propietario, RPC)
```

`writeIcs` es puro (`lib/ics/write-ics.ts`): recibe filas de `events` (con `recurrence`, `recurrence_tz`, `exdates`, `series_id`, `original_start`) y escribe el texto. Las `VTIMEZONE` se generan con las transiciones del año en curso ±2 desde `Intl` (`lib/ics/vtimezone.ts`), suficiente para los clientes habituales.

## Módulos y responsabilidades

| Módulo | Cambio |
|--------|--------|
| `supabase/migrations/20261124100000_ics_feeds.sql` | Tabla `calendar_feeds`, funciones `create_ics_feed`, `disable_ics_feed`, `ics_feed(p_token)` con límite por hora |
| `src/lib/ics/write-ics.ts`, `fold.ts`, `vtimezone.ts` | Escritura pura (RF-3 a RF-6) |
| `src/lib/ics/export-queries.ts` | Lecturas con sesión para exportar (todos los eventos, paginados con `allRows`) |
| `src/app/api/ics/export/route.ts` | Descarga con sesión (RF-1, RF-2) |
| `src/app/api/ics/[token]/route.ts` | Suscripción pública (RF-9, RF-10, RNF-3); el segmento acepta `<token>.ics` |
| `src/lib/auth/route-access.ts` | `/api/ics/*` público a nivel de proxy (la exportación comprueba la sesión ella misma) |
| `src/app/dashboard/calendars/[id]/share/actions.ts`, `src/components/sharing/ics-feed-panel.tsx` | Gestión del enlace (RF-7, RF-8, RF-12) |
| `src/components/dashboard/calendar-list.tsx`, `src/components/calendar/calendar-filters.tsx` | "Exportar (.ics)" y "Exportar los visibles" |
| `next.config.ts` | `X-Robots-Tag` y `Referrer-Policy: no-referrer` para `/api/ics/:path*` |
| `src/app/privacy/page.tsx` | Sección |

## Modelo de datos

- `calendar_feeds (calendar_id uuid primary key → calendars cascade, token_hash text not null unique, created_by uuid, created_at, hits int, hits_window timestamptz)`. RLS sin políticas de lectura del hash; el propietario ve si existe con una vista por columnas (`calendar_id`, `created_at`), como `calendar_invites`.
- `create_ics_feed(p_calendar_id) returns text`: solo propietario (`CF404` si no); genera 32 bytes aleatorios, guarda SHA-256 y devuelve el token una vez (sustituye al anterior).
- `disable_ics_feed(p_calendar_id)`.
- `ics_feed(p_token text)` a `anon`: busca por hash, comprueba que el calendario tiene propietario, aplica el límite (60 por hora) y devuelve `{name, rows}` con los eventos desde `now() - 6 meses` y todas las series vivas. `CF404` / `CF429`.
- `merge_calendars` y la orfandad borran el feed por la cascada o con una línea añadida en un trigger sobre `calendars.orphaned_at`.

## Decisiones

- D1: Escritura propia del `.ics` y no `ical.js`: el formato de salida es simple y así el módulo es puro y testeable en el navegador; `ical.js` se usa en los tests para releer (ida y vuelta).
- D2: Un enlace por calendario y solo del propietario: compartir un calendario sin su permiso no debe ser posible para un Editor.
- D3: Ventana de la suscripción de 6 meses atrás sin fin: los clientes no necesitan el pasado lejano y el archivo queda pequeño.
- D4: La exportación incluye todo el historial (es una copia de seguridad).

## Pasos de producción (los ejecuta el usuario)

```
npx supabase link --project-ref yznbdoskvtxeasujtirk
npx supabase db push
npx supabase link --project-ref uthubyzhonrtrmbcqcjh
```

## Riesgos

- Google Calendar tarda hasta 24 h en refrescar una suscripción: se explica en la página.
