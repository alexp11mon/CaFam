# Tasks 039 — Búsqueda de eventos

Spec: `specs/039-busqueda-de-eventos/spec.md`. Plan: `specs/039-busqueda-de-eventos/plan.md` (aprobados de antemano por el usuario el 2026-11-18).

> Estado: en curso.

Cada tarea se hace sola y con el test primero. P8 en verde y su salida al cerrar cada una; `npm run test:db` en T2.

## Tareas

- [x] T1 Lógica pura de búsqueda
  Hecho cuando: `npm test -- search-normalize search-group search-highlight search-recent` en verde.
  - `normalize` igual que `search_text` (tildes, ñ conservada, mayúsculas, espacios).
  - `group`: próximos por día ascendente, pasados descendente, zona del perfil y días completos por fecha UTC.
  - `highlight` con varias palabras y tildes; `recent` con 5 como máximo, sin repetidas y tolerando `localStorage` que lanza.

  Cubre: RF-3, RF-6, RF-7, RF-9 | Evidencia: `npm test -- search-normalize search-group search-highlight search-recent` 13/13 (rojo antes: módulos inexistentes); P8 en verde (3.214 tests).
- [x] T2 Índices y función `search_events`
  Hecho cuando: `npm run test:db -- event-search` en verde.
  - Migración, `db:push` y `db:types`.
  - Encuentra por título, lugar, descripción y comentario; "medico" encuentra "Médico"; prefijo "denti".
  - Un usuario ajeno, un expulsado y `anon` no ven nada; un Lector sí.
  - `EXPLAIN` con 20.000 eventos sembrados usa los índices (anotado en la evidencia).

  Cubre: RF-3, RF-4, RF-11, RNF-1 | Evidencia: migración `20261120100000_event_search` aplicada en dev y tipos regenerados; `npm run test:db -- event-search` 4/4; `EXPLAIN ANALYZE` con 20.000 eventos sembrados en una transacción deshecha (`supabase db query --linked`): `Bitmap Index Scan on events_search_idx`, 6,4 ms; P8 en verde.
- [ ] T3 `searchEvents` con series
  Hecho cuando: `npm test -- search-queries` (con Supabase simulado) en verde.
  - Una serie semanal que coincide da sus repeticiones del periodo; una excepción con otro título solo cuando coincide la excepción.
  - Máximo 100 con `more: true`; "Buscar más atrás" amplía `from` 2 años.

  Cubre: RF-5, RF-8 | Evidencia: —
- [ ] T4 Pantalla de búsqueda y accesos
  Hecho cuando: `npm test -- search-screen calendar-heading top-nav shortcuts` en verde y capturas a 390, 768 y 1440 px en claro y oscuro (Violeta y Ámbar) en `capturas/`.
  - Campo enfocado, espera de 350 ms, estados (recientes, buscando, vacío, error con "Reintentar"), agrupado, "Oculto en el calendario", extracto del comentario, `aria-live`.
  - Botón en las dos cabeceras y tecla `/` (no escribiendo ni con ventana abierta).

  Cubre: RF-1, RF-2, RF-6 a RF-9, RF-12, RNF-3 | Evidencia: —
- [ ] T5 Búsqueda sin conexión
  Hecho cuando: `npm test -- offline-search` en verde y prueba con `scripts/e2e-offline.mjs` ampliado (buscar sin red).
  - `searchOffline` sobre la copia con eventos, repeticiones y comentarios, con la nota del rango.
  - La ruta abre en `OfflineApp`.

  Cubre: RF-10 | Evidencia: —
- [ ] T6 Cierre
  Hecho cuando: AGENTS.md (§2, sección de la spec, rutas, estructura), README y constitución (hoja de ruta: "Búsqueda" pasa a 039) actualizados; `python -m graphify update .`; P8 completa.

## Trazabilidad

| RF | Tareas |
|----|--------|
| RF-1, RF-2 | T4 |
| RF-3 | T1, T2 |
| RF-4, RF-11 | T2 |
| RF-5 | T3 |
| RF-6 a RF-9, RF-12 | T1, T4 |
| RF-10 | T5 |
