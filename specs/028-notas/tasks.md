# Tasks 028 — Notas

Spec y plan aprobados de antemano (2026-11-15).

> Estado: **en curso**.

## Tareas

- [ ] T1 Esquema, RLS y funciones
  Hecho cuando: las dos migraciones aplican en limpio, `npm run db:types` regenera los tipos y `npm run test:db -- notes schema rls` pasa (CA-2). Cubre: RF-13, RF-14

- [ ] T2 Lógica pura
  Hecho cuando: `npm test -- notes-` en verde (orden, búsqueda, progreso, permisos, esquemas, mensajes). Cubre: RF-2, RF-6, RF-10, RF-13

- [ ] T3 Lecturas y acciones
  Hecho cuando: `npm test -- notes-actions` en verde (validación, traducción de errores, 0 filas = sin permiso o ya no existe). Cubre: RF-4 a RF-9, RF-11

- [ ] T4 Lista de notas y alta
  Hecho cuando: `npm test -- notes-board note-form` en verde. Cubre: RF-1 a RF-4

- [ ] T5 Editor de una nota
  Hecho cuando: `npm test -- checklist text-note note-editor` en verde (añadir con Intro, marcar y bajar, mover, deshacer, revertir al fallar, solo lectura). Cubre: RF-5 a RF-10, RF-12

- [ ] T6 Privacidad, capturas, recorrido y cierre
  Hecho cuando: `/privacy` con su sección, capturas, recorrido y P8 con `test:db` en verde. Cubre: RF-15, CA-1, CA-3, CA-4

## Trazabilidad RF → Tareas

| RF | Tarea |
|----|-------|
| RF-1 a RF-4 | T2, T4 |
| RF-5 a RF-10 | T2, T3, T5 |
| RF-11 | T3 |
| RF-12 | T1, T5 |
| RF-13, RF-14 | T1 |
| RF-15 | T6 |
