# Plan 048 — Ampliación de Notas

Spec: `specs/048-notas-ampliacion/spec.md`.

> Estado: aprobado de antemano por el usuario en el prompt de arranque (2026-11-18).

## Resumen de arquitectura

- **Base de datos**: `note_items` gana `due_date date` y `due_time time`; `position` pasa a `double precision` (orden fraccionario, D1). `notes` gana `event_id uuid` (FK compuesta con `calendar_id` cuando es compartida; `on delete set null`). `person_preferences` o `profiles` gana `show_tasks boolean` (D3). Función `calendar_tasks(p_from, p_to)` (`SECURITY INVOKER`) devuelve notas y elementos pendientes con fecha en el rango.
- **Interfaz**: `Checklist` añade asa y arrastre (`use-item-drag.ts`, Pointer Events), teclado Alt+flechas, menú de fecha. El calendario pinta `TaskBlock` en la franja de día completo, el mes y la agenda, leídos con `loadTasks` junto a la ventana de eventos (como `loadBusy`, solo si "Tareas con fecha" está activo).
- **Detalle de evento**: `EventNotes` (como `EventComments`, se carga después de abrir) con "Añadir nota" → `/dashboard/notes/new?event=<id>`.
- **Venito**: herramientas `create_notes`, `add_note_items` (escritura, solo con `wantsWrite`) y `list_notes` (lectura), resueltas en el servidor con `matchNote` (reutiliza la normalización de `calendar-match.ts`), con acciones `created` como la 036.
- **Sin conexión**: `OfflineChange` gana `note.item.due`, `note.item.move` (con la `position` nueva) y `note.link`; `describe.ts`, `applyOfflineChange`, `offline-writes.ts` y `sw.js` los aplican (regla de la 035: el bucle está dos veces).

## Módulos y responsabilidades

| Módulo | Cambio |
|--------|--------|
| `supabase/migrations/20261129100000_notes_more.sql` | Columnas, `calendar_tasks`, permisos por columna, `notes_rules` con `event_id` del mismo calendario |
| `src/lib/notes/order.ts`, `due.ts` (puros) | Posición entre dos (`between`), renormalizar si hace falta; textos y vencido |
| `src/lib/notes/match.ts` (puro) | Nota por nombre (RF-13) |
| `src/components/notes/checklist.tsx`, `item-due-menu.tsx`, `use-item-drag.ts` | RF-1 a RF-5 |
| `src/components/calendar/task-block.tsx`, `calendar-filters.tsx`, vistas | RF-6 a RF-8 |
| `src/app/dashboard/calendar/task-actions.ts` | `loadTasks`, `toggleTaskItem` |
| `src/components/notes/event-notes.tsx`, `event-panel.tsx`, `note-form.tsx` | RF-9 a RF-11 |
| `src/lib/assistant/tool-definitions.ts`, `tools.ts`, `actions.ts`, `app/dashboard/assistant/note-writes.ts` | RF-12 a RF-14 |
| `tests/assistant-eval/questions.ts`, `write-questions.ts` | 5 preguntas nuevas |
| `src/lib/offline/*`, `public/sw.js` | RF-15 |

## Decisiones

- D1: `position` fraccionaria: mover un elemento escribe una sola fila; si dos posiciones quedan a menos de 1e-9, se renumera la lista en una acción.
- D2: Una nota se vincula a **un** evento (o repetición): simple y suficiente; una nota de varios eventos es raro.
- D3: "Tareas con fecha" guardado en `profiles.show_tasks` (todos sus dispositivos), como `show_weekends`.
- D4: Las tareas en el calendario solo en la franja de día completo y como bloques con casilla, aunque tengan hora: no compiten con los eventos en la rejilla.

## Pasos de producción (los ejecuta el usuario)

Las migraciones de la 028 (`notes`, `notes_calendar_functions`) deben estar en prod antes. Después:
```
npx supabase link --project-ref yznbdoskvtxeasujtirk
npx supabase db push
npx supabase link --project-ref uthubyzhonrtrmbcqcjh
```

## Riesgos

- Cambiar el tipo de `position` con datos: `alter column … type double precision using position::double precision` conserva el orden.
