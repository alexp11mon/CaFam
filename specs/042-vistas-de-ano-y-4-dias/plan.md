# Plan 042 — Vistas de año y de 4 días

Spec: `specs/042-vistas-de-ano-y-4-dias/spec.md`.

> Estado: aprobado de antemano por el usuario en el prompt de arranque (2026-11-18).

## Resumen de arquitectura

- `CalendarView` gana `"year"` y `"4days"`; `visibleDayRange`, `navigate` y `format` los tratan.
- **4 días** reutiliza `TimeGrid` con `days` de longitud 4 (como `WeekView` con `visibleDays`): un componente `FourDayView` fino.
- **Año**: `YearView` pinta 12 `MiniMonth` (componente existente con `month-marks`) en rejilla. Sus marcas salen de una acción `loadYearMarks(year)` → función SQL `calendar_day_marks(p_from, p_to)` que devuelve `(day date, calendar_id uuid)` distintos de los eventos sueltos y excepciones; las series se expanden en TS (`expandRows`) y se añaden. El navegador filtra por calendarios visibles.
- `useEventWindow` no carga eventos para el año; un hook `useYearMarks(year)` guarda en memoria los años pedidos y precarga el siguiente en reposo.
- `serverWindow` no cambia para 4 días (cabe en la ventana del mes); para el año la página no lee eventos, solo marcas.

## Módulos y responsabilidades

| Módulo | Cambio |
|--------|--------|
| `supabase/migrations/20261123100000_views_year.sql` | `check` de `profiles.last_view` con `year` y `4days`; función `calendar_day_marks` (`SECURITY INVOKER`, 370 días como máximo) |
| `src/lib/calendar/ranges.ts`, `format.ts`, `event-window.ts` | Rangos, navegación y títulos (RF-4, RF-6, RF-12) |
| `src/lib/calendar/year.ts` (puro) | Meses del año, columnas, fusión de marcas por calendarios visibles |
| `src/lib/calendar/shortcuts.ts` | Y y X |
| `src/components/calendar/year-view.tsx`, `four-day-view.tsx` | Vistas |
| `src/components/calendar/calendar-client.tsx`, `workspace`, `view-toolbar`, `calendar-heading.tsx` | Selector y "Más vistas" (RF-10) |
| `src/app/dashboard/calendar/year-actions.ts` | `loadYearMarks` |
| `src/lib/hooks/use-year-marks.ts` | Caché y precarga |
| `src/app/dashboard/calendar/preferences-actions.ts` | `saveLastView` acepta las nuevas |
| `src/lib/offline/offline-sources.ts` | Marcas del año y 4 días desde la copia (RF-13) |

## Decisiones

- D1: Ids `year` y `4days` en la URL (inglés, como el resto); atajos Y (de *year*, porque A es agenda) y X (libre y cercana a la mano izquierda, como en Google Calendar).
- D2: Marcas agregadas para el año (RF-5): el año completo con eventos enteros serían miles de filas; con `(día, calendario)` distintos son como mucho 365 × calendarios.
- D3: "Más vistas" en el móvil: 6 pestañas no caben a 390 px con 44 px por objetivo.

## Pasos de producción (los ejecuta el usuario)

```
npx supabase link --project-ref yznbdoskvtxeasujtirk
npx supabase db push
npx supabase link --project-ref uthubyzhonrtrmbcqcjh
```

La migración amplía un `check`: aplicarla antes de desplegar, o guardar la vista "year" fallaría (sin romper nada más).

## Riesgos

- `Activity` conserva la vista anterior en el DOM: las vistas nuevas cierran sus menús en la limpieza de efectos (trampa conocida).
