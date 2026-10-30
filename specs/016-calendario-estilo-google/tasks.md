# Tasks 016 - Calendario al estilo Google Calendar en el móvil

> Estado: **Aprobadas** por el usuario (2026-10-30).
> Spec: `specs/016-calendario-estilo-google/spec.md` (aprobada el 2026-10-30). Plan: `specs/016-calendario-estilo-google/plan.md` (aprobado el 2026-10-30).
> 13 tareas en dos iteraciones. La primera (T1–T6) cubre la lógica pura, los bloques y el marco del móvil; la segunda (T7–T13), las cuatro vistas y la validación. No se empieza la segunda sin cerrar la primera.
>
> Reglas:
>
> - Una tarea cada vez, con el test primero (rojo → verde).
> - Al cerrar cada tarea se ejecuta y se reporta `npm run typecheck && npm run lint && npm run format:check && npm test && npm run build`. `test:db` no hace falta: no se toca el esquema, y `loadAgendaEvents` lee con la función existente `getEventsInRange`.
> - Toda tarea toca interfaz, así que lleva capturas a 390, 768 y 1440 px en tema claro y oscuro, con el acento rojo y el amarillo, y revisión con movimiento reducido (P9).
> - Un commit por tarea, citándola, en la rama `016-calendario-estilo-google`. El primer commit lleva `plan.md` y `tasks.md`.
> - Sin dependencias nuevas (P6) ni migraciones.

## Tareas

### Iteración 1 — Lógica pura, bloques y marco del móvil

- [x] T1 Crear la lógica pura de carriles del mes, deslizar y fila de meses
  Pasos:
  - Primero, los tests en rojo:
    - `tests/unit/month-lanes.test.ts`: un evento de varios días ocupa un carril con su `span`; uno que cruza dos semanas aparece en cada una; los solapados van a carriles distintos; `fitWeek` con `maxLanes` deja `maxLanes - 1` y "+N" en el día que no cabe; un día sin desbordar no lleva "+N".
    - `tests/unit/swipe.test.ts`: con ≥ 50 px horizontales da `next` o `previous`; con menos de 50 px, o más vertical que horizontal, da `null`.
    - `tests/unit/month-strip.test.ts`: los meses van en orden, con el año entre diciembre y enero, y el mes visible marcado.
  - Después, `month-lanes.ts`, `swipe.ts` y `month-strip.ts`.
  Hecho cuando: `npm test -- month-lanes swipe month-strip` en verde y la verificación completa reportada.
  Cubre: RF-21, RF-27, RF-34, RF-35, RF-36 | Módulo: month-lanes, swipe, month-strip

- [x] T2 Crear el feed puro de la agenda
  Pasos:
  - Primero, `tests/unit/agenda-feed.test.ts` en rojo. Comprueba:
    - banda al empezar cada mes;
    - separador de semana con "2–8 de noviembre" y con el intervalo entre dos meses;
    - semana sin eventos con `empty`;
    - solo los días con eventos;
    - la línea "A las 11:15–14:15 en <lugar>" o "11:15–14:15", y nada en los de día completo;
    - `isToday`;
    - `anchorDay` da hoy o el primer día posterior con eventos;
    - un evento que cruza la medianoche aparece en los dos días.
  - Después, `agenda-feed.ts`, que sustituye a `agenda.ts`. Su test viejo se adapta o se borra.
  Hecho cuando: `npm test -- agenda-feed` en verde y la verificación completa reportada.
  Cubre: RF-47, RF-51, RF-52, RF-53, RF-54, RF-55, RF-57, RF-58 | Módulo: agenda-feed

- [x] T3 Crear `EventBlock` y comprobar el contraste de la paleta en los dos temas
  Pasos:
  - Primero, los tests en rojo:
    - `tests/unit/event-block.test.tsx`: las formas `line`, `grid` y `card`; el color de fondo es el del evento; título en negrita; lugar debajo en `grid` y `card`; `ImageMark` con su texto oculto; enlace al detalle.
    - `palette.test.ts`: ≥ 4,5:1 entre `pastel-ink` y cada color pastel en claro y en oscuro.
  - Después, `event-block.tsx` y `location` en `CalendarEventItem`.
  Hecho cuando: `npm test -- event-block palette` en verde y la verificación completa reportada.
  Cubre: RF-1, RF-2, RF-3, RF-4, RF-5, RF-56 | Módulo: event-block, palette-contrast

- [x] T4 Añadir la variante `tab`, el contexto de la cabecera y `useIsPhone`
  Pasos:
  - Primero, los tests en rojo:
    - `tests/unit/calendar-header.test.tsx`: un consumidor ve el título y el `onToday` publicados; al desmontar el publicador vuelven a `null`.
    - `tests/unit/use-is-phone.test.ts`: con `matchMedia` simulado, `true` a 768 px y `false` a 769 px.
  - Después, `--breakpoint-tab` en `globals.css`, `calendar-header.tsx` y `use-is-phone.ts`.
  Hecho cuando: `npm test -- calendar-header use-is-phone` en verde y la verificación completa reportada.
  Cubre: RF-8, RF-13, RF-59 | Módulo: breakpoints, header-context, use-is-phone

- [ ] T5 Montar la cabecera y el cajón del móvil en el marco
  Pasos:
  - Primero, los tests en rojo:
    - `tests/unit/top-bar.test.tsx`: ≡, título de la sección fuera del calendario, avatar con iniciales que enlaza a Ajustes, "Hoy" con el número del día solo en el calendario.
    - `tests/unit/nav-drawer.test.tsx`: abre con ≡; tiene vistas (solo en el calendario), destinos, tema y Cerrar sesión; elegir un destino lo cierra; Escape y el fondo lo cierran; el foco vuelve a ≡.
    - `app-frame.test.tsx`: la barra inferior lleva `hidden tab:block lg:hidden`.
  - Después:
    - `top-bar.tsx`, `nav-drawer.tsx` y su `@starting-style`;
    - `getAppearance` con `display_name`;
    - `AppFrame` y `BottomBar`;
    - `nav-drawer.tsx` en `FLOATING` de la guardia de diseño.
  Hecho cuando: `npm test -- top-bar nav-drawer app-frame design-tokens` en verde, la verificación completa reportada y capturas de Ajustes y "Mis calendarios" a 390 px con la cabecera y el cajón abierto.
  Cubre: RF-6, RF-7, RF-9, RF-11, RF-12, RF-14, RF-15, RF-16, RF-61 | Módulo: top-bar, nav-drawer, app-frame, design-guard

- [ ] T6 Conectar el calendario a la cabecera: título, Hoy, selector, filtros en el cajón, deslizar y "+"
  Pasos:
  - Primero, los tests en rojo:
    - `calendar-workspace.test.tsx`: publica el título del mes; en `phone` los filtros aparecen dentro del cajón (portal) y no en el panel; "Hoy" navega a la fecha de hoy; con `canCreate` hay "+" y sin él no.
    - `month-strip.test.tsx`: pulsar un mes navega.
    - `use-swipe.test.ts`: un `pointerup` táctil a 80 px llama a `next`; no hace nada con un `dialog[open]`; no hace nada con el ratón.
  - Después:
    - `fab.tsx` (y en `FLOATING`);
    - `use-swipe.ts`, `month-strip.tsx` y el selector bajo la cabecera;
    - en el workspace, el portal (solo mientras la ruta es el calendario, plan D15) y ocultar en `phone` la barra de herramientas, "Nuevo evento", "Próximo evento", el botón de filtros y el panel;
    - en el cajón, la ranura.
  Hecho cuando: `npm test -- calendar-workspace month-strip use-swipe` en verde, la verificación completa reportada y una prueba en `playwright-cli` con emulación de iPhone: deslizar cambia de mes; el cajón muestra los filtros, y en Ajustes no.
  Cubre: RF-10, RF-13, RF-17, RF-18, RF-19, RF-20, RF-22, RF-23, RF-24, RF-25, RF-26, RF-28, RF-29 | Módulo: fab, swipe, month-strip, title-picker, workspace, nav-drawer

### Iteración 2 — Vistas y validación

- [ ] T7 Rehacer la vista mes con carriles a toda la altura y "+N"
  Pasos:
  - Primero, `month-view.test.tsx` en rojo. Comprueba:
    - iniciales arriba, con la de hoy en el acento;
    - número de hoy en un círculo;
    - días de otro mes en gris;
    - un evento de tres días es un solo bloque con `grid-column` de 3;
    - con `ResizeObserver` simulado y 2 carriles, el día con 4 eventos muestra 1 y "+3", que enlaza a la vista día;
    - el botón de crear de cada día sigue estando.
  - Después, `month-view.tsx` y su esqueleto.
  Hecho cuando: `npm test -- month-view` en verde, la verificación completa reportada y capturas de la vista mes junto a `IMG_1843`.
  Cubre: RF-30, RF-31, RF-32, RF-33, RF-34, RF-35, RF-36, RF-37, RF-46 | Módulo: month-view, skeleton

- [ ] T8 Rehacer semana y día: cabecera fija, bloques rellenos y línea de ahora
  Pasos:
  - Primero, `time-grid.test.tsx` en rojo. Comprueba:
    - cabecera con inicial y número, y hoy en círculo;
    - franja de día completo con bloques `line`;
    - bloque con título y lugar;
    - horas "9:00";
    - línea de ahora con su punto solo en hoy;
    - desplazamiento inicial a la hora actual con hoy visible y a las 7:00 si no;
    - en `phone`, sin `min-width`;
    - `SlotLayer` y el borrador siguen.
  - Después, `time-grid.tsx`, `day-view.tsx` y `scroll-on-mount.tsx`.
  Hecho cuando: `npm test -- time-grid` en verde, la verificación completa reportada y capturas de semana y día junto a `IMG_1844` e `IMG_1845`.
  Cubre: RF-38, RF-39, RF-40, RF-41, RF-42, RF-43, RF-44, RF-45, RF-46 | Módulo: time-grid

- [ ] T9 Añadir la carga de tramos de la agenda
  Pasos:
  - Primero, `tests/unit/agenda-actions.test.ts` (`// @vitest-environment node`, Supabase simulado) en rojo. Comprueba: fechas no válidas, `to < from` y más de 62 días dan error; un tramo válido devuelve los eventos con color y nombre de calendario; un fallo de la base de datos da el mensaje de conexión.
  - Después, `agenda-actions.ts` y `to-view-events.ts`, que se saca de `page.tsx`.
  Hecho cuando: `npm test -- agenda-actions` en verde y la verificación completa reportada.
  Cubre: RF-48, RF-49 | Módulo: agenda-loader

- [ ] T10 Rehacer la agenda como lista continua con bandas de mes
  Pasos:
  - Primero, `agenda-view.test.tsx` en rojo, con `IntersectionObserver` simulado. Comprueba:
    - banda del mes;
    - separador de semana;
    - columna de día con hoy en círculo;
    - bloques `card`;
    - "Sin eventos" en una semana vacía;
    - el centinela inferior pide el tramo siguiente y lo añade;
    - el superior pide el anterior;
    - con más de 120 días se sueltan los del otro extremo;
    - el mes de arriba llega a `onMonthChange`;
    - `scrollToAnchor` lleva a hoy o al siguiente día con eventos;
    - el filtro de visibilidad se aplica también a lo cargado.
  - Después:
    - `agenda-view.tsx`;
    - el token `--gradient-agenda-band` y su utilidad;
    - en `ViewToolbar`, quitar anterior y siguiente en la agenda;
    - el esqueleto de la agenda.
  Hecho cuando: `npm test -- agenda-view view-toolbar design-tokens` en verde, la verificación completa reportada y capturas de la agenda junto a `IMG_1846`, en el móvil y a 1440 px.
  Cubre: RF-47, RF-48, RF-49, RF-50, RF-51, RF-52, RF-53, RF-57, RF-58, RF-59, RF-60 | Módulo: agenda-view, view-toolbar, skeleton, design-guard

- [ ] T11 Retirar `EventChip` y `EventRow` y comprobar que no cambia lo que debe seguir igual
  Pasos:
  - Borrar `event-chip.tsx` y `event-row.tsx` y llevar `ImageMark` a `event-block.tsx`.
  - Comprobar que siguen en verde, sin tocar su lógica, los tests de atajos, ventana de evento, ventana rápida, vista recordada, filtros, grupos y solo lectura.
  Hecho cuando: `grep -r "event-chip\|event-row" src tests` sin resultados, `npm test` completo en verde y la verificación completa reportada.
  Cubre: RF-1, RF-62 | Módulo: event-chip (retirada), workspace

- [ ] T12 Revisar la identidad visual en todas las anchuras, temas y acentos
  Pasos:
  - Hacer capturas a 390, 768, 769, 1024 y 1440 px de las cuatro vistas, del cajón y del selector, en claro y oscuro, con el acento rojo y el amarillo, y con movimiento reducido.
  - Guardarlas en `specs/016-calendario-estilo-google/evidencias/` y revisarlas contra la sección de identidad visual (enmienda 4) y contra las capturas de Google.
  - Corregir lo que salga, con su test si cambia la lógica.
  Hecho cuando: capturas guardadas, lista de revisión sin pendientes en este archivo y la verificación completa reportada.
  Cubre: RF-63, RF-61 | Módulo: validation, design-guard

- [ ] T13 Validar la spec RF por RF en un iPhone real y en el escritorio
  Pasos:
  - Rellenar la tabla de trazabilidad con la evidencia de cada RF (test o prueba manual).
  - Probar en un iPhone real (despliegue de la rama en una preview de Vercel):
    - deslizar en mes, semana y día;
    - el gesto del borde de iOS;
    - el cajón;
    - el selector del título;
    - la agenda continua hacia los dos lados, sin saltos;
    - el botón "+";
    - girar el móvil.
  - Probar en el escritorio que el marco, los atajos y las ventanas no cambian.
  - Actualizar `AGENTS.md` (estado, "Añadido por la spec 016", estructura, patrones y trampas nuevas).
  Hecho cuando: tabla de trazabilidad completa, `AGENTS.md` actualizado, verificación completa reportada y aprobación del usuario para cerrar la spec.
  Cubre: todos | Módulo: validation

## Trazabilidad RF → tareas

| RF | Tareas | RF | Tareas | RF | Tareas |
|----|--------|----|--------|----|--------|
| RF-1 | T3, T11 | RF-22 | T6 | RF-43 | T8 |
| RF-2 | T3 | RF-23 | T6 | RF-44 | T8 |
| RF-3 | T3 | RF-24 | T6 | RF-45 | T8 |
| RF-4 | T3 | RF-25 | T6 | RF-46 | T7, T8 |
| RF-5 | T3 | RF-26 | T6 | RF-47 | T2, T10 |
| RF-6 | T5 | RF-27 | T1 | RF-48 | T9, T10 |
| RF-7 | T5 | RF-28 | T6 | RF-49 | T9, T10 |
| RF-8 | T4, T6 | RF-29 | T6 | RF-50 | T10 |
| RF-9 | T5 | RF-30 | T7 | RF-51 | T2, T10 |
| RF-10 | T6 | RF-31 | T7 | RF-52 | T2, T10 |
| RF-11 | T5 | RF-32 | T7 | RF-53 | T2, T10 |
| RF-12 | T5 | RF-33 | T7 | RF-54 | T2, T3 |
| RF-13 | T4, T6 | RF-34 | T1, T7 | RF-55 | T2, T3 |
| RF-14 | T5 | RF-35 | T1, T7 | RF-56 | T3 |
| RF-15 | T5 | RF-36 | T1, T7 | RF-57 | T2, T10 |
| RF-16 | T5 | RF-37 | T7 | RF-58 | T2, T10 |
| RF-17 | T6 | RF-38 | T8 | RF-59 | T4, T10 |
| RF-18 | T6 | RF-39 | T8 | RF-60 | T10 |
| RF-19 | T6 | RF-40 | T8 | RF-61 | T5, T12 |
| RF-20 | T6 | RF-41 | T3, T8 | RF-62 | T11 |
| RF-21 | T1 | RF-42 | T3, T8 | RF-63 | T12 |

Todas las tareas se validan además en T13.

## Dudas abiertas

- Ninguna bloqueante.
