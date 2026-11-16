# Tasks 030 — Estilo y usabilidad "Nexo" y Venito secretario

> Estado: **cerrada** (2026-11-16).

Nota sobre el método: es un cambio de identidad; los tests que fijaban la anterior se reescribieron junto con el código.

- [x] T1 Enmienda 11, tokens, acentos, Inter y guardias
  Evidencia: sección de identidad de la constitución sustituida y enmienda 11 en su lista. `accents.ts` y `globals.css` con los valores Nexo; cada acento con su segundo tono (`accent-to`), oscurecido lo justo para que el texto cumpla 4,5:1 en los dos extremos (calculado antes y comprobado en `accents.test.ts`); `accent-soft`, `bg-accent-gradient`, sombras teñidas, radios de 20 y 12 px; Inter; icono y `CACHE_NAME` `cafam-v5`. La guardia deja de prohibir las etiquetas en mayúsculas y sigue prohibiendo degradados sueltos. Cubre: RF-1 a RF-4, RNF-1

- [x] T2 Componentes base
  Evidencia: primario con degradado, secundario con borde fino, discreto en el acento; chips suaves; campos de 44 px; aviso oscuro; casillas redondas con "pop" (`check-pop`, sin movimiento con `prefers-reduced-motion`); pesos (`font-bold` → `font-semibold`, 47 cadenas). Tests actualizados: `ui-base`, `comment-form`, `event-block`, `mini-month`, `time-grid`, `surfaces`, `venito`. Cubre: RF-9

- [x] T3 Marco
  Evidencia: `BottomBar` (píldora flotante de cuatro destinos, solo móvil), `CreateButton` ("+" flotante en el móvil y con nombre en la barra superior), `TopNav` (pestañas en píldora desde 769 px), `TopBar` (marca, título, tema y avatar); se retiran `SideRail` y su test. Tests reescritos: `bottom-bar` (con `CreateButton`), `app-frame`, `bar-styles`, `assistant-fab`. Cubre: RF-5, RF-6

- [x] T4 Calendario
  Evidencia: `CalendarHeading` (pestañas de vista, "Calendarios" y "Hoy ‹ ›" dentro del contenido, fija bajo la cabecera al desplazar la agenda) sustituye a `CalendarDock`; `tests/unit/calendar-heading.test.tsx` (6 casos). `NextEventCard` pasa a tarjeta de saludo con degradado; en la agenda del móvil se pinta sobre el primer día desde hoy y es donde aterriza al abrir. El selector de vista de escritorio lleva el degradado. Cubre: RF-7, RF-8

- [x] T5 Venito secretario
  Evidencia: gafas redondas, cuello y corbata; ojos pequeños, sin mofletes, boca recta. `venito.test.tsx` en verde (seis expresiones distintas, solo tokens). Cubre: RF-10

- [x] T6 Capturas, recorrido, medida y cierre
  Evidencia (2026-11-16): 60 capturas en `capturas/` (calendario en mes y agenda, Notas y Ajustes a 390, 768 y 1440 px, claro y oscuro, Violeta y Ámbar; botón de Venito y chat vacío, escribiendo y con respuesta). Recorrido `scripts/e2e-phone.mjs`: 8 de 8. `measure.mjs` (`scripts/perf/results/030.json`): mes 71 ms, semana 121 ms (ahora se desliza sobre la rejilla de horas; con ruido), día 43 ms; 1/0/0 peticiones; chat 164/147 ms; 12 consultas. P8: typecheck sin errores, lint 0 errores y 1 aviso previo, format:check limpio, `npm test` 287 archivos y 2.761 tests, build correcto, `test:db` 49 archivos y 552 tests. Cubre: RF-11, CA-1 a CA-3

## No verificado

- El prototipo no se pudo ver pintado (su CDN de Tailwind está bloqueado en esta sesión): se siguió su código. Puede haber diferencias de espaciado o tamaño.
- iPhone real y Safari.
