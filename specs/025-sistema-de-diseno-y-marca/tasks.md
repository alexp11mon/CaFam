# Tasks 025 — Sistema de diseño y marca "Orilla"

Spec y plan aprobados de antemano por el usuario en el prompt de arranque (2026-11-15).

> Estado: **cerrada** (2026-11-15).

## Tareas

Nota sobre el método: en esta spec el cambio es sobre todo de valores, clases y estructura; los tests que fijaban la identidad anterior se reescribieron junto con el código (no hay un "rojo" previo que enseñar salvo donde se indica).

- [x] T1 Enmienda 10 de la constitución
  Evidencia (2026-11-15): sección "Identidad visual y diseño de interfaz" sustituida entera y enmienda 10 en la lista final de `docs/constitution.md`. Cubre: RF-1

- [x] T2 Tokens, acentos y guardias
  Evidencia (2026-11-15): `accents.ts` y `globals.css` con los valores Orilla (contraste comprobado antes con un cálculo aparte: tinta 14,5:1 y 16,2:1; `muted` 5,7:1 y 6,4:1; Coral 4,6:1 con blanco). 29 usos de cristal pasan a `surface`/`surface-float` y no queda ningún `backdrop-filter`. Radios como tokens (`rounded-card`, `rounded-control`, `rounded-block`; 48 + 54 + 10 sustituciones con un script revisado). Tests reescritos a conciencia: `accents.test.ts` (nombres nuevos; se retira la prueba del cristal porque ya no hay cristal y se añade la de la ficha de marca), `theme-css.test.ts` (elevaciones iguales a `accents.ts`, sin `backdrop-filter`, fondo plano, radios), `design-tokens.test.ts` (prohíbe además desenfoques, las utilidades de cristal y cualquier radio que no sea de los cuatro), `surfaces.test.ts` (antes `glass-surfaces`), `accent-picker.test.tsx` y `manifest.test.ts`. Cubre: RF-2, RF-3, RF-4, RF-9, RF-10, RNF-1

- [x] T3 Tipografía Figtree
  Evidencia (2026-11-15): `layout.tsx` carga Figtree con `next/font`; comprobado en el archivo de la fuente que tiene `tnum` (con `fontTools`, fuera del repositorio). `theme-boot.test.ts` actualizado. Cubre: RF-5

- [x] T4 Componentes base
  Evidencia (2026-11-15): `button-styles.ts` (primario en acento, secundario, discreto y peligro; 48 px, radio de control), `IconButton`, `Card`, `Chip`, `EmptyState` y `Sheet`; campos de 48 px y 16 px de texto. `tests/unit/ui-base.test.tsx`, 11 casos (el `Sheet` se cierra con su botón, el fondo y Escape, y nunca queda abierto al desmontarse). `Switch`, `FormAlert` y `TextArea` conservan su comportamiento y toman los tokens nuevos. Cubre: RF-6, RNF-2

- [x] T5 Marca e iconos
  Evidencia (2026-11-15): `public/icons/icon.svg` (ficha coral, "C" blanca abierta y punto de hoy), `scripts/make-icons.mjs` genera los cuatro PNG con Chromium, `LogoMark` y `Logo` nuevos, `CACHE_NAME` `cafam-v4`. `brand-icons.test.ts` y `manifest.test.ts` en verde. Cubre: RF-7

- [x] T6 Marco de navegación
  Evidencia (2026-11-15): `BottomBar` (Calendario, Notas, "+", Calendarios, Más; hasta 1023 px), `TopBar` sin menú, `CalendarSheet` (vistas y filtros del calendario en una hoja inferior desde la cabecera), `SideRail` con nombres desde 1280 px, `createHref` (qué crea "+"), pantalla provisional de Notas. Se retiran `NavDrawer` y `Fab` con sus tests. Tests reescritos: `bottom-bar` (12), `nav` (con `createHref`), `top-bar`, `app-frame`, `side-rail`, `assistant-fab`, `bar-styles` y tres casos de `calendar-workspace`. Cubre: RF-8, RF-11

- [x] T7 Capturas, medida y cierre
  Evidencia (2026-11-15): 24 capturas en `specs/025-sistema-de-diseno-y-marca/capturas/` (calendario en mes y Ajustes, a 390, 768 y 1440 px, claro y oscuro, Coral y Sol; a escala 1 para no engordar el repositorio). `measure.mjs` (`scripts/perf/results/025.json`): mes 106 ms, semana 71 ms, día 42 ms, 1/0/0 peticiones, chat 212/145 ms, 12 consultas: sin regresión frente a la 024. P8: typecheck sin errores, lint 0 errores y 1 aviso previo, format:check limpio, `npm test` 281 archivos y 2.690 tests, build correcto. Sin `test:db`: la spec no toca datos. Cubre: CA-1, CA-2, CA-3

## Trazabilidad RF → Tareas

| RF | Tarea |
|----|-------|
| RF-1 | T1 |
| RF-2, RF-3, RF-4, RF-9, RF-10 | T2 |
| RF-5 | T3 |
| RF-6 | T4 |
| RF-7 | T5 |
| RF-8 | T6 |
| RF-11 | T2 a T6 |
