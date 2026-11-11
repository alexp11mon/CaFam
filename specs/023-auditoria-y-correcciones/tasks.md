# Tasks 023 — Auditoría y correcciones

Spec: `specs/023-auditoria-y-correcciones/spec.md`. Plan: `specs/023-auditoria-y-correcciones/plan.md` (los dos aprobados de antemano por el usuario en el prompt de arranque, 2026-11-10).

> Estado: **en curso**.

Cada tarea se hace sola y con el test primero (rojo → verde), y se cierra con la verificación de P8 en verde y su salida reportada:
`npm run typecheck && npm run lint && npm run format:check && npm test && npm run build`, más `npm run test:db` en las que tocan la base de datos (T1, T2, T3, T8, T15). Tres migraciones nuevas, solo en dev. Sin dependencias.

## Tareas

- [x] T1 Impedir que `restore_event` escriba en un evento ajeno
  Hecho cuando: `npm run test:db -- event-undo` en verde con un caso nuevo: restaurar una copia propia sobre el id de un evento de otro calendario da `CF404` y el evento ajeno no gana comentarios, imágenes ni cambia de autor; los casos existentes siguen en verde. Cubre: RF-1 | Módulo: migración `restore_event_guard` (D1)
  Evidencia (2026-11-11): caso nuevo en `event-undo.test.ts`, primero en rojo contra dev (la restauración sobre un evento de otro calendario se aceptaba) y en verde tras aplicar `restore_event_guard` en dev: `CF404`, el evento ajeno conserva su autor y no gana comentarios. `npm run test:db -- event-undo assistant access-codes` 63/63. P8 en verde: typecheck, lint (0 errores, 2 avisos previos), format:check, `npm test` 268 archivos y 2.576 tests, build.

- [ ] T2 Acotar `assistant_busy` a los calendarios propios y a lo creado por la persona
  Hecho cuando: `npm run test:db -- assistant` en verde con un caso nuevo: una persona que consiente y es Lectora del calendario de un tercero no expone los eventos de ese tercero; sus calendarios propios y lo que creó siguen saliendo. Cubre: RF-2 | Módulo: migración `assistant_busy_scope` (D2)

- [ ] T3 Serializar los intentos de `join_with_code`
  Hecho cuando: la migración `join_code_lock` añade los dos bloqueos de transacción antes del recuento y `npm run test:db -- access-code` (los tests existentes del ID y PIN) sigue en verde. Cubre: RF-3 | Módulo: migración `join_code_lock` (D3)

- [ ] T4 Cabeceras de seguridad, `robots` y comparación de secretos en tiempo constante
  Hecho cuando: `npm test -- security-headers cron-secret keep-alive sync-run images-purge` en verde: `next.config.ts` devuelve las cuatro cabeceras para `/:path*` antes de las de `/invite` y `/sw.js`; el layout raíz exporta `robots` sin indexar; `hasCronSecret` acepta solo el `Bearer` exacto y las tres rutas lo usan con las mismas respuestas. Comprobado en el navegador que la app carga y las cabeceras llegan. Cubre: RF-4, RF-5, RF-6 | Módulo: `next.config.ts`, layout, `cron-secret` (D4, D5)

- [ ] T5 Mover una repetición de día desplaza la serie
  Hecho cuando: `npm test -- recurrence-rule series-write` en verde con casos nuevos: `shiftRule` (semanal de un día y de varios, mensual por día, mensual por posición, anual, diaria sin cambios); serie de los miércoles desde el 7 de octubre de 2026 con la repetición del 11 de noviembre movida al jueves 12: con "Todos" la serie empieza el jueves 8 de octubre con `BYDAY=TH`; con "Este y los siguientes" la serie nueva empieza el 12 de noviembre y la anterior acaba antes del 11. Cubre: RF-7, RF-8 | Módulo: `rule`, `series-write` (D6)

- [ ] T6 "Todos los eventos" conserva la hora de reloj entre horarios de verano e invierno
  Hecho cuando: `npm test -- series-write` en verde con casos nuevos: serie diaria a las 18:00 desde el 24 de octubre, repetición del 11 de noviembre movida un día → la serie sigue a las 18:00 de Madrid; serie de día completo desde el 7 de octubre, repetición del 11 de noviembre a las 18:00 → la serie empieza a las 18:00 de Madrid; cambiar solo la hora sigue bien. Cubre: RF-9 | Módulo: `series-write` (D7)

- [ ] T7 Conservar la hora al mover de día un evento de última hora
  Hecho cuando: `npm test -- drag` en verde con casos nuevos: 23:50–23:55 movido de día en el mes y con Alt+→ queda a las 23:50; Alt+↓ no lo mueve; pegar sin minuto conserva las 23:50. Cubre: RF-10, RF-11 | Módulo: `drag` (D8)

- [ ] T8 Conservar los comentarios al convertir un evento en serie
  Hecho cuando: `npm run test:db` (caso nuevo en los tests de series) en verde: un evento suelto con un comentario y sin imágenes convertido en serie deja el comentario en una fila de repetición (excepción de la serie nueva) que `listComments` devuelve al abrir la primera repetición. Cubre: RF-12 | Módulo: `events/actions.ts` (D9)

- [ ] T9 Paginar `getEventsInRange`
  Hecho cuando: `npm test -- events-in-range` en verde con un cliente simulado que devuelve 1.000 filas y luego 5: la función pide la segunda página y devuelve 1.005; con una página incompleta no pide más; el orden incluye `id`. Cubre: RF-13 | Módulo: `queries` (D10)

- [ ] T10 Pedir en paralelo las lecturas independientes
  Hecho cuando: los tests existentes de `load-event`, la tarjeta, la agenda, el mini calendario y los comentarios siguen en verde y el código pide en un `Promise.all` lo que no depende entre sí (`load-event.ts`, `card-actions.ts`, `agenda-actions.ts`, `mini-month-actions.ts`, `listComments`). Cubre: RF-14, RF-15 | Módulo: cargadores

- [ ] T11 Páginas de error en español
  Hecho cuando: `npm test -- error-pages` en verde: `not-found` muestra la marca, "No encontramos esta página" y el enlace "Ir al calendario"; `error` muestra "Algo ha fallado" y "Reintentar" llama a `reset`; `global-error` pinta su propio `<html lang="es">`. Visto en el navegador en `/nope` y `/dashboard/nope`, en claro y oscuro. Cubre: RF-16, RF-17 | Módulo: `not-found`, `error`, `global-error` (D11)

- [ ] T12 Accesibilidad con teclado: salto al contenido, foco de la confirmación, "Cerrar" del cajón, contraste de la tecla y ayuda de la contraseña
  Hecho cuando: `npm test -- app-frame event-modal nav-drawer view-toolbar text-field signup-form` en verde con casos nuevos: primer enlace "Saltar al contenido" que apunta al contenido enfocable; "Seguir editando" con el foco al aparecer la confirmación; botón "Cerrar" en el cajón que lo cierra; la tecla de la vista elegida sin opacidad; `hint` enlazado con `aria-describedby` y "Mínimo 8 caracteres" en registro, cambio y recuperación de contraseña. Cubre: RF-18, RF-19, RF-22, RF-23, RF-24 | Módulo: marco, ventana, cajón, barra de vista, `TextField`

- [ ] T13 Ctrl/⌘+Z para "Deshacer" (enmienda 9)
  Hecho cuando: `npm test -- toast shortcuts` en verde: con un aviso con "Deshacer", Ctrl+Z y ⌘+Z lo ejecutan una vez; sin aviso o escribiendo en un campo no hacen nada; `SHORTCUTS` tiene la fila y la ayuda (?) la muestra. La constitución recoge la enmienda 9. Cubre: RF-20, RF-21 | Módulo: `toast`, `shortcuts` (D12)

- [ ] T14 Pulir las pantallas secundarias
  Hecho cuando: `npm test` en verde (guardia `design-tokens` incluida) con un caso nuevo para el avatar en la lista de miembros; y capturas a 375 y 1440 px en claro y oscuro de Mis calendarios, Ajustes, Cuentas conectadas, Compartir y miembros, Importar y Asistente que muestran: un solo título en el móvil, radios en tinta, botones de Ajustes con su ancho, títulos de sección con el mismo peso, avatares en miembros, etiquetas en gris, tarjetas con el mismo radio e iconos propios. Cubre: RF-25 a RF-38 | Módulo: pantallas secundarias (D13, D14)

- [ ] T15 Higiene de tests y del repositorio
  Hecho cuando: `npm run test:db -- invites` en verde comparando `expires_at` con `created_at`; `.playwright-cli/` en `.gitignore` y `.prettierignore`; `npm run lint` sin el aviso de `_events`. Cubre: RF-39, RF-40 | Módulo: tests, configuración (D15)

- [ ] T16 Validar la spec RF por RF, actualizar la documentación y cerrar
  Hecho cuando: tabla RF-1 a RF-40 con el test o la prueba que cubre cada uno; P8 completo en verde con `test:db` entero; comprobado que nada de "Diferido" se ha implementado; AGENTS.md (estado, "Añadido por la spec 023", migraciones, trampas, §12) y la constitución (enmienda 9) actualizados; usuario de prueba borrado de dev, puerto 3100 libre y `.playwright-cli/` borrada. Cubre: todos | Módulo: validación

## Trazabilidad RF → Tareas

| RF | Tarea |
|----|-------|
| RF-1 | T1 |
| RF-2 | T2 |
| RF-3 | T3 |
| RF-4, RF-5, RF-6 | T4 |
| RF-7, RF-8 | T5 |
| RF-9 | T6 |
| RF-10, RF-11 | T7 |
| RF-12 | T8 |
| RF-13 | T9 |
| RF-14, RF-15 | T10 |
| RF-16, RF-17 | T11 |
| RF-18, RF-19, RF-22, RF-23, RF-24 | T12 |
| RF-20, RF-21 | T13 |
| RF-25 a RF-38 | T14 |
| RF-39, RF-40 | T15 |
| Todos | T16 |
