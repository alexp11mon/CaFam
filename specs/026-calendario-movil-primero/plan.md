# Plan 026 — Calendario móvil primero

Spec: `specs/026-calendario-movil-primero/spec.md`. Aprobado de antemano (2026-11-15).

## Módulos

| Módulo | Cambio |
|--------|--------|
| `src/components/calendar/calendar-dock.tsx` (nuevo) | La barra del calendario: `ViewPicker`, "‹ Hoy ›" y "Calendarios". Marca el marco con `data-has-dock` mientras está montada |
| `src/components/shell/calendar-header.tsx` | El contexto guarda cómo abrir la hoja de calendarios (`openSheet`) |
| `src/components/shell/top-bar.tsx`, `calendar-sheet.tsx` | La cabecera pierde "Hoy" y los filtros; la hoja se titula "Calendarios" |
| `src/components/calendar/calendar-client.tsx` | Pinta la barra; "Reintentar" tras un fallo de lectura |
| `src/lib/hooks/use-event-window.ts` | `retry()` |
| `src/components/calendar/calendar-workspace.tsx` | La hoja ya no lleva las vistas |
| `month-view`, `time-grid`, `calendar-skeleton` | Alto libre con la barra y las safe areas |
| `assistant-fab`, `toast` | Suben con `data-has-dock` |
| `src/app/dashboard/calendar/page.tsx` | Estado vacío con `EmptyState` |

## Decisiones

- **D1 Una barra del calendario pegada a la barra inferior, no botones flotantes.** Dos filas fijas abajo (48 + 64 px) quitan 112 px de alto, pero dejan todo el manejo en la zona del pulgar y nada tapa los eventos. Alternativas: (a) controles flotantes sobre la rejilla: tapan la última fila, que era la queja; (b) todo en la cabecera: lejos del pulgar.
- **D2 "Vista" es un botón que despliega, no cuatro pestañas.** Cuatro pestañas más "‹ Hoy ›" y "Calendarios" no caben en 390 px con objetivos de 44 px. La vista se cambia pocas veces; el periodo, muchas: por eso "‹ Hoy ›" va en el centro, siempre visible.
- **D3 Los filtros siguen montados por el workspace** en el hueco de la hoja (`createPortal`), como en el cajón de la 016: el estado optimista de visibilidad vive ahí y no se duplica.
- **D4 La barra marca el marco con un efecto** (`data-has-dock`), no con `:has()`: Activity deja el calendario oculto en el DOM (misma razón que el antiguo `data-has-fab`).
- **D5 Solo hasta 768 px.** Entre 769 y 1023 px ya hay barra de vistas arriba con sitio de sobra.

## Verificación

P8; capturas de CA-2; recorrido de CA-3; `measure.mjs`.
