# Tasks 046 — Papelera y deshacer de varias acciones

Spec: `specs/046-papelera-y-deshacer/spec.md`. Plan: `specs/046-papelera-y-deshacer/plan.md` (aprobados de antemano por el usuario el 2026-11-18).

> Estado: pendiente.

Cada tarea se hace sola y con el test primero. P8 en verde y su salida al cerrar cada una; `npm run test:db` en T1 y T2.

## Tareas

- [x] T1 Papelera de 30 días en la base de datos
  Hecho cuando: `npm run test:db -- event-trash` en verde (tests de la 017 adaptados y nuevos).
  - Migración, `db:push`, `db:types`. Varias copias por usuario; Editor restaura lo borrado por otro; Lector y ajeno no ven ni restauran; caducada no restaura; `p_event_id` de otro calendario → `CF404` (023); vaciar solo propietario; purga a 30 días.
  - Imágenes de la papelera no se purgan; al vaciar, sí.

  Cubre: RF-1, RF-4 a RF-7, RF-9, RF-10 | Evidencia: migración `20261127100000_trash_30_days` aplicada en dev (`db:push`, `db:types`; incluye `snapshot_series` para la T2); `event-trash.test.ts` nuevo y `event-undo.test.ts` adaptado: `test:db -- event-trash event-undo` 22 en verde (varias copias, Editor restaura lo de otro pasado el minuto, Lector y ajeno ni ven ni restauran, caducada no restaura, `CF404` de la 023, borrar una y vaciar solo el propietario, purga a 30 días, la copia sobrevive a la cuenta de su autor e imágenes retenidas hasta que la copia se va).
- [x] T2 Series en la papelera
  Hecho cuando: `npm run test:db -- event-trash-series` y `npm test -- event-actions` en verde: serie entera, "este y los siguientes" y repetición; restaurar repetición sin serie se explica; la sincronización no guarda copia.

  Cubre: RF-2, RF-5, RF-8 | Evidencia: `snapshotForTrash` y `dropTrash` (`event-writes.ts`) en los tres caminos de borrado (`deleteEvent`, `deleteForUndo` y el envío sin conexión): suelto y "Solo este evento" con `snapshot_event`, "Este y los siguientes" y "Todos" con `snapshot_series` (número de repeticiones con `countOccurrences` si la serie acaba); si el borrado no se hace, la copia se quita. `test:db -- event-trash-series` 3 en verde (serie entera con imágenes y comentarios, corte restaurado tal como estaba, repetición sin serie → `CF410`); `npm test` 3.732 en verde (`event-actions`, `quick-actions` con la guarda de RF-15 y "La serie de esta repetición ya no existe"). La sincronización no pasa por `snapshot_event` (D5): `sync_apply_events` borra directamente.
- [x] T3 Pila de deshacer y rehacer
  Hecho cuando: `npm test -- undo-stack toast use-undo-toast quick-actions` en verde.
  - 20 como máximo, deshacer y rehacer en orden, conflicto saca la entrada, atajos solo fuera de campos y ventanas, aviso con "Rehacer", Venito apila sus acciones.

  Cubre: RF-11 a RF-15, RF-17 | Evidencia: `lib/calendar/undo-stack.ts` (puro: 20 como máximo, una acción nueva vacía "rehacer", el fallo saca la entrada) y `UndoStackProvider` (`components/calendar/undo-stack.tsx`, en `AppFrame`: Ctrl/⌘+Z, Ctrl/⌘+Mayús+Z y Ctrl+Y fuera de campos y de ventanas modales, "Deshecho: mover «Dentista»" con "Rehacer"). `undoAction` devuelve el inverso de cada ficha (`change` ↔ `change`, `restore` ↔ `delete`, pegar se borra por la papelera); `useUndoToast` apila con `tokenStep`; las tarjetas de Venito se apilan sin "Rehacer" (`stack-cards.ts`). `npm test -- undo-stack use-undo-toast toast quick-actions` 65 en verde; `npm test` 3.744 en verde.
- [x] T4 Pantalla "Papelera"
  Hecho cuando: `npm test -- trash-list trash-item nav` en verde y capturas a 390, 768 y 1440 px en claro y oscuro (lista, vacía, confirmación).

  Cubre: RF-3, RF-5, RF-6, RNF-2 | Evidencia: `/dashboard/trash` (`page.tsx` con `readTrash` de `lib/calendar/trash-queries.ts` y `actions.ts`: `restoreFromTrash` por el mismo camino que "Deshacer", así un traído vuelve primero a Google o iCloud; `purgeFromTrash` y `emptyTrash`). `TrashList` (por calendario, en el orden de "Mis calendarios", "Vaciar la papelera" solo del Propietario con confirmación) y `TrashItem` ("Borrado por Ana hace 2 días", "Quedan 28 días", "serie, 24 repeticiones", "Restaurar" con el motivo si no se puede y "Borrar para siempre" con confirmación); textos puros en `lib/calendar/trash.ts`. Destino "Papelera" en "Más" (`needsNetwork`) y enlace "Papelera" en las opciones de cada calendario para Propietario y Editores. `npm test -- trash-list trash-item nav` 40 en verde; `npm test` 3.754 en verde. Capturas en `capturas/` (lista, confirmación y vacía a 390, 768 y 1440 px, claro y oscuro) con `scripts/screenshots-046.mjs`.
- [x] T5 Sin conexión
  Hecho cuando: `npm test -- offline-undo` en verde: deshacer un cambio en cola lo retira; uno ya enviado se deshace con red.

  Cubre: RF-16 | Evidencia: la ficha `offline` lleva el cambio (`withOutbox`). `tokenStep`: en la cola, `undoChange` lo retira sin llamar al servidor; ya enviado y con red, aplica su inverso (`inverseOf`, `lib/offline/undo-sent.ts`: cambio ↔ cambio, alta ↔ borrado, solo eventos sueltos) con `applyOfflineChange`, cuyo conflicto de tres versiones da "Este evento ha cambiado entretanto" (RF-13), y el inverso del inverso es "Rehacer". `npm test -- offline-undo use-undo-toast with-outbox` 16 en verde; `npm test` 3.760 en verde.
- [x] T6 Cierre
  Hecho cuando: AGENTS.md, README y constitución (enmienda 14: deshacer varias acciones y Ctrl/⌘+Mayús+Z; papelera) actualizados; `python -m graphify update .`; P8 completa.

  Evidencia: AGENTS.md (fila de la 046, ruta `/dashboard/trash`, migraciones, sección "Añadido por la spec 046" y §12), README (fila, función y hoja de ruta) y constitución (enmienda 14 y las reglas de atajos y "Deshacer") actualizados; `python -m graphify update .` hecho. P8: `typecheck`, `lint` (0 errores; el aviso de siempre en `event-form.tsx`), `format:check`, `npm test` 384 archivos y 3.760 tests en verde y `build` correcto. `npm run test:db` 677 de 679: fallaron por tiempo `import-fixtures` (2.000 eventos) y `live-changes` (5 s) con la máquina cargada, y repetidos solos pasan los 17.

## Trazabilidad

| RF | Tareas |
|----|--------|
| RF-1, RF-4 a RF-10 | T1, T2, T4 |
| RF-2 | T2 |
| RF-3 | T4 |
| RF-11 a RF-15, RF-17 | T3 |
| RF-16 | T5 |
