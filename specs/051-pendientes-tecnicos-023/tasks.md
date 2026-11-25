# Tasks 051 — Pendientes técnicos de la auditoría (023)

Spec: `specs/051-pendientes-tecnicos-023/spec.md`. Plan: `specs/051-pendientes-tecnicos-023/plan.md` (aprobados de antemano por el usuario el 2026-11-18).

> Estado: pendiente.

Cada tarea se hace sola y con el test primero. P8 en verde y su salida al cerrar cada una; `npm run test:db` en T1, T2 y T5.

## Tareas

- [x] T1 Autor impuesto por el servidor
  Hecho cuando: `npm run test:db -- event-author calendars-events event-series` y `npm test -- event-actions` en verde.
  - Un Editor que manda otro `created_by` queda como autor; `update` no lo cambia; convertir en serie un evento ajeno con imágenes conserva el autor del original; copias, juntar, importar, sincronizar y restaurar conservan sus autores.

  Cubre: RF-1 a RF-3 | Evidencia: 2026-11-25. `test:db -- event-author calendars-events event-series account-copy account-delete assistant-writes account-apply series-copy` 104/104; `npm test` 3906/3906; typecheck, lint (1 aviso previo), format y build en verde. El trigger solo actúa con `current_user = 'authenticated'` (escrituras directas del cliente): las funciones `SECURITY DEFINER` corren como su dueño y conservan sus autores sin la marca `app.keep_author` del plan D1 (mismo efecto, menos código).
- [x] T2 Cuota sin carreras
  Hecho cuando: `npm run test:db -- assistant-quota` y `npm test -- assistant-route` en verde.
  - 35 reservas en paralelo con 29 respondidas → solo 1 cabe; liberar devuelve el hueco; una reserva de hace 3 minutos no cuenta; error del proveedor y cancelación liberan.

  Cubre: RF-4, RF-5 | Evidencia: 2026-11-25. `test:db -- assistant-quota assistant.test` 17/17 (35 reservas en paralelo con 29 respondidas: 1 cabe y 34 reciben `CF429`; liberar devuelve el hueco; una reserva caducada y las de ayer no cuentan; el cliente ya no inserta filas); `npm test -- assistant-route` 18/18 (error del proveedor y cancelación llaman a `assistant_release`); P8 completo en verde. El inicio del día lo calcula ahora `assistant_reserve` con la zona del perfil, así que `quotaDayStart` se ha borrado.
- [x] T3 CSP
  Hecho cuando: `npm test -- csp next-config-headers csp-report-route` en verde y recorrido con Playwright y Edge sobre `next start -p 3100` (login, calendario, detalle con imagen, asistente, notas, ajustes, tema oscuro, sin conexión) sin errores de CSP en la consola.

  Cubre: RF-6 a RF-9 | Evidencia: 2026-11-25. `npm test -- csp next-config-headers csp-report-route` 11/11; P8 completo en verde (417 archivos, 3912 tests). Recorrido con Playwright y Edge sobre `next start -p 3100`, claro y oscuro (login, calendario, detalle con imagen, asistente en streaming, notas, ajustes, `/offline`, conexiones): **ninguna** violación de la política aplicada, imagen visible, `data-theme` correcto y sin errores de página. La *Report-Only* estricta envía unos 13 avisos por página: los scripts en línea de Next (datos RSC) y un `eval` de prueba de una librería, como preveía D3. Con eso queda medido que `script-src` no se puede endurecer hoy; conviene quitar la cabecera *Report-Only* tras unos días en producción para no gastar invocaciones.
- [ ] T4 Helpers de `test:db`
  Hecho cuando: `npm test -- integration-helpers` (con `fetch` simulado que se cuelga y que da `rate limit`) en verde y `npm run test:db` completo en verde.

  Cubre: RF-10, RF-11 | Evidencia: —
- [ ] T5 Lectura por rango
  Hecho cuando: `node scripts/perf/range-explain.mjs` ejecutado en dev con la salida de `EXPLAIN` antes (y después, si se cambia) en la evidencia; si hay migración, `npm run test:db -- range-performance` en verde.

  Cubre: RF-12 | Evidencia: —
- [ ] T6 Cierre
  Hecho cuando: "Diferido" de la 023 marca lo resuelto con la spec 051, AGENTS.md (patrones del autor y la cuota, trampas de la CSP) actualizado; `python -m graphify update .`; P8 completa.

## Trazabilidad

| RF | Tareas |
|----|--------|
| RF-1 a RF-3 | T1 |
| RF-4, RF-5 | T2 |
| RF-6 a RF-9 | T3 |
| RF-10, RF-11 | T4 |
| RF-12 | T5 |
