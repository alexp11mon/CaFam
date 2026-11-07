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

- [x] T9 Solapar iconos, el título de la cabecera, los avisos y el paso a edición
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

- [x] T10 Deslizar la píldora del selector de vista con el color del texto recortado
  Pasos:
  - Primero, en rojo, `view-toolbar`:
    - hay una capa `aria-hidden` y sin eventos de puntero con `bg-accent` y `text-on-accent`;
    - su `clip-path` usa `--l` y `--r` medidos de la opción con `aria-current`, con `getBoundingClientRect` simulado;
    - los enlaces, `aria-current` y los atajos no cambian;
    - el grupo tiene `view-transition-name: view-switcher`.
  - Después, las dos capas en `view-toolbar.tsx`, el `ResizeObserver` y las reglas de `::view-transition-*(view-switcher)` en `globals.css`.
  - Se comprueba en Chrome y en Safari de iOS que no se duplica durante el fundido de la vista (plan R1).

  Hecho cuando: `npm test -- view-toolbar` en verde y una grabación o capturas en `playwright-cli` del paso de Mes a Día en las que el texto cambia de color justo por donde pasa la píldora. Cubre: RF-34, RF-35 | Módulo: view-switcher

- [x] T11 Revelar el tema, el acento y los desplegables de la cabecera
  Pasos:
  - Primero, en rojo:
    - `apply-theme`: con origen, pone `--reveal-x`, `--reveal-y`, `--reveal-r` (la esquina más lejana) y `data-reveal` mientras dura la transición, y los quita al acabar. Sin `startViewTransition` o con movimiento reducido, pinta sin transición.
    - `theme-toggle` pasa el centro del botón; `theme-picker` y `accent-picker`, el de la opción.
    - `theme-picker` y `accent-picker` tienen un anillo `aria-hidden` colocado sobre la opción elegida.
    - La fila de meses y el mini calendario de la cabecera del móvil llevan `reveal-down` y salen con `data-leaving`.
  - Después: `applyTheme(theme, origin?)`, las reglas de `html[data-reveal]::view-transition-new(root)`, el anillo deslizante y `usePresence` en la cabecera.

  Hecho cuando: `npm test -- apply-theme theme-toggle theme-picker accent-picker calendar-workspace` en verde y capturas a media animación del círculo creciendo desde el botón. Cubre: RF-36, RF-37, RF-38, RF-39, RF-62 | Módulo: theme-reveal, selection-slide, header-reveal

- [x] T12 Confirmar el éxito con un pulso
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

  Notas al cerrarla (2026-11-07):
  - Las pruebas de los formularios y botones están juntas en `tests/unit/success-pulse.test.tsx` (con `pulse` simulado), más `marks.test.ts`, `event-interactions` y `draggable-event`. `usePulseOn` (`lib/hooks/use-pulse-on.ts`) atiende cada resultado una sola vez, por Activity.
  - `access-code-panel` no tiene botón de copiar el ID (el ID se lee en pantalla), así que no hay nada que pulsar ahí: añadirlo sería una función nueva.
  - Los dos interruptores y la duración no tenían texto de éxito; para cumplir RF-51 ahora dicen "Guardado." (`role="status"`) junto al pulso. `Switch` pulsa cuando `onCheckedChange` devuelve una promesa que se resuelve en `true`.
  - "Actualizar ahora" solo pulsa tras actualizar (`updated: true` en `SyncState`), no con el aviso de esperar.
  - También pulsan el evento pegado (`pasteEvent` devuelve su id) y el creado desde la ventana rápida (`eventId` de `createEvent`).

### Iteración 2

- [x] T13 Devolver los eventos a su sitio en arco
  Pasos:
  - Primero, en rojo, `event-interactions` y `draggable-event`:
    - deja `captureReturn(id)` antes de deshacer un cambio que falla, al pulsar "Deshacer" tras mover o redimensionar, cuando Google o iCloud lo rechazan y al cancelar la pregunta del alcance;
    - el bloque, al pintarse, llama a `play` con `flightKeyframes(from, to)` y `--ease-in-out`;
    - sin marca no anima.
  - Después, el cableado en los dos componentes.

  Hecho cuando: `npm test -- event-interactions draggable-event` en verde y una prueba en `playwright-cli` (mover un evento a otro día y pulsar "Deshacer") en la que vuelve en arco. Cubre: RF-20, RF-21, RF-22 | Módulo: return-flight, motion-marks

  Notas al cerrarla (2026-11-07):
  - `captureReturn` va en `settle` (fallo, rechazo de Google o iCloud y alcance cancelado son el mismo camino) y en `useUndoToast`, solo si "Deshacer" sale bien y el cambio era de horas (un color no se mueve).
  - Prueba en el navegador del panel (1440 px, `next start -p 3100`): un evento movido del lunes al miércoles y "Deshacer" anima `translate` de `228.8px 0px` a `0px 0px` pasando por `114.4px -32px` en 300 ms con `--ease-in-out`; al guardar el movimiento, el pulso `scale 1 → 1.04 → 1`.

- [x] T14 Transformar el bloque en la tarjeta de detalle y devolverla al cerrar
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

  Notas al cerrarla (2026-11-07):
  - La tarjeta lleva `pop` (con `--pop-origin` hacia el evento): es su entrada normal sin origen y su salida cuando el bloque ya no está (`data-leaving`, se desmonta a los `POP_OUT_MS`). Escape, "Cerrar" y el clic fuera pasan por `close`; los enlaces, el borrado y el estrechar la ventana cierran en el acto como antes.
  - `[data-morph]` va fuera de las capas en `globals.css`: dentro de `@layer base` perdía contra la utilidad `glass-float`.
  - Prueba en el navegador del panel (1440 px): en semana y en mes, la tarjeta pausada a mitad de camino sale del bloque con el color del evento encima y el contenido apareciendo; en mes el bloque lleva `data-segment="2026-11-09"`. Al cerrar, `translate` y `clip-path` van hacia la caja actual del bloque.

- [x] T15 Transformar el bloque en la hoja del móvil y en la ventana, y la tarjeta en la ventana
  Pasos:
  - Primero, en rojo, `event-modal`:
    - con `morphId` y un origen del mismo evento hace `morphIn`, tanto en la variante hoja como en la ventana;
    - sin origen, la entrada normal (RF-59);
    - "Cerrar" y Escape hacen `morphOut` antes de `router.back()` si el bloque está visible, y la salida normal si no;
    - "Editar" y "Abrir" de `event-card` guardan la caja de la tarjeta como origen antes de navegar.
  - Después, `morphId` en las rutas interceptadas de `@modal/(.)events/[id]` y el cableado en `event-modal.tsx` y `event-card.tsx`.

  Hecho cuando: `npm test -- event-modal event-card` en verde y una prueba en `playwright-cli` a 390 px (bloque → hoja → cerrar) y a 1440 px (tarjeta → "Editar" → ventana). Cubre: RF-55, RF-57, RF-58, RF-59, RF-60 | Módulo: event-morph

  Notas al cerrarla (2026-11-07):
  - `EventModal` toma el origen al abrirse (también cuando Next vuelve a mostrar la instancia guardada) y, al cerrar con "Cerrar", Escape, el asa, el fondo o "Descartar cambios", encoge hacia el bloque antes de `router.back()`; guardar o borrar cierran como antes. La tecla E de la tarjeta también guarda la caja de la tarjeta.
  - `morphIn` ya no deja el último fotograma en línea (`fill: "none"`); `morphOut` sí, hasta desmontar, y la limpieza del efecto de `EventModal` lo quita para la siguiente apertura.
  - Prueba en el navegador del panel en lugar de `playwright-cli`: a 1440 px, tarjeta → "Editar" → ventana que crece desde la caja de la tarjeta (`176.8px 420.77px`, `inset(0px 330px 589px 0px)`) y, con Escape, encoge hasta el bloque (113,6 × 48) y vuelve al calendario; a 390 px, bloque → hoja a media altura desde el bloque → "Cerrar" encoge hasta él; al volver a abrir el mismo evento la instancia reutilizada no conserva estilos en línea.

- [x] T16 Hacer que la vista del calendario siga al dedo
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

  Notas al cerrarla (2026-11-07):
  - `useFollowDrag(ref, {...})` recibe la referencia en vez de devolverla (la regla `react-hooks/refs` no deja leer un objeto con una referencia durante el render). La velocidad sale solo de los movimientos: pulsar y soltar sin moverse no es un gesto rápido. Un `dialog[open]` ajeno lo desactiva; el suyo propio (el cajón) no.
  - `use-swipe.ts` y su test se borran: el workspace era su único uso. `lib/calendar/swipe.ts` sigue (lo usa el cajón hasta T17).
  - Prueba en el navegador del panel a 390 px con punteros táctiles sintéticos (en lugar de `playwright-cli`): 25 px a la izquierda escribe `translate: -25px` bajo el dedo y al soltar anima `-25px → 0px` sin cambiar de semana; 150 px anima `-150px → -358px` (el ancho de la vista) y lleva a la semana siguiente. Con el panel oculto el navegador pausa `requestAnimationFrame` y las animaciones, así que la navegación llega al volver a mostrarse.
  - Pendiente para el usuario: la prueba en el iPhone del pellizco y el desplazamiento (plan R2); queda anotada en T19.

- [x] T17 Hacer que el cajón y el visor de imágenes sigan al dedo con goma
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

  Notas al cerrarla (2026-11-07):
  - `useFollowDrag` marca `data-following` mientras sigue al dedo; una regla fuera de capas (`[data-following] { transition: none }`) quita las transiciones para que el cajón no vaya por detrás. Al soltar, el cajón quita su `translate` en línea y su transición de CSS lo cierra o lo devuelve desde donde lo dejó el dedo.
  - La comprobación de ventanas abiertas cambia: dentro de una ventana abierta el dedo está en ella (el visor se abre sobre el detalle, que también es un `<dialog>`); fuera, cualquier ventana abierta lo para.
  - El visor envuelve la imagen en un `div` con `key` y `data-enter-from` (`right` al avanzar, `left` al retroceder, también con botones y flechas), que entra con las animaciones `cal-in-end` y `cal-in-start` de la 011. Si no cambia, vuelve a 0 con `play`.
  - El cajón lleva `touch-pan-y` para que el navegador no se quede el gesto horizontal.
  - `lib/calendar/swipe.ts` y su test se borran: el cajón era su último uso.
  - Prueba en el navegador del panel a 390 px con punteros táctiles sintéticos sobre el cajón: 50 px a la izquierda vuelve abierto, 190 px lo cierra y hacia la derecha no se cierra. El visor no se probó en el navegador (el usuario de prueba no tiene imágenes); lo cubren `image-viewer.test.tsx` y comparte el gesto con el cajón.

- [x] T18 Poner la goma en la hoja de detalle, el pellizco de las horas y el borde de un evento
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

  Notas al cerrarla (2026-11-07):
  - Hoja: el asa sigue al dedo hacia arriba hasta el borde superior de la pantalla (a media altura, `innerHeight` menos su altura; ampliada, 0) y desde ahí con `banded()`; hacia abajo va libre, porque es cerrar. Al soltar sin cerrar, `play` devuelve el `translate` a 0 en `--motion-base-out` en lugar de saltar. Sustituye al tope fijo de 40 px.
  - Pellizco: fuera de 24–144 px la altura sale de `banded()` (redondeada); con movimiento reducido, `clampHourPx`. Al soltar se guarda el límite y la rejilla (`[data-grid-scroll] > *`) vuelve con `scale: 1 <exceso>` → `1 1` desde el punto del pellizco. `MIN_HOUR_PX` y `MAX_HOUR_PX` se exportan de `zoom.ts`.
  - Borde de un evento: por debajo de 15 min el bloque se encoge con `scale` desde arriba (la goma, como mucho a la mitad de un bloque de 15 min, porque 64 px no caben en él) y al soltar vuelve con `play`. Con movimiento reducido se para en seco.
  - Sin prueba en el navegador: la tarea solo pide los tests; queda en la revisión de T19.

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

## Evidencia (T19, 2026-11-07)

Verificación obligatoria al cerrar T18, en la rama `021-animaciones-y-microinteracciones`: `typecheck ok`, `lint ok`, `format ok`, `Test Files 253 passed (253)`, `Tests 2417 passed (2417)`, `build ok`. Sin migraciones, así que sin `test:db`. `package.json` y `package-lock.json` no cambian respecto a `main`.

| RF | Test o comprobación |
|----|---------------------|
| RF-1, RF-2 | `motion-tokens.test.ts` (`--ease-out` y `--ease-in-out`), `motion-utilities.test.ts` (entradas con `--ease-out`), `play.test.ts` |
| RF-3 | `motion-tokens.test.ts`: cada `-out` es el 80 % de su `-in` (±10 ms) |
| RF-4 | Revisión de `globals.css`: `--ease-out` `cubic-bezier(0.23, 1, 0.32, 1)` y `--ease-in-out` `cubic-bezier(0.65, 0, 0.35, 1)` tienen la `y` de sus puntos de control entre 0 y 1, así que no rebotan; `flight.test.ts` (el arco acaba en el destino) |
| RF-5 | `motion-tokens.test.ts` y `design-tokens.test.ts` (≤ 400 ms, escalonado incluido) |
| RF-6, RF-7 | `motion-utilities.test.ts` (`pop` desde `--pop-scale` 0,95 y opacidad 0); `event-menu`, `time-field`, `side-rail`, `quick-create`, `calendar-workspace` |
| RF-8, RF-10 | `motion-origin.test.ts`; `event-menu.test.tsx` (puntero y evento enfocado) |
| RF-9, RF-65 | `event-menu.test.tsx` (`data-leaving`, tres aperturas dejan un menú), `use-presence.test.tsx` |
| RF-11, RF-12 | `motion-utilities.test.ts` (`dialog`, `[data-sheet]`, `[data-drawer]`) |
| RF-13, RF-14, RF-15 | `motion-utilities.test.ts` (`press`, `press-quiet`, sin escala en deshabilitado), `press-coverage.test.ts` (`EventBlock` sin `press`) |
| RF-16, RF-17 | `motion-utilities.test.ts` (`stagger` del 2 al 8), `lists-motion.test.tsx`, `calendar-list`, `member-list`, `connection-list` |
| RF-18 | `event-comments.test.tsx` (`row-in` solo en las filas nuevas), `use-enter-once.test.tsx` |
| RF-19 | `lists-motion.test.tsx` y `toast.test.tsx` (`settle`) |
| RF-20, RF-21, RF-22 | `flight.test.ts` (arco de 32 px desde 48 px, recto por debajo), `marks.test.ts`, `event-interactions.test.tsx`, `draggable-event.test.tsx`; navegador a 1440 px (T13) |
| RF-23, RF-26, RF-27 | `use-follow-drag.test.tsx`, `calendar-workspace.test.tsx`; navegador a 390 px (T16) |
| RF-24 | `calendar-workspace.test.tsx`, `image-viewer.test.tsx`, `event-modal.test.tsx` (vuelta con `play`) |
| RF-25, RF-28, RF-29 | `release.test.ts`, `calendar-workspace.test.tsx`; navegador a 390 px (T16) |
| RF-30 | `nav-drawer.test.tsx`; navegador a 390 px (T17) |
| RF-31 | `image-viewer.test.tsx` |
| RF-32, RF-33 | `rubber-band.test.ts`, `nav-drawer`, `image-viewer`, `event-modal`, `use-grid-zoom`, `draggable-event` |
| RF-34, RF-35 | `view-toolbar.test.tsx` (capa recortada con `--l` y `--r`) |
| RF-36, RF-37, RF-39 | `apply-theme.test.ts`, `theme-toggle.test.tsx`, `theme-picker.test.tsx`, `accent-picker.test.tsx` (sin View Transitions, cambio inmediato) |
| RF-38 | `calendar-workspace.test.tsx` (`reveal-down` al plegar) |
| RF-40 a RF-46 | `switch.test.tsx` (rol, Espacio, 44 px, contraste 3:1 con `contrast.ts`, error que la devuelve, inversión a mitad de viaje), `view-options-setting`, `availability-setting` |
| RF-47, RF-49, RF-50, RF-51 | `success-pulse.test.tsx`, `play.test.ts` (`pulse` ≤ 4 % y ≤ 300 ms), `view-options-setting` ("Guardado.") |
| RF-48 | `marks.test.ts`, `event-interactions.test.tsx`, `draggable-event.test.tsx`, `quick-create.test.tsx` |
| RF-52 | `crossfade-text.test.tsx`, `toast.test.tsx`, `event-panel.test.tsx`, `swap-label.test.tsx` |
| RF-53 | `swap-label.test.tsx` y el `grep` de T8 sin resultados |
| RF-54 | `icon-swap.test.tsx`, `theme-toggle.test.tsx` |
| RF-55, RF-56, RF-57, RF-58, RF-61 | `morph.test.ts`, `event-card.test.tsx`, `event-block.test.tsx`, `month-view.test.tsx`; navegador a 1440 px (T14) |
| RF-59, RF-60 | `event-modal.test.tsx`, `event-card.test.tsx`; navegador a 390 y 1440 px (T15) |
| RF-62 | `theme-picker.test.tsx`, `accent-picker.test.tsx` |
| RF-63, RF-64 | `play.test.ts` (fija y cancela lo que corre), `switch.test.tsx` (inversión) |
| RF-66 | `motion-tokens.test.ts` (bloque `prefers-reduced-motion`), `play.test.ts` |
| RF-67 | `use-follow-drag.test.tsx`, `use-grid-zoom.test.tsx` y `draggable-event.test.tsx` (en seco con movimiento reducido) |
| RF-68 | `motion-utilities.test.ts` y `press-coverage.test.ts` sobre los componentes compartidos |

Fuera de alcance comprobado: ninguna vista del calendario lleva `stagger` (`lists-motion.test.tsx`), los `select` nativos no tienen transición en `globals.css` y no hay librerías nuevas.

Revisión en el navegador del panel (`next start -p 3100`, tema oscuro y acento rojo): semana a 390 px, Ajustes a 768 px y mes en escritorio sin nada roto.

Queda para el usuario, porque necesita su dispositivo o producción:

- Prueba en el iPhone en producción: pellizco y desplazamiento de la semana con `touch-pan-y` (plan R2), cajón, hoja, visor y deslizar.
- Safari de iOS: la píldora del selector de vista no se duplica en el fundido (plan R1).
- Rendimiento: Chrome DevTools con la CPU ralentizada 4 veces, como mucho un 5 % de fotogramas perdidos en la transformación, el deslizar y el revelado.
- Capturas completas a 390, 768 y 1440 px en los dos temas con el acento rojo y el amarillo, y un repaso con movimiento reducido activado en el sistema.

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
