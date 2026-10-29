# Tasks 011 - Rediseño visual: modo oscuro, transparencias y movimiento

> Estado: **Aprobadas** por el usuario (2026-10-29).
> Spec: `specs/011-rediseno-visual/spec.md` (aprobada el 2026-10-29). Plan: `specs/011-rediseno-visual/plan.md` (aprobado el 2026-10-29).
> 13 tareas en dos iteraciones: T1–T6 (base: datos, paleta, tokens y arranque del tema) y T7–T13 (interfaz, movimiento y validación). No se empieza la segunda sin cerrar la primera.
> Reglas:
>
> - Una tarea cada vez, con el test primero (rojo → verde).
> - Al cerrar cada tarea se ejecuta y se reporta `npm run typecheck && npm run lint && npm run format:check && npm test && npm run build`. Si toca esquema o datos, también `npm run test:db -- <filtro>` (por tandas si salta el límite de Auth).
> - Si toca interfaz: capturas a 390, 768 y 1440 px **en tema claro y oscuro**, con el acento rojo y el amarillo, y revisión con movimiento reducido (P9, enmienda 3).
> - Un commit por tarea, citándola, en la rama `011-rediseno-visual`. El primer commit lleva `plan.md` y `tasks.md`.
>
> Sin dependencias nuevas (P6): solo CSS y APIs nativas. `ViewTransition` y `addTransitionType` ya están en React 19.3.
> Migraciones: solo nuevas, con `npm run db:push` (dev) y `npm run db:types`. Producción la aplica el usuario (plan, "Pasos fuera del repositorio").

## Tareas

### Iteración 1 — Datos, paleta, tokens y arranque del tema

- [x] T1 Guardar el tema de cada usuario en su perfil
  Pasos:
  - Primero, `tests/integration/profile-theme.test.ts` en rojo. Comprueba:
    - un perfil nuevo tiene `theme = 'system'`;
    - el dueño cambia a `light` y `dark`;
    - un valor inválido da `23514`;
    - otro usuario no lee ni cambia el tema ajeno;
    - `visible_people()` y `calendar_members_with_names` no lo devuelven;
    - `list_tables_without_rls()` sigue vacía.
  - Después, la migración `profile_theme`, según "Modelo de datos".

  Hecho cuando: `npm run test:db -- profile-theme profile-accent` en verde y `src/types/database.ts` con `theme`. Cubre: RF-2, RF-4 | Módulo: theme-schema
  Evidencia (2026-10-29): rojo antes de la migración (`42703`, columna inexistente). Migración `20261029140000_profile_theme.sql` aplicada en dev, tipos regenerados con `theme`. `test:db -- profile-theme profile-accent schema` 6 archivos y 49 tests en verde (la de `schema` cubre `list_tables_without_rls`). typecheck, lint y format en verde, `npm test` 1282 tests, build correcto.

- [x] T2 Escribir la lógica pura del tema y el script de arranque
  Pasos:
  - Primero, `tests/unit/theme.test.ts` en rojo:
    - `parseTheme` acepta `light`, `dark` y `system`, y cualquier otra cosa da `system`;
    - `themeSchema` da su mensaje en español;
    - `effectiveTheme` y `nextToggleTheme` en las cuatro combinaciones.
  - `THEME_SCRIPT` se ejecuta en jsdom:
    - con la cookie `dark`, pone `data-theme="dark"` y el `content` de los `meta theme-color`;
    - con `system` o sin cookie, no pone atributo;
    - con una cookie basura, tampoco, y no lanza;
    - pesa menos de 600 bytes.
  - Después, `src/lib/theme/theme.ts`.

  Hecho cuando: `npm test -- theme` en verde. Cubre: RF-2, RF-6, RF-7, RF-8 | Módulo: theme-core
  Evidencia (2026-10-29): rojo (módulo inexistente). `theme.test.ts` con 10 tests en verde. El oscuro de `THEME_COLOR` es provisional hasta la T3 (comentario `shortcut:`). typecheck, lint y format en verde, `npm test` 148 archivos y 1292 tests, build correcto.

- [x] T3 Definir la paleta oscura con el contraste comprobado, también sobre cristal
  Pasos:
  - Primero, ampliar `tests/unit/accents.test.ts` en rojo, con `contrast.ts`, que se extrae del propio test:
    - en los dos temas: `ink` y `muted` sobre `stone` y `paper` ≥ 4,5:1; `control`, `line` como borde de campo y `danger` ≥ 3:1 donde se usan; `on-ink` sobre `ink` ≥ 4,5:1;
    - en los dos temas, para cada acento: `on-accent` sobre `fill` ≥ 4,5:1; `accent-ink` sobre `stone` y `paper` ≥ 4,5:1; `accent-edge` contra `stone` ≥ 3:1;
    - `pastel-ink` sobre los seis pasteles de la paleta ≥ 4,5:1;
    - cristal (D7): `composite(glass-bg, alfa, fondo)` sobre cada fondo posible da ≥ 4,5:1 con `ink`, `muted` y `accent-ink`.
  - Después, `NEUTRALS` y `ACCENTS` por tema y los tokens nuevos en `accents.ts`, ajustando los valores de partida del plan hasta que pasen.

  Hecho cuando: `npm test -- accents palette` en verde, con los valores finales anotados en `plan.md`. Cubre: RF-9, RF-10, RF-15 | Módulo: palette
  Evidencia (2026-10-29): rojo (falta `contrast.ts`); después 8 fallos reales que obligaron a subir el alfa del cristal a 0,93/0,92 y aclarar el segundo tono del degradado claro. `accents palette theme` 3 archivos y 63 tests en verde. Valores finales en `plan.md`. `THEME_COLOR.dark` ya sale de `DARK_NEUTRALS` (se quita el `shortcut:` de la T2).

- [x] T4 Pasar `globals.css` a tokens por tema, con cristal, fondo, sombras y movimiento
  Pasos:
  - Primero, en rojo, un test que lee `globals.css` (`tests/unit/theme-css.test.ts`) y comprueba:
    - los tres bloques de tema existen y coinciden con `accents.ts` (D2);
    - las utilidades `glass`, `glass-float`, `press` y `bg-backdrop` existen;
    - hay respaldo `@supports not (backdrop-filter…)`;
    - hay un bloque `prefers-reduced-motion: reduce` que anula `motion-distance` y las escalas;
    - ninguna duración pasa de 400 ms;
    - `::view-transition` lleva `pointer-events: none`;
    - las reglas de `dialog` llevan `@starting-style`.
  - Después, `globals.css`. `body` usa `bg-backdrop`.

  Hecho cuando: `npm test -- theme-css accents` en verde y `npm run build` correcto. Cubre: RF-5, RF-9, RF-13, RF-14, RF-20, RF-22, RF-23, RF-24, RF-25 | Módulo: tokens-css
  Evidencia (2026-10-29): rojo (26 fallos). `theme-css accents` 64 tests en verde; las utilidades compiladas con Tailwind. `/login` a 390 px en claro igual que antes y en oscuro por el sistema. typecheck, lint y format en verde, `npm test` 149 archivos y 1332 tests, build correcto.

- [x] T5 Migrar los componentes a tokens válidos en los dos temas y poner al día la guardia de diseño
  Pasos:
  - Primero, `design-tokens.test.ts` con las reglas de D11, en rojo por los `text-white` y los demás usos que hay hoy.
  - Después, los cambios de `token-migration`:
    - `text-white` → `text-on-ink`;
    - el texto y los contornos sobre pastel → `pastel-ink` (revisando los 17 archivos con `style={{ backgroundColor`, R2);
    - el logotipo → `mark`/`on-mark`.
  - Los tests de componentes que miran clases se actualizan.

  Hecho cuando: `npm test` completo en verde (incluida `design-tokens`), y la portada y el calendario en tema claro iguales que antes, comparando capturas a 1440 px. Cubre: RF-10, RF-26 | Módulo: token-migration, design-guard
  Evidencia (2026-10-29): rojo en sombras, `text-white` y `ring-offset` sin color. Además: `backdrop:bg-scrim/…` (token `scrim`, oscuro en los dos temas) en las ventanas y `ring-offset-paper` en el selector de color. Portada y calendario a 1440 px en claro idénticos píxel a píxel antes y después. `npm test` 149 archivos y 1339 tests, build correcto.

- [x] T6 Aplicar el tema guardado sin destello en todas las páginas
  Pasos:
  - Primero, los tests en rojo:
    - `signIn` escribe la cookie con el tema del perfil, y `signOut` y `signUp` la borran (tests de las acciones, con mocks);
    - el proxy borra la cookie en una petición sin sesión y no la toca con sesión (`proxy`/`route-access`);
    - `ThemeSync` corrige el atributo y la cookie cuando el perfil no coincide y no hace nada cuando coincide;
    - el `viewport.themeColor` tiene las dos entradas por `media`.
  - Después, `theme-boot`: el script en `<head>` de `layout.tsx`, `getAppearance` (acento y tema) en el layout del panel y `ThemeSync` en `AppFrame`.

  Hecho cuando: los tests nuevos, `npm test` y `npm run build` en verde, y en `next start` una carga de `/dashboard/calendar` con la cookie `dark` pinta oscuro desde el primer fotograma. Se comprueba con una captura tomada justo tras `domcontentloaded` y con el HTML servido. Cubre: RF-4, RF-7, RF-8, RF-11 | Módulo: theme-boot
  Evidencia (2026-10-29): rojo (9 fallos y `theme-sync` inexistente). `theme-boot` y `theme-sync` en verde; `auth-next-actions` con los mocks nuevos. En `next start`: sin sesión el proxy responde `cafam-theme=; Max-Age=0`; el script va después de los dos `meta theme-color`; tras `signIn` con el perfil en `dark`, la cookie es `dark` (Lax, sin HttpOnly, 365 días) y `/dashboard/calendar` en `domcontentloaded` ya tiene `data-theme=dark`, fondo `#171612` y `theme-color` oscuro. `npm test` 151 archivos y 1353 tests, build correcto.

### Iteración 2 — Interfaz, movimiento y validación

- [x] T7 Elegir el tema en Ajustes y aplicarlo al momento con un fundido
  Pasos:
  - Primero, en rojo:
    - `theme-picker.test.tsx`: tres opciones con etiqueta visible; elegir una llama a `applyTheme` y a `setTheme`; si `setTheme` falla, vuelve al tema anterior y muestra el error;
    - `apply-theme.test.ts`: atributo, `meta`, cookie, `startViewTransition` solo si existe y sin movimiento reducido;
    - el test de `setTheme`: valida, actualiza la fila propia y escribe la cookie, con mensajes en español.
  - Después, `theme-apply`, `theme-picker` y la sección "Tema" en Ajustes.

  Hecho cuando: `npm test -- theme-picker apply-theme settings` en verde, `npm run test:db -- profile-theme` en verde, y en el navegador el cambio se ve sin recargar y "Como el sistema" sigue el cambio de `prefers-color-scheme` emulado. Cubre: RF-1, RF-3, RF-4, RF-5, RF-21 | Módulo: theme-apply, theme-picker
  Evidencia (2026-10-29): rojo (`theme-picker` y `apply-theme` inexistentes, `setTheme` sin exportar). `theme-picker apply-theme settings` 4 archivos y 21 tests en verde; `test:db -- profile-theme` 6 tests en verde. En `next start` (390 px): Oscuro, Como el sistema y Claro cambian el fondo sin recargar; con "Como el sistema" el fondo sigue a `prefers-color-scheme` emulado; tras recargar se conserva. Capturas de Ajustes a 390, 768 y 1440 px en claro y oscuro con el acento rojo y el amarillo.

- [x] T8 Añadir el acceso directo de tema a la barra lateral y a la hoja "Más"
  Pasos:
  - Primero, `theme-toggle.test.tsx` en rojo: nombre accesible "Cambiar a tema oscuro" o "Cambiar a tema claro" según el tema efectivo, que alterna con `nextToggleTheme`. También se amplían `side-rail.test.tsx` y `more-sheet.test.tsx` (el botón está y se usa con el teclado).
  - Después, `ThemeToggle`, los iconos de sol y luna en `icons.tsx` y su sitio en los dos menús.

  Hecho cuando: `npm test -- theme-toggle side-rail more-sheet` en verde. Cubre: RF-6 | Módulo: theme-toggle
  Evidencia (2026-10-29): rojo (`theme-toggle` inexistente; el botón no estaba en la barra ni en la hoja). Las pruebas de la hoja "Más" viven en `bottom-bar.test.tsx`. `theme-toggle side-rail bottom-bar` 19 tests en verde. El botón guarda con `setTheme` como Ajustes (si no, `ThemeSync` lo desharía en la siguiente navegación) y, si falla, vuelve al tema de la cookie y lo avisa. En `next start`: barra lateral a 1440 px (claro → oscuro, se conserva al recargar) y hoja "Más" a 390 px (oscuro → claro). `npm test` 154 archivos y 1374 tests, build correcto.

- [x] T9 Poner las superficies translúcidas en los contenedores principales
  Pasos:
  - Primero, un test en rojo (`glass-surfaces.test.ts`, que lee los archivos de `glass-surfaces`) que comprueba que cada contenedor de RF-12 usa `glass` o `glass-float`, y que `glass-float` solo aparece en lo que flota.
  - Después, el cambio de clases. Revisión en el navegador con Chrome emulando la falta de `backdrop-filter`: la superficie es opaca y se ve igual de color (RF-14).

  Hecho cuando: `npm test -- glass-surfaces design-tokens` en verde, más capturas a 390, 768 y 1440 px en los dos temas de calendario, Ajustes, hoja "Más", ventana de evento y diálogo. Cubre: RF-12, RF-13, RF-14, RF-15 | Módulo: glass-surfaces
  Evidencia (2026-10-29): rojo (12 fallos). `glass` en la barra lateral, la barra inferior, los paneles del calendario (próximo evento, mini mes, filtros) y las secciones de Ajustes; `glass-float` en la hoja "Más", la ventana de evento, la ventana rápida, los diálogos y el aviso (que pasa de tinta a cristal con texto `ink`). `page-shell` no tiene panel propio: no cambia. El build deja `@supports not (backdrop-filter…) { .glass { background-color: var(--paper) } }`; forzando la superficie opaca en Chrome, el color medio cambia menos de 2/255 (RF-14). Capturas a 390, 768 y 1440 px en claro y oscuro de calendario, ventana de evento, diálogo de borrar, hoja "Más" (390 y 768) y Ajustes. `npm test` 155 archivos y 1398 tests, build correcto.

- [x] T10 Añadir las microinteracciones a botones y controles
  Pasos:
  - Primero, en rojo, ampliar los tests de `Button`, `LinkButton` y los estilos de barra: llevan `press`, y los campos llevan la transición del foco.
  - Después, `micro`.

  Hecho cuando: `npm test -- button link-button bar-styles text-field select` en verde, más una comprobación en el navegador de que al pulsar se ve la escala y con movimiento reducido no. Cubre: RF-16 | Módulo: micro
  Evidencia (2026-10-29): rojo (9 fallos; no había tests de `Button` ni de los campos: se crean `button`, `bar-styles` y `text-field`). `press` en `Button`, `LinkButton`, los elementos de la barra inferior y lateral, la barra de vistas y los selectores de acento y tema; `transition-[border-color,box-shadow]` en los cuatro campos. La guardia ya no confunde `box-shadow` dentro de una transición con una sombra (y sigue prohibiendo `drop-shadow-*`). En `next start`, el botón "Entrar": al pasar el puntero `translate 0 -1px` y al pulsar `scale 0.97`; con `reducedMotion: reduce`, `translate 0` y `scale 1`. `npm test` 158 archivos y 1407 tests, build correcto.

- [x] T11 Animar el cambio de vista y de periodo
  Pasos:
  - Primero, en rojo:
    - `transition-types.test.ts`: `periodType(-1)` es `cal-prev`, `periodType(1)` es `cal-next`;
    - `view-toolbar.test.tsx`: los enlaces de vista llevan `cal-view`, y los de anterior, siguiente y hoy el tipo de su sentido;
    - `use-calendar-shortcuts` pasa `transitionTypes` a `router.push`;
    - `calendar-workspace`: el área de la vista va dentro de un `ViewTransition` con `key` de vista y fecha.
  - Después, `view-motion`, sin la parte de filtros, y las reglas CSS de `cal-view`, `cal-next` y `cal-prev`.

  Hecho cuando: los tests nuevos y `npm test` en verde, más una revisión en Chrome:
  - las vistas y los periodos se animan en su sentido;
  - pulsar "siguiente" cinco veces seguidas muestra el periodo final sin acumular;
  - se puede pulsar durante la animación;
  - con movimiento reducido solo hay fundido;
  - en un navegador sin View Transitions (se emula borrando `document.startViewTransition`) todo funciona igual.

  Cubre: RF-17, RF-18, RF-22, RF-23, RF-24, RF-25 | Módulo: view-motion
  Evidencia (2026-10-29): rojo (6 fallos y `transition-types` inexistente). `transition-types view-toolbar use-calendar-shortcuts calendar-workspace` 26 tests en verde; "Hoy" va hacia hoy (`todayType`) y sin tipo si ya está en hoy. En Chrome (`next start`, envolviendo `startViewTransition`): siguiente `[cal-next]` cal-out-start/cal-in-end 220 ms, anterior `[cal-prev]`, vista `[cal-view]` cal-fade-out 150 ms/cal-rise-in 220 ms, y la flecha del teclado lleva su tipo; con movimiento reducido, 150 ms y `--motion-distance: 0` (solo fundido). Cinco "Día siguiente" seguidos acaban en el día 20 sin animaciones vivas; un clic con 5 animaciones en curso navega. Borrando `startViewTransition`: mes siguiente, agenda y → funcionan igual. Los clics antes de que llegue la navegación repiten el mismo destino (el enlace aún no ha cambiado), como antes de la spec. `npm test` 159 archivos y 1416 tests, build correcto.

- [x] T12 Animar los filtros, las ventanas y los avisos
  Pasos:
  - Primero, en rojo:
    - el test de `calendar-workspace`: mostrar u ocultar un calendario, un grupo o una persona actualiza dentro de `startTransition` con el tipo `cal-filter`;
    - el test de `toast`: el aviso pasa por `leaving` antes de quitarse;
    - siguen en verde los tests de `event-modal`, `quick-create`, `confirm-dialog` y `more-sheet` (R3).
  - Después, la parte de filtros de `view-motion` y `overlay-motion`.

  Hecho cuando: `npm test -- calendar-workspace toast event-modal quick-create confirm-dialog more-sheet` en verde, más una revisión en Chrome de que los eventos aparecen y desaparecen con un fundido y de que las ventanas, la hoja y el aviso entran y salen animados (y sin animación con movimiento reducido). Cubre: RF-19, RF-20, RF-22, RF-23 | Módulo: view-motion, overlay-motion
  Evidencia (2026-10-29): rojo (2 fallos: sin `update` de `cal-filter` y sin `data-leaving`). Calendarios, personas y categorías cambian dentro de `startTransition` + `addTransitionType("cal-filter")` (ordenar no se anima). El aviso pasa a `data-leaving` 200 ms antes de quitarse y entra con `@starting-style`. `calendar-workspace toast event-modal quick-create confirm-dialog bottom-bar theme-css` 73 tests en verde (la hoja "Más" vive en `bottom-bar`). En Chrome: el filtro lanza `[cal-filter]` cal-fade-out 150 ms / cal-fade-in 220 ms y el evento desaparece y vuelve; la ventana de evento, el diálogo de borrar, la hoja y el aviso entran con opacity + translate 220 ms; la hoja sale con display/overlay `allow-discrete`; el aviso visible ~3,8 s, sale en 200 ms. Con movimiento reducido: solo opacity 150 ms. `npm test` 159 archivos y 1418 tests, build correcto.

- [ ] T13 Validar el rediseño en todas las pantallas y preparar el paso a producción
  Pasos:
  - Con `npm run build` y `npx next start -p 3100`, capturas a 390, 768 y 1440 px en tema claro y oscuro, con el acento rojo y el amarillo, de todas las pantallas de RF-26:
    - portada, login, registro, recuperación, invitación, sin conexión y `/privacy`;
    - todas las del panel: calendario en las cuatro vistas, Mis calendarios, Ajustes, cuentas conectadas, importar, unirme, compartir, miembros y ventana de evento.
  - Revisión con movimiento reducido.
  - Medida de fps en el calendario con 4× CPU en Chrome (R1).
  - Lighthouse de accesibilidad sin errores de contraste en los dos temas.
  - Usuario de prueba borrado y `.playwright-cli/` eliminada.
  - Entregar al usuario los "Pasos fuera del repositorio" del plan y anotar aquí lo que confirme.

  Hecho cuando: capturas revisadas sin incumplimientos de P9, fps ≥ 60 (o el ajuste de R1 aplicado y anotado), Lighthouse sin errores de contraste, la verificación obligatoria completa en verde con su salida, y el usuario confirma la migración en prod. Cubre: RF-26, requisitos no funcionales | Módulo: validation

  Evidencia (2026-10-29): 186 capturas (`next start -p 3100`): 7 públicas × 2 temas × 3 anchuras y 12 del panel × claro/oscuro × rojo/amarillo × 3 anchuras, revisadas sin incumplimientos de P9. Accesibilidad con axe-core (el motor de Lighthouse), WCAG 2 A y AA, en 62 pantallas a 1440 px: 0 infracciones, contraste incluido. fps con 4× CPU en Chrome (CDP): reposo y desplazamiento de la agenda 144 fps; cambio de periodo y de vista 124–137 fps de media, peor fotograma ~60 ms, igual sin `backdrop-filter` (es el render de la vista, no el desenfoque): R1 sin ajuste. Movimiento reducido revisado en T10–T12. Usuarios de prueba borrados y `.playwright-cli/` eliminada. typecheck, lint y format:check en verde; `npm test` 159 archivos y 1418 tests; build correcto; `test:db` por tandas 329 de 330 (falla solo `invites.test.ts` "returns a 43 character token", el desfase de reloj conocido). Pendiente: confirmación del usuario de la migración `profile_theme` en prod.

## Trazabilidad RF -> Tareas

- RF-1 -> T7
- RF-2 -> T1, T2
- RF-3 -> T7
- RF-4 -> T1, T6, T7
- RF-5 -> T4, T7
- RF-6 -> T2, T8
- RF-7 -> T2, T6
- RF-8 -> T2, T6
- RF-9 -> T3, T4
- RF-10 -> T3, T5
- RF-11 -> T6
- RF-12 -> T9
- RF-13 -> T4, T9
- RF-14 -> T4, T9
- RF-15 -> T3, T9
- RF-16 -> T10
- RF-17 -> T11
- RF-18 -> T11
- RF-19 -> T12
- RF-20 -> T4, T12
- RF-21 -> T7
- RF-22 -> T4, T11, T12
- RF-23 -> T4, T11, T12
- RF-24 -> T4, T11
- RF-25 -> T4, T11
- RF-26 -> T5, T13

## Módulos -> Tareas

- theme-schema -> T1
- theme-core -> T2
- palette -> T3
- tokens-css -> T4
- token-migration, design-guard -> T5
- theme-boot -> T6
- theme-apply, theme-picker -> T7
- theme-toggle -> T8
- glass-surfaces -> T9
- micro -> T10
- view-motion -> T11, T12
- overlay-motion -> T12
- validation -> T13

## Dudas abiertas

- Ninguna. La D4 quedó aprobada con el plan el 2026-10-29.
