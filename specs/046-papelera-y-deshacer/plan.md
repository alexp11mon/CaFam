# Plan 046 — Papelera y deshacer de varias acciones

Spec: `specs/046-papelera-y-deshacer/spec.md`.

> Estado: aprobado de antemano por el usuario en el prompt de arranque (2026-11-18).

## Resumen de arquitectura

- **Base de datos**: `event_trash` (017) pasa de "última copia por usuario, 1 h" a "una fila por borrado, 30 días". Gana `kind` (`event | occurrence | series`), `title`, `starts_at` (para listar sin abrir el JSON) y `expires_at`. Se quita el borrado de la copia anterior al guardar una nueva. `restore_event` deja de exigir "quien borró" y "primer minuto": exige rol Propietario/Editor vigente y `expires_at > now()`.
- Funciones nuevas: `trash_list()` (`SECURITY DEFINER`, filas de los calendarios con rol owner/editor del llamante, sin el JSON entero), `trash_purge(p_trash_id)` y `trash_empty(p_calendar_id)` (solo propietario).
- **Imágenes**: `images_claim_purge` no reclama objetos referenciados por `event_trash.images` no caducadas (RF-9); al purgar la papelera se encolan.
- **Series**: `deleteEvent` con alcance guarda antes una copia `series` (la fila de la serie y sus excepciones, imágenes y comentarios) con `snapshot_series`; restaurar la vuelve a insertar.
- **Pila de deshacer**: `UndoStackProvider` (en `AppFrame`, sustituye a la lógica de "última acción" de `use-undo-toast.ts`) guarda entradas `{label, undo, redo, guard}` donde `undo`/`redo` son fichas (`UndoToken` de `undo-schemas.ts`) que ya entienden `undoAction` y `quickChange`. Ctrl/⌘+Z y Ctrl/⌘+Mayús+Z/Ctrl+Y se atienden en `ToastProvider` (donde ya está Ctrl+Z).

## Módulos y responsabilidades

| Módulo | Cambio |
|--------|--------|
| `supabase/migrations/20261127100000_trash_30_days.sql` | Columnas, `snapshot_event` v2 (no borra la anterior), `snapshot_series`, `restore_event` v3, `trash_list`, `trash_purge`, `trash_empty`, `images_claim_purge` v3, `pg_cron` `event-trash-purge` a 30 días |
| `src/lib/calendar/undo.ts`, `undo-stack.ts` (puro) | Pila: apilar, deshacer, rehacer, límite 20, descartar al conflicto (RF-11 a RF-15) |
| `src/components/ui/toast.tsx`, `src/components/calendar/use-undo-toast.ts` | Atajos y aviso "Deshecho…" con "Rehacer" |
| `src/app/dashboard/events/quick-actions.ts` | `redoAction` (aplica la ficha `redo`); `deleteForUndo` usa la papelera |
| `src/app/dashboard/events/actions.ts` | Borrado con alcance guarda la serie (RF-2) |
| `src/app/dashboard/trash/page.tsx`, `actions.ts` | Pantalla y acciones (RF-3 a RF-6) |
| `src/components/trash/trash-list.tsx`, `trash-item.tsx` | Interfaz |
| `src/lib/shell/nav.ts` | Destino "Papelera" en "Más" (`needsNetwork`) |
| `src/lib/calendar/shortcuts.ts` | Filas de ayuda |
| `src/lib/offline/` | Deshacer de un cambio aún en cola lo quita de la cola (RF-16) |

## Decisiones

- D1: Papelera por calendario y visible para Editores: quien puede borrar debe poder recuperar; los Lectores no podían borrar.
- D2: Una fila por borrado con columnas de listado: listar sin deserializar el JSON de imágenes y comentarios.
- D3: Las cuotas de imágenes (012) no cuentan la papelera; su purga se retrasa hasta 30 días (RNF-1). Es el compromiso más simple sin tocar `images_total_limit`.
- D4: Pila en memoria de la pestaña (RF-16): guardarla exigiría reconciliar acciones viejas con el estado actual; Google Calendar tampoco la guarda.
- D5: La sincronización no usa la papelera (RF-8): `sync_apply_events` borra sin `snapshot_event`.

## Pasos de producción (los ejecuta el usuario)

```
npx supabase link --project-ref yznbdoskvtxeasujtirk
npx supabase db push
npx supabase link --project-ref uthubyzhonrtrmbcqcjh
```

Aplicar antes de desplegar: la app nueva llama a `trash_list` y `snapshot_series`.

## Riesgos

- Volumen: una familia borra pocos eventos; 30 días de JSON son kilobytes.
