# Tasks 029 — Pantallas restantes y cierre

> Estado: **cerrada** (2026-11-16).

- [x] T1 Revisión con capturas y correcciones
  Evidencia: hoja de 20 pantallas a 390 px. Corregido: botón "Continuar a Google", botón del selector de archivo y días elegidos del editor de repetición (seguían en tinta); acciones de "Mis calendarios" (cinco botones apilados → uno principal y una fila de chips); Venito en la portada. `npm test` en verde sin cambiar tests. Cubre: RF-1, RF-2, RF-3

- [x] T2 Recorrido en móvil
  Evidencia (2026-11-16, con la identidad Nexo): `node --env-file=.env.test.local scripts/e2e-phone.mjs` → 8 de 8: Registrarse; Crear un calendario; Crear un evento tocando un hueco; Mover el evento (24 px más abajo); Cambiar de vista y de periodo (siguiente 2026-12-01, hoy 2026-11-16); Venito y una sugerencia (respuesta, con el proveedor simulado); Crear una nota y marcar tareas (1 de 3); Ajustes y tema oscuro. Sin errores de página. Cubre: RF-5, CA-2

- [x] T3 Capturas
  Evidencia: 40 capturas en `capturas/` (20 pantallas a 390 px en claro y a 1440 px en oscuro) y la hoja `_hoja-390-light.png`. Cubre: RF-6, CA-3

- [x] T4 AGENTS.md, constitución y cierre
  Evidencia (2026-11-16): `AGENTS.md` actualizado; enmiendas 10 y 11 en la constitución. P8: typecheck sin errores, lint 0 errores y 1 aviso previo, format:check limpio, `npm test` 287 archivos y 2.761 tests, build correcto, `npm run test:db -- --no-file-parallelism` 49 archivos y 552 tests (Supabase local). Cubre: RF-4, RF-7, CA-1
