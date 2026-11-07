# Tasks 021 - Animaciones y microinteracciones

> Estado: **aprobadas** (2026-11-07).
> Spec: `specs/021-animaciones-y-microinteracciones/spec.md` (aprobada el 2026-11-07). Plan: `specs/021-animaciones-y-microinteracciones/plan.md` (aprobado el 2026-11-07).
> 19 tareas en dos iteraciones:
>
> - Iteración 1 (T1–T12): base y controles. Tokens y guardia (T1), funciones puras (T2), ayudas del navegador (T3), utilidades de CSS y ventanas (T4), desplegables (T5), listas (T6), interruptor (T7), estados que se solapan (T8–T9), selector de vista (T10), revelados (T11) y pulso (T12).
> - Iteración 2 (T13–T19): el calendario y los gestos. Regreso en arco (T13), evento → detalle (T14–T15), seguir al dedo (T16–T17), goma en la hoja, el pellizco y el borde de un evento (T18) y validación (T19).
>
> Reglas:
>
> - Una tarea cada vez, con el test primero (rojo → verde).
> - Al cerrar cada tarea se ejecuta y se reporta `npm run typecheck && npm run lint && npm run format:check && npm test && npm run build`. Esta spec no toca esquema, RLS ni datos, así que no hace falta `test:db`.
> - Toda tarea que toca interfaz:
>   - capturas a 390, 768 y 1440 px en tema claro y oscuro, con el acento rojo y el amarillo;
>   - revisión con `prefers-reduced-motion: reduce` (P9);
>   - prueba con el ratón, con el teclado y con emulación táctil en `playwright-cli`.
> - Un commit por tarea, citándola, en la rama `021-animaciones-y-microinteracciones`.
>
> Sin dependencias nuevas (P6) y sin migraciones. jsdom no tiene `element.animate` ni View Transitions: los tests comprueban estados, atributos y estilos, no fotogramas (plan R5).

## Tareas

### Iteración 1

- [x] T1 Definir los tokens de movimiento y ampliar la guardia de diseño
  Pasos:
  - Primero, en rojo:
    - `tests/unit/motion-tokens.test.ts` lee `globals.css` y comprueba:
      - existen `--ease-out`, `--ease-in-out` y los pares `--motion-{pop,dialog,base,fast}-{in,out}`;
      - cada `-out` es el 80 % ±10 ms de su `-in`;
      - ningún token de duración pasa de 400 ms;
      - `7 × --stagger-step + --motion-row ≤ 400 ms`;
      - el bloque de `prefers-reduced-motion` pone `--pop-scale`, `--pulse-scale`, `--knob-stretch` y `--swap-scale` a 1, y `--stagger-step`, `--settle-delay`, `--swap-blur` y `--arc-max` a 0.
    - `design-tokens.test.ts` añade tres reglas: ninguna `cubic-bezier` con `y` fuera de [0, 1], ningún `ease-[…]` suelto y ningún `duration-<número>` en las clases.
  - Después, los tokens de la tabla del plan en `:root` y su versión reducida. `--motion-ease` pasa a `--ease-out` o `--ease-in-out` en todos sus usos (vistas, diálogos, avisos, `press`), y se quitan los `duration-<número>` que haya en `src/`.

  Hecho cuando: `npm test -- motion-tokens design-tokens` en verde y `grep -rn "motion-ease" src` sin resultados. Cubre: RF-1, RF-2, RF-3, RF-4, RF-5, RF-66 | Módulo: motion-tokens, design-guard

- [x] T2 Calcular el origen, la goma, la decisión al soltar y el arco
  Pasos:
  - Primero, en rojo, `tests/unit/motion-origin.test.ts`, `rubber-band.test.ts`, `release.test.ts` y `flight.test.ts`:
    - `originFrom`: un disparador encima, debajo, a un lado y dentro del panel, y un punto (el puntero); el resultado siempre cae dentro del panel.
    - `rubberBand`: 0 sin exceso, siempre creciente, siempre menor que 64 y con pendiente decreciente. `banded` deja igual lo que está dentro del intervalo.
    - `releaseDecision`: umbral de distancia en los dos sentidos, velocidad de 0,5 px/ms por debajo del umbral y `stay`. `lockAxis`: `null` antes de 10 px, `"x"` u `"y"` según domine. `trackVelocity`: solo cuenta las muestras de los últimos 100 ms.
    - `flightKeyframes`: el primer fotograma es el desplazamiento y el último 0; con 48 px o más, la separación de la recta llega a 32 px como mucho; por debajo de 48 px, recta.
  - Después, `src/lib/motion/origin.ts`, `rubber-band.ts`, `release.ts` y `flight.ts` con los contratos del plan.

  Hecho cuando: `npm test -- motion-origin rubber-band release flight` en verde. Cubre: RF-8, RF-10, RF-20, RF-21, RF-22, RF-25, RF-27, RF-28, RF-29, RF-32, RF-33 | Módulo: motion-origin, motion-band, motion-release, motion-flight

- [x] T3 Crear `play`, `pulse`, `usePresence` y `useEnterOnce`
  Pasos:
  - Primero, en rojo:
    - `tests/unit/play.test.ts`: con `animate` simulado, `play` fija y cancela la animación anterior antes de empezar otra; sin `animate`, o con movimiento reducido, aplica el último fotograma y devuelve `null`; `pulse` no hace nada con movimiento reducido.
    - `use-presence.test.tsx`: al cerrar sigue montado con `leaving` hasta `exitMs`; si se vuelve a abrir mientras sale, cancela la salida.
    - `use-enter-once.test.tsx`: `data-entering` al montar y fuera a los 400 ms; ocultar y volver a mostrar no lo pone otra vez.
  - Después, `src/lib/motion/play.ts`, `src/lib/hooks/use-presence.ts` y `src/lib/hooks/use-enter-once.ts`.

  Hecho cuando: `npm test -- play use-presence use-enter-once` en verde. Cubre: RF-47, RF-49, RF-63, RF-64, RF-65, RF-66, RF-67 | Módulo: motion-play, use-presence, use-enter-once

- [x] T4 Añadir las utilidades de CSS, la entrada de ventanas y hojas y la respuesta al pulsar
  Pasos:
  - Primero, en rojo:
    - `tests/unit/motion-utilities.test.ts` lee `globals.css`:
      - existen `pop`, `stagger` (retrasos de `nth-child` del 2 al 8 y el resto igual al octavo, solo bajo `[data-entering]`), `settle`, `press-quiet`, `swap` y `reveal-down`;
      - `dialog` entra con `--pop-scale` y `--motion-dialog-in` y sale con `-out`;
      - `[data-sheet]` y la hoja "Más" entran desde abajo, `[data-drawer]` desde la izquierda y `[data-morph]` no tiene transición.
    - `tests/unit/press-coverage.test.tsx` comprueba en el DOM:
      - `press-quiet` en las filas del menú contextual, de la hoja "Más" y del cajón, en las opciones de la lista de horas, en los días del mini calendario y de la fila de meses y en los avatares de los filtros;
      - `EventBlock` sin `press` ni `press-quiet`.
  - Después, las utilidades, los cambios de `dialog` y `press-quiet` en esos componentes.

  Hecho cuando: `npm test -- motion-utilities press-coverage` en verde y capturas de abrir y cerrar una ventana centrada, la hoja "Más" y el cajón revisadas en los dos temas. Cubre: RF-6, RF-7, RF-11, RF-12, RF-13, RF-14, RF-15, RF-68 | Módulo: motion-utilities, dialogs, press-coverage

- [x] T5 Hacer que los desplegables nazcan del disparador y vuelvan a él
  Pasos:
  - Primero, en rojo, tests de componentes:
    - `event-menu`: con ratón, `--pop-origin` en el puntero; con teclado, en el evento enfocado. Al cerrar queda `data-leaving` y se desmonta tras la salida. Abrir y cerrar tres veces seguidas deja un solo menú.
    - `time-field`: la lista lleva `pop` y su origen en el campo.
    - Selector de fecha flotante: origen en "Elegir fecha" y salida con `data-leaving`.
    - `quick-create` en el ordenador: origen en el hueco.
    - Tooltip de la barra lateral: `pop` con origen en su icono.
  - Después, el cableado de `pop`, `originFrom` y `usePresence` en esos componentes.

  Hecho cuando: `npm test -- event-menu time-field calendar-workspace quick-create side-rail` en verde y una prueba en `playwright-cli` en la que cada desplegable crece desde su disparador y vuelve a él. Cubre: RF-6, RF-7, RF-8, RF-9, RF-10, RF-65 | Módulo: popovers

- [x] T6 Escalonar las listas y retrasar los detalles secundarios
  Pasos:
  - Primero, en rojo:
    - `calendar-list`, `member-list`, `connection-list`, `calendar-picker`, `event-comments` y `cited-events` llevan `stagger` y `data-entering` al montarse.
    - En `event-comments`, los comentarios que trae el sondeo y los de "Ver anteriores" llevan `row-in` y los que ya estaban no.
    - El menú contextual, la lista de horas, el cajón y la hoja "Más" llevan `stagger`.
    - Ninguna vista del calendario lleva `stagger`.
    - `settle` en el "Deshacer" del aviso, en los botones de la ventana rápida, en la fila de acciones de la tarjeta de detalle y en los eventos citados.
  - Después, las clases y `useEnterOnce` en esos componentes.

  Hecho cuando: `npm test -- calendar-list member-list connection-list calendar-picker event-comments cited-events toast event-card quick-create` en verde. Cubre: RF-16, RF-17, RF-18, RF-19 | Módulo: lists, settle-details

- [x] T7 Crear el interruptor y usarlo en Ajustes
  Pasos:
  - Primero, en rojo:
    - `tests/unit/switch.test.tsx`: `role="switch"` con su nombre y `aria-checked`; Espacio e Intro lo cambian; deshabilitado no cambia; objetivo de 44 px (`min-h-11` en la fila).
    - Si la acción falla, vuelve al estado anterior y muestra el error.
    - El contraste del carril y de la bolita es de al menos 3:1 en los dos estados y temas, con `contrast.ts`.
    - `view-options-setting` y `availability-setting` usan el interruptor y sus tests actuales siguen en verde, cambiando la casilla por el interruptor.
  - Después, `src/components/ui/switch.tsx`, con la bolita en `translate` y `--ease-in-out` y la animación `knob-stretch` (1,12 × 0,893), y su uso en los dos ajustes.

  Hecho cuando: `npm test -- switch view-options-setting availability-setting` en verde y una prueba en `playwright-cli` en la que pulsar a mitad de viaje invierte la bolita desde donde está. Cubre: RF-40, RF-41, RF-42, RF-43, RF-44, RF-45, RF-46 | Módulo: switch, settings-switches

- [x] T8 Cambiar los textos pendientes de los botones sin que cambien de tamaño
  Pasos:
  - Primero, en rojo:
    - `tests/unit/swap-label.test.tsx`: los dos textos en la misma celda; el oculto con `aria-hidden`; el nombre accesible del botón es el visible.
  - Después:
    - `src/components/ui/swap-label.tsx`;
    - sustituir en los 21 archivos cada `{pending ? "…" : "…"}` de un botón (la lista sale de `grep -rnE '\{(pending|isPending|saving|busy|loading)[A-Za-z]* \? "' src`).
    - Los tests que buscan esos botones por su nombre siguen en verde sin tocarlos (plan R7).

  Hecho cuando: `npm test` completo en verde y el `grep` anterior sin resultados en botones. Cubre: RF-52, RF-53, RF-68 | Módulo: swap-label, state-overlap

- [ ] T9 Solapar iconos, el título de la cabecera, los avisos y el paso a edición
  Pasos:
  - Primero, en rojo:
    - `icon-swap.test.tsx`: los dos iconos apilados y solo el visible para lectores de pantalla.
    - `crossfade-text.test.tsx`: al cambiar el texto, el anterior queda en una capa `data-leaving` hasta que acaba y después se quita.
    - `toast`: un aviso nuevo con otro en pantalla deja el anterior con `data-leaving` a la vez que entra el nuevo.
    - `theme-toggle` usa `IconSwap`; `top-bar` usa `CrossfadeText`.
    - `event-panel` pasa a edición dentro de `startTransition`.
  - Después:
    - los componentes `src/components/ui/icon-swap.tsx` y `crossfade-text.tsx`;
    - el aviso anterior como capa en `toast.tsx`;
    - `<ViewTransition>` en `event-panel.tsx`;
    - `IconSwap` en cada `cond ? <IconA/> : <IconB/>` que pinte un icono en el mismo sitio, con la lista anotada en la evidencia.

  Hecho cuando: `npm test -- icon-swap crossfade-text toast theme-toggle top-bar event-panel` en verde. Cubre: RF-52, RF-54 | Módulo: icon-swap, crossfade-text, state-overlap, icon-swaps

- [ ] T10 Deslizar la píldora del selector de vista con el color del texto recortado
  Pasos:
  - Primero, en rojo, `view-toolbar`:
    - hay una capa `aria-hidden` y sin eventos de puntero con `bg-accent` y `text-on-accent`;
    - su `clip-path` usa `--l` y `--r` medidos de la opción con `aria-current`, con `getBoundingClientRect` simulado;
    - los enlaces, `aria-current` y los atajos no cambian;
    - el grupo tiene `view-transition-name: view-switcher`.
  - Después, las dos capas en `view-toolbar.tsx`, el `ResizeObserver` y las reglas de `::view-transition-*(view-switcher)` en `globals.css`.
  - Se comprueba en Chrome y en Safari de iOS que no se duplica durante el fundido de la vista (plan R1).

  Hecho cuando: `npm test -- view-toolbar` en verde y una grabación o capturas en `playwright-cli` del paso de Mes a Día en las que el texto cambia de color justo por donde pasa la píldora. Cubre: RF-34, RF-35 | Módulo: view-switcher

- [ ] T11 Revelar el tema, el acento y los desplegables de la cabecera
  Pasos:
  - Primero, en rojo:
    - `apply-theme`: con origen, pone `--reveal-x`, `--reveal-y`, `--reveal-r` (la esquina más lejana) y `data-reveal` mientras dura la transición, y los quita al acabar. Sin `startViewTransition` o con movimiento reducido, pinta sin transición.
    - `theme-toggle` pasa el centro del botón; `theme-picker` y `accent-picker`, el de la opción.
    - `theme-picker` y `accent-picker` tienen un anillo `aria-hidden` colocado sobre la opción elegida.
    - La fila de meses y el mini calendario de la cabecera del móvil llevan `reveal-down` y salen con `data-leaving`.
  - Después: `applyTheme(theme, origin?)`, las reglas de `html[data-reveal]::view-transition-new(root)`, el anillo deslizante y `usePresence` en la cabecera.

  Hecho cuando: `npm test -- apply-theme theme-toggle theme-picker accent-picker calendar-workspace` en verde y capturas a media animación del círculo creciendo desde el botón. Cubre: RF-36, RF-37, RF-38, RF-39, RF-62 | Módulo: theme-reveal, selection-slide, header-reveal

- [ ] T12 Confirmar el éxito con un pulso
  Pasos:
  - Primero, en rojo:
    - `marks.test.ts`: `markPulse`, `captureReturn` y `takeMark`; se consumen una vez, caducan a los 2 s y la última marca de un id gana.
    - Con `pulse` simulado:
      - se llama al llegar el éxito en `profile-form`, `email-form`, `password-form`, las opciones de calendario de Ajustes, `copy-button`, el copiar ID de `access-code-panel`, `sync-now-button`, `switch` y `comment-form`;
      - no se llama si falla;
      - el texto de éxito de hoy sigue apareciendo.
    - `event-interactions`: un cambio que pasa de pendiente a guardado deja `markPulse(id)`; uno que falla no.
  - Después, `src/lib/motion/marks.ts`, las llamadas a `pulse` y el consumo de la marca de pulso en `draggable-event.tsx`.

  Hecho cuando: `npm test -- marks profile-form email-form password-form view-options-setting copy-button access-code-panel sync-now-button switch comment-form event-interactions draggable-event` en verde. Cubre: RF-47, RF-48, RF-49, RF-50, RF-51 | Módulo: success-pulse, motion-marks

### Iteración 2

- [ ] T13 Devolver los eventos a su sitio en arco
  Pasos:
  - Primero, en rojo, `event-interactions` y `draggable-event`:
    - deja `captureReturn(id)` antes de deshacer un cambio que falla, al pulsar "Deshacer" tras mover o redimensionar, cuando Google o iCloud lo rechazan y al cancelar la pregunta del alcance;
    - el bloque, al pintarse, llama a `play` con `flightKeyframes(from, to)` y `--ease-in-out`;
    - sin marca no anima.
  - Después, el cableado en los dos componentes.

  Hecho cuando: `npm test -- event-interactions draggable-event` en verde y una prueba en `playwright-cli` (mover un evento a otro día y pulsar "Deshacer") en la que vuelve en arco. Cubre: RF-20, RF-21, RF-22 | Módulo: return-flight, motion-marks

- [ ] T14 Transformar el bloque en la tarjeta de detalle y devolverla al cerrar
  Pasos:
  - Primero, en rojo:
    - `morph.test.ts`:
      - `setMorphOrigin` y `takeMorphOrigin` (caduca a 1 s; solo para el mismo evento);
      - `findVisibleBlock` ignora un bloque oculto con el mismo id, como el de Activity (plan R4), y elige el tramo guardado;
      - `morphIn` y `morphOut` llaman a `play` con `translate` y `clip-path` (sin `scale`) y a `holdLive` y su función de soltar.
    - `event-card`:
      - con origen hace `morphIn`;
      - al cerrar con el bloque visible, `morphOut` hacia la caja actual y se desmonta después;
      - sin bloque, salida `pop`;
      - el foco vuelve al bloque.
    - `event-block` guarda el origen al pulsar, y los tramos de varios días del mes llevan `data-segment`.
  - Después, `src/lib/motion/morph.ts`, `data-morph` (fondo opaco durante la animación, plan R3) y el cableado en `event-block.tsx`, `event-card.tsx` y la vista mes.

  Hecho cuando: `npm test -- morph event-card event-block month-view` en verde y capturas a media animación de la tarjeta saliendo del bloque en semana y mes. Cubre: RF-55, RF-56, RF-57, RF-58, RF-61 | Módulo: motion-morph, event-morph

- [ ] T15 Transformar el bloque en la hoja del móvil y en la ventana, y la tarjeta en la ventana
  Pasos:
  - Primero, en rojo, `event-modal`:
    - con `morphId` y un origen del mismo evento hace `morphIn`, tanto en la variante hoja como en la ventana;
    - sin origen, la entrada normal (RF-59);
    - "Cerrar" y Escape hacen `morphOut` antes de `router.back()` si el bloque está visible, y la salida normal si no;
    - "Editar" y "Abrir" de `event-card` guardan la caja de la tarjeta como origen antes de navegar.
  - Después, `morphId` en las rutas interceptadas de `@modal/(.)events/[id]` y el cableado en `event-modal.tsx` y `event-card.tsx`.

  Hecho cuando: `npm test -- event-modal event-card` en verde y una prueba en `playwright-cli` a 390 px (bloque → hoja → cerrar) y a 1440 px (tarjeta → "Editar" → ventana). Cubre: RF-55, RF-57, RF-58, RF-59, RF-60 | Módulo: event-morph

- [ ] T16 Hacer que la vista del calendario siga al dedo
  Pasos:
  - Primero, en rojo:
    - `use-follow-drag.test.tsx` con punteros táctiles simulados:
      - el eje se decide a los 10 px y en vertical no mueve nada;
      - en horizontal escribe `translate` en el elemento;
      - al soltar llama a `onRelease` con el desplazamiento y la velocidad;
      - el ratón no cuenta;
      - con un `dialog[open]` no hace nada.
    - `calendar-workspace`:
      - el contenedor de mes, semana y día lleva `touch-pan-y`;
      - con `forward` navega al periodo siguiente, con `back` al anterior y con `stay` no navega;
      - la agenda no lo usa.
  - Después:
    - `src/lib/hooks/use-follow-drag.ts`, que sustituye a `useSwipe` en el workspace;
    - la salida con `play` antes de navegar;
    - la vuelta a 0 con `stay`.
  - Antes de cerrar, prueba en el iPhone de que el pellizco y el desplazamiento siguen bien (plan R2).

  Hecho cuando: `npm test -- use-follow-drag calendar-workspace swipe` en verde y una prueba táctil en `playwright-cli` a 390 px en la que la vista se mueve bajo el dedo y cambia de periodo o vuelve según el umbral. Cubre: RF-23, RF-24, RF-25, RF-26, RF-27, RF-28, RF-29 | Módulo: follow-gesture

- [ ] T17 Hacer que el cajón y el visor de imágenes sigan al dedo con goma
  Pasos:
  - Primero, en rojo:
    - `nav-drawer`:
      - al deslizar a la izquierda sigue al dedo;
      - pasada la mitad del ancho, o con velocidad, se cierra; si no, vuelve abierto;
      - hacia la derecha se desplaza con `rubberBand`, sin pasar de 64 px.
    - `image-viewer`:
      - la imagen sigue al dedo;
      - pasado el 25 % del ancho, o con velocidad, cambia de imagen y la nueva lleva `data-enter-from` del lado contrario;
      - en la primera, en la última y con una sola imagen, goma en el extremo.
  - Después, `useFollowDrag` en los dos componentes.

  Hecho cuando: `npm test -- nav-drawer image-viewer` en verde y una prueba táctil en `playwright-cli` a 390 px del cajón y del visor. Cubre: RF-30, RF-31, RF-32, RF-33 | Módulo: follow-gesture, band-limits

- [ ] T18 Poner la goma en la hoja de detalle, el pellizco de las horas y el borde de un evento
  Pasos:
  - Primero, en rojo:
    - `event-modal` en variante hoja: subir más allá del límite usa `banded()` (ampliada desde 0; a media altura desde la distancia hasta la altura completa) y al soltar vuelve con `play`.
    - `use-grid-zoom`:
      - fuera de 24–144 px la altura sale de `banded()`;
      - al soltar se fija en el límite y lo que sobra vuelve con `scaleY`;
      - con movimiento reducido se para en seco.
    - `use-event-drag`: el borde por debajo de 15 min se estira con goma y al soltar vuelve a 15 min con `scaleY`.
  - Después, `banded()` y `play` en esos tres sitios.

  Hecho cuando: `npm test -- event-modal use-grid-zoom use-event-drag zoom drag` en verde. Cubre: RF-24, RF-32, RF-33, RF-67 | Módulo: band-limits

- [ ] T19 Validar la spec RF por RF y cerrarla
  Pasos:
  - Tabla RF-1 a RF-68 con el test o la comprobación manual que cubre cada uno, en la sección de evidencia de este archivo.
  - Prueba en el iPhone en producción (como la 016) y en el ordenador con ratón y con teclado:
    - desplegables;
    - evento → detalle en las tres superficies;
    - seguir al dedo con goma;
    - interruptor;
    - selector de vista;
    - cambio de tema;
    - pulso;
    - regreso en arco.
  - Capturas a 390, 768 y 1440 px en los dos temas, con el acento rojo y el amarillo, y repaso completo con movimiento reducido.
  - Medida de rendimiento: la CPU ralentizada 4 veces en Chrome DevTools, con como mucho el 5 % de fotogramas perdidos en la transformación, el deslizar y el revelado, y la salida reportada.
  - Comprobar lo que queda fuera de alcance: ni los `select` nativos ni las vistas del calendario se animan, y no hay librerías nuevas en `package.json`.
  - `AGENTS.md` al día: estado de la 021, tokens y utilidades de movimiento, `lib/motion/` y las trampas nuevas.

  Hecho cuando: la tabla de RF está completa con evidencia, la verificación obligatoria está reportada y el usuario aprueba el cierre. Cubre: RF-1 a RF-68 | Módulo: validación

## Trazabilidad RF -> Tareas

| RF | Tareas |
|----|--------|
| RF-1, RF-2, RF-3, RF-4, RF-5 | T1, T19 |
| RF-6, RF-7 | T4, T5, T19 |
| RF-8, RF-10 | T2, T5, T19 |
| RF-9 | T5, T19 |
| RF-11, RF-12 | T4, T19 |
| RF-13, RF-14, RF-15 | T4, T19 |
| RF-16, RF-17, RF-18, RF-19 | T6, T19 |
| RF-20, RF-21, RF-22 | T2, T13, T19 |
| RF-23, RF-26 | T16, T19 |
| RF-24 | T16, T18, T19 |
| RF-25, RF-27, RF-28, RF-29 | T2, T16, T19 |
| RF-30, RF-31 | T17, T19 |
| RF-32, RF-33 | T2, T17, T18, T19 |
| RF-34, RF-35 | T10, T19 |
| RF-36, RF-37, RF-38, RF-39 | T11, T19 |
| RF-40 a RF-46 | T7, T19 |
| RF-47, RF-49 | T3, T12, T19 |
| RF-48, RF-50, RF-51 | T12, T19 |
| RF-52 | T8, T9, T19 |
| RF-53 | T8, T19 |
| RF-54 | T9, T19 |
| RF-55, RF-57, RF-58 | T14, T15, T19 |
| RF-56, RF-61 | T14, T19 |
| RF-59, RF-60 | T15, T19 |
| RF-62 | T11, T19 |
| RF-63, RF-64 | T3, T19 |
| RF-65 | T3, T5, T19 |
| RF-66 | T1, T3, T19 |
| RF-67 | T3, T18, T19 |
| RF-68 | T4, T8, T19 |

Cada módulo del plan tiene su tarea:

| Tarea | Módulos |
|-------|---------|
| T1 | motion-tokens, design-guard |
| T2 | motion-origin, motion-band, motion-release, motion-flight |
| T3 | motion-play, use-presence, use-enter-once |
| T4 | motion-utilities, dialogs, press-coverage |
| T5 | popovers |
| T6 | lists, settle-details |
| T7 | switch, settings-switches |
| T8 | swap-label |
| T9 | icon-swap, crossfade-text, icon-swaps, state-overlap (T8 y T9) |
| T10 | view-switcher |
| T11 | theme-reveal, selection-slide, header-reveal |
| T12 | success-pulse, motion-marks |
| T13 | return-flight |
| T14 y T15 | motion-morph, event-morph |
| T16 y T17 | follow-gesture |
| T17 y T18 | band-limits |

## Dudas abiertas

- Ninguna bloqueante. La única tarea que puede cambiar de rumbo es T16: si en el iPhone `touch-pan-y` rompe el pellizco o el desplazamiento de la semana, se aplica la mitigación R2 del plan y se anota en la evidencia.
