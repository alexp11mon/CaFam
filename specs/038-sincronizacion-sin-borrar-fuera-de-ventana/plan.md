# Plan 038 — La sincronización no borra lo que queda fuera de la ventana

Spec: `specs/038-sincronizacion-sin-borrar-fuera-de-ventana/spec.md`.

> Estado: aprobado de antemano por el usuario en el prompt de arranque (2026-11-18).

## Resumen de arquitectura

Un cambio en la base de datos y otro en el motor; nada de arquitectura nueva.

- Migración `sync_apply_window`: vuelve a crear `sync_apply_events` con tres argumentos más, todos con valor por defecto: `p_from timestamptz`, `p_to timestamptz` y `p_keep text[]`.
- `run-sync.ts` pasa la ventana que usó para leer y los `external_id` omitidos por `limitEvents`.
- `limit-events.ts` devuelve también la lista de omitidos (hoy solo el número).
- El detalle muestra la nota de copia antigua (RF-6) con un texto de `provider-labels.ts`.

## Módulos y responsabilidades

| Módulo | Cambio |
|--------|--------|
| `supabase/migrations/20261119100000_sync_apply_window.sql` | `drop function` de la firma de 7 argumentos y `create` con 10; el `delete` añade `and (p_from is null or (e.ends_at > p_from and e.starts_at < p_to))` y `and not (e.external_id = any(coalesce(p_keep, '{}')))` (RF-1 a RF-4, RF-8) |
| `src/lib/sync/limit-events.ts` | Devuelve `{ events, omitted, omittedIds }` (RF-3) |
| `src/lib/sync/run-sync.ts` | Guarda la ventana en una constante, la usa para leer y la pasa como `p_from`/`p_to`, con `p_keep: omittedIds` |
| `src/lib/sync/window.ts` | `isOutsideWindow(startsAt, now)` puro, para la nota del detalle (RF-6) |
| `src/lib/sync/provider-labels.ts` | `staleCopyText(provider)` |
| `src/components/calendar/event-panel.tsx` | Muestra la nota si el evento es traído y `isOutsideWindow` |
| `src/types/database.ts` | Regenerado |

## Modelo de datos

Sin tablas ni columnas. Solo cambia la firma de `sync_apply_events` (mismos permisos: `anon`, `authenticated`, `service_role`, con `p_secret`).

## Decisiones

- D1: Ventana como argumentos, no calculada en SQL. El motor ya conoce la ventana exacta que pidió al proveedor; calcularla en SQL duplicaría `MONTHS_BACK`/`MONTHS_AHEAD` y fallaría si un día difieren.
- D2: Solape y no "empieza dentro": un evento largo que cruza el borde sí se leyó del proveedor (Google e iCloud devuelven los que solapan `timeMin`/`timeMax`), así que si no vino es que se borró.
- D3: `p_keep` en vez de pasar el rango de los conservados: los omitidos pueden estar dispersos por la ventana; una lista explícita es exacta. Como mucho 8.000 ids (10.000 leídos − 2.000), unos 300 KB: dentro del límite de PostgREST.
- D4: Sin columna "copia antigua": se deduce de la fecha (RF-6). Si en el futuro se amplía la ventana, la nota cambia sola.
- D5: Firma nueva con `drop` + `create` (como hizo la 009) para que PostgREST no tenga dos sobrecargas ambiguas.

## Pasos de producción (los ejecuta el usuario)

```
npx supabase link --project-ref yznbdoskvtxeasujtirk
npx supabase db push
npx supabase link --project-ref uthubyzhonrtrmbcqcjh
```

Aplicar la migración **antes** de desplegar la app: la app nueva manda `p_from`, `p_to` y `p_keep`, que la función vieja no conoce. La función nueva sí acepta las llamadas viejas (RF-4).

## Riesgos

- El orden del despliegue (ver arriba). Mitigación: valores por defecto y nota en el resumen final.
- `test:db` intermitente (trampa conocida): repetir antes de investigar.
