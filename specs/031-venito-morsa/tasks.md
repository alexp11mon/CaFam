# Tareas 031 — Venito morsa

- [x] T1 Test primero (`tests/unit/venito.test.tsx`): morsa con gafas, colmillos y bigotes; sin cuello; `compact` sin bigotes y con trazo más grueso; tokens `walrus-*` en claro y oscuro iguales a `VENITO`. Después el dibujo, los tokens, los usos en pequeño (botón flotante y chat), la constitución (enmienda 12) y `AGENTS.md`.
  - Rojo: 5 tests fallaban antes del dibujo. Verde: 13/13.
  - P8: `typecheck` sin errores; `lint` 0 errores (1 aviso anterior); `format:check` correcto; `npm test` 287 ficheros y 2.763 tests; `build` correcto. Sin `test:db`: no toca esquema ni datos.
  - Capturas en `capturas/` (botón flotante y chat a 390 px en claro y oscuro y a 1440 px), contra el Supabase local. Sin prueba en un iPhone real.
