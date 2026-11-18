# Tasks 046 — Papelera y deshacer de varias acciones

Spec: `specs/046-papelera-y-deshacer/spec.md`. Plan: `specs/046-papelera-y-deshacer/plan.md` (aprobados de antemano por el usuario el 2026-11-18).

> Estado: pendiente.

Cada tarea se hace sola y con el test primero. P8 en verde y su salida al cerrar cada una; `npm run test:db` en T1 y T2.

## Tareas

- [ ] T1 Papelera de 30 días en la base de datos
  Hecho cuando: `npm run test:db -- event-trash` en verde (tests de la 017 adaptados y nuevos).
  - Migración, `db:push`, `db:types`. Varias copias por usuario; Editor restaura lo borrado por otro; Lector y ajeno no ven ni restauran; caducada no restaura; `p_event_id` de otro calendario → `CF404` (023); vaciar solo propietario; purga a 30 días.
  - Imágenes de la papelera no se purgan; al vaciar, sí.

  Cubre: RF-1, RF-4 a RF-7, RF-9, RF-10 | Evidencia: —
- [ ] T2 Series en la papelera
  Hecho cuando: `npm run test:db -- event-trash-series` y `npm test -- event-actions` en verde: serie entera, "este y los siguientes" y repetición; restaurar repetición sin serie se explica; la sincronización no guarda copia.

  Cubre: RF-2, RF-5, RF-8 | Evidencia: —
- [ ] T3 Pila de deshacer y rehacer
  Hecho cuando: `npm test -- undo-stack toast use-undo-toast quick-actions` en verde.
  - 20 como máximo, deshacer y rehacer en orden, conflicto saca la entrada, atajos solo fuera de campos y ventanas, aviso con "Rehacer", Venito apila sus acciones.

  Cubre: RF-11 a RF-15, RF-17 | Evidencia: —
- [ ] T4 Pantalla "Papelera"
  Hecho cuando: `npm test -- trash-list trash-item nav` en verde y capturas a 390, 768 y 1440 px en claro y oscuro (lista, vacía, confirmación).

  Cubre: RF-3, RF-5, RF-6, RNF-2 | Evidencia: —
- [ ] T5 Sin conexión
  Hecho cuando: `npm test -- offline-undo` en verde: deshacer un cambio en cola lo retira; uno ya enviado se deshace con red.

  Cubre: RF-16 | Evidencia: —
- [ ] T6 Cierre
  Hecho cuando: AGENTS.md, README y constitución (enmienda 14: deshacer varias acciones y Ctrl/⌘+Mayús+Z; papelera) actualizados; `python -m graphify update .`; P8 completa.

## Trazabilidad

| RF | Tareas |
|----|--------|
| RF-1, RF-4 a RF-10 | T1, T2, T4 |
| RF-2 | T2 |
| RF-3 | T4 |
| RF-11 a RF-15, RF-17 | T3 |
| RF-16 | T5 |
