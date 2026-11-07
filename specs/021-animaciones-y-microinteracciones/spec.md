# Spec 021 — Animaciones y microinteracciones

## Contexto y objetivo

La spec 011 dio movimiento a CaFam: los botones responden al pulsarlos, las ventanas y los avisos entran y salen, y cambiar de vista o de periodo tiene transición. Pero todo usa la misma curva y la misma duración. Hay desplegables que aparecen de golpe, lo que se desliza con el dedo no se mueve hasta soltar, y abrir un evento muestra una superficie nueva que no sale de su bloque.

Esta spec aplica los 20 consejos del vídeo "20 Ways to Make Beautiful AI Animations" de Charles Liu (TikTok, visto el 2026-11-07). El análisis de cada consejo, con su demostración, cómo está CaFam hoy y los RF que lo cubren, está en [`analisis-video.md`](analisis-video.md). La idea común es que cada animación cuente de dónde viene algo y a dónde va:

- los desplegables nacen del botón que los abre y vuelven a él al cerrarse;
- un evento crece desde su bloque hasta convertirse en su detalle;
- lo que se arrastra va pegado al dedo y, pasado el límite, se resiste como una goma;
- entrar, salir y moverse tienen cada uno su curva y su duración.

No cambian las funciones, la disposición, los colores ni la tipografía. Sustituye a RF-21 de la spec 011: el cambio de tema deja de ser un fundido y pasa a revelarse con un círculo (RF-36). Necesita la **enmienda 8** de la constitución (sección propia más abajo), aprobada por el usuario el 2026-11-07, para animar recortes.

## Usuarios / actores

- **Cualquier usuario con sesión**, en el móvil (≤ 768 px), en la tableta (769–1023 px) y en el ordenador (≥ 1024 px), con ratón, dedo o teclado.
- **Visitante sin sesión**: ve el movimiento de los componentes compartidos en la portada, el login, el registro, la recuperación de contraseña, la invitación, la pantalla sin conexión y la política de privacidad.
- **Usuario que pide movimiento reducido** al sistema operativo.

## Historias de usuario

- H1: Como usuario, quiero que los menús y desplegables salgan del botón que pulso y vuelvan a él, para entender de dónde sale cada cosa.
- H2: Como usuario, quiero que el evento que pulso crezca hasta su detalle y vuelva a su sitio al cerrarlo, para no perder de vista dónde estaba.
- H3: Como usuario del móvil, quiero que el calendario, el cajón, la hoja y el visor de imágenes sigan a mi dedo, para que deslizar se sienta directo.
- H4: Como usuario, quiero un interruptor para los ajustes que se encienden y se apagan, para ver su estado de un vistazo.
- H5: Como usuario, quiero una confirmación breve y visible cuando algo se guarda sin cerrar la pantalla, para no tener que buscar el mensaje.
- H6: Como usuario que pide movimiento reducido, quiero que todo funcione igual con fundidos cortos o cambios inmediatos, para no marearme.

## Requisitos funcionales (criterios de aceptación en EARS)

### Reglas generales de movimiento (consejos 1, 9, 13 y 15)

- RF-1: CUANDO un elemento aparezca en pantalla (ventana, hoja, desplegable, aviso, fila o tarjeta), EL SISTEMA animará su entrada con una curva de deceleración: rápida al empezar y lenta al llegar.
- RF-2: CUANDO un elemento que ya está en pantalla cambie de posición o de tamaño sin que el usuario lo esté arrastrando, EL SISTEMA animará el cambio con una curva que acelera al salir y frena al llegar.
- RF-3: EL SISTEMA hará que la salida de cada elemento dure el 80 % de su entrada, con un margen de ±10 ms.
- RF-4: EL SISTEMA no llevará ninguna animación más allá de su valor final para volver después a él (sin rebote), salvo el pulso de confirmación (RF-49).
- RF-5: EL SISTEMA limitará cada animación a 400 ms, contando los retrasos del escalonado.

### Desplegables, ventanas y hojas (consejos 2, 10, 11 y 12)

- RF-6: CUANDO se abra un desplegable (el menú contextual del evento, la ventana rápida en el ordenador, la lista de horas, el selector de fecha flotante con el panel plegado o un tooltip de la barra lateral), EL SISTEMA animará su entrada en un tiempo de 150 a 250 ms.
- RF-7: CUANDO se abra un desplegable, EL SISTEMA lo hará aparecer desde el 95 % de su tamaño final y desde transparente, nunca desde tamaño cero.
- RF-8: CUANDO se abra un desplegable, EL SISTEMA lo hará crecer desde el punto más cercano a lo que lo abrió: el botón, el campo, el hueco del calendario o el puntero.
- RF-9: CUANDO se cierre un desplegable, EL SISTEMA lo encogerá y lo desvanecerá hacia ese mismo punto.
- RF-10: SI un desplegable se abrió con el teclado, ENTONCES EL SISTEMA usará como punto de origen el elemento que tenía el foco.
- RF-11: CUANDO se abra una ventana o un diálogo centrado (la ventana de evento, ir a una fecha, la ayuda de atajos, el alcance de una serie y las confirmaciones), EL SISTEMA lo hará aparecer desde el 95 % de su tamaño, con origen en su centro, en un tiempo de 200 a 300 ms.
- RF-12: CUANDO se abra una hoja o el cajón (la hoja "Más", la hoja de detalle, la ventana rápida en el móvil o el cajón de navegación), EL SISTEMA la deslizará desde su borde de la pantalla, sin escala.

### Pulsar (consejo 4)

- RF-13: MIENTRAS el usuario mantenga pulsado un control, EL SISTEMA lo reducirá al 97 % de su tamaño en 150 ms. Cuenta como control: un botón, un enlace con forma de botón, una fila de menú, de la hoja "Más" o del cajón, una opción de la lista de horas, un día del mini calendario o de la fila de meses, una opción de los selectores de tema y acento, un avatar de los filtros, un interruptor o un botón flotante.
- RF-14: SI el control está deshabilitado, ENTONCES EL SISTEMA no lo reducirá.
- RF-15: SI lo que se pulsa es un bloque de evento que se puede mover, ENTONCES EL SISTEMA no lo reducirá, porque mantenerlo pulsado ya lo levanta (spec 017).

### Escalonado (consejos 3 y 6)

- RF-16: CUANDO se abra o se cargue una lista, EL SISTEMA hará entrar sus filas una tras otra, con 30 ms de diferencia entre cada una. Cuenta como lista: el menú contextual, la lista de horas, el cajón, la hoja "Más", "Mis calendarios", los miembros, las cuentas conectadas, los calendarios de la ficha de una cuenta, los comentarios al abrir el detalle y los eventos citados por el asistente.
- RF-17: EL SISTEMA escalonará como mucho las 8 primeras filas visibles, y las demás entrarán a la vez que la octava.
- RF-18: CUANDO se añadan filas a una lista que ya está en pantalla ("Ver anteriores", un comentario nuevo del sondeo), EL SISTEMA hará entrar solo las nuevas, sin volver a animar las que ya estaban.
- RF-19: CUANDO aparezca un elemento compuesto, EL SISTEMA mostrará su detalle secundario 50 ms después del cuerpo principal. Estos son los elementos y sus detalles: el botón "Deshacer" de un aviso, los botones de la ventana rápida, la fila de acciones de la tarjeta de detalle y la lista de eventos citados bajo una respuesta del asistente.

### Traslados en arco (consejo 7)

- RF-20: CUANDO un evento vuelva solo a su sitio, EL SISTEMA lo llevará de su posición anterior a la nueva en un movimiento continuo, sin saltar. Un evento vuelve solo cuando falla el guardado de un movimiento, cuando se pulsa "Deshacer" tras mover o redimensionar, cuando Google o iCloud rechazan el cambio y cuando se cancela la pregunta del alcance de una serie.
- RF-21: CUANDO ese traslado recorra 48 px o más, EL SISTEMA lo hará en un arco que se separe como mucho 32 px de la línea recta.
- RF-22: SI el traslado recorre menos de 48 px, ENTONCES EL SISTEMA lo hará en línea recta.

### Seguir al dedo (consejo 14)

- RF-23: MIENTRAS el usuario arrastre algo con el dedo o el ratón, EL SISTEMA lo moverá a la vez que el puntero, sin animación entre los dos. Esto vale para un evento, su borde, el bloque provisional, la hoja inferior, el cajón, la vista del calendario al deslizar, el visor de imágenes y el pellizco de las horas.
- RF-24: CUANDO el usuario suelte lo que arrastra, EL SISTEMA animará el trayecto que falte hasta la posición final con la curva de RF-2.
- RF-25: CUANDO el usuario suelte con una velocidad de al menos 0,5 px/ms en un sentido, EL SISTEMA completará la acción de ese sentido aunque no se haya llegado al umbral de distancia.
- RF-26: MIENTRAS el usuario deslice en horizontal en las vistas mes, semana o día, EL SISTEMA desplazará la vista bajo el dedo.
- RF-27: SI el gesto empieza más vertical que horizontal, ENTONCES EL SISTEMA desplazará el contenido en vertical y no moverá la vista de lado.
- RF-28: CUANDO el usuario suelte la vista tras pasar el umbral de cambio de periodo (50 px, o la velocidad de RF-25), EL SISTEMA la sacará por ese lado y hará entrar el periodo siguiente o el anterior por el lado contrario.
- RF-29: SI el usuario suelta la vista sin pasar el umbral, ENTONCES EL SISTEMA la devolverá a su sitio sin cambiar de periodo.
- RF-30: MIENTRAS el usuario deslice el cajón hacia la izquierda, EL SISTEMA lo moverá bajo el dedo. Al soltar lo cerrará si ha recorrido más de la mitad de su ancho o lleva la velocidad de RF-25. Si no, lo devolverá abierto.
- RF-31: MIENTRAS el usuario deslice en el visor de imágenes, EL SISTEMA moverá la imagen bajo el dedo. Al soltar pasará a la siguiente o a la anterior, que entrará por el lado contrario, si ha recorrido más del 25 % del ancho o lleva la velocidad de RF-25. Si no, la devolverá a su sitio.

### Goma al pasar del límite (consejo 19)

- RF-32: SI el usuario arrastra más allá de un límite, ENTONCES EL SISTEMA seguirá moviendo el elemento con una resistencia cada vez mayor, sin pasar de 64 px más allá del límite. Estos son los límites:
  - la hoja inferior ya ampliada, hacia arriba;
  - el cajón ya abierto, hacia la derecha;
  - el visor en la primera imagen hacia la derecha, en la última hacia la izquierda, y con una sola imagen hacia los dos lados;
  - el borde de un evento por debajo de la duración mínima de 15 minutos;
  - el pellizco de las horas por debajo de 24 px o por encima de 144 px por hora.
- RF-33: CUANDO el usuario suelte un elemento que ha pasado de su límite, EL SISTEMA lo devolverá al límite sin rebasarlo en sentido contrario.

### Selector de vista, cambio de tema y revelados (consejos 17 y 20)

- RF-34: CUANDO el usuario elija otra vista en el selector Agenda, Mes, Semana y Día, EL SISTEMA deslizará el fondo de la opción elegida desde la opción anterior hasta la nueva, con la curva de RF-2.
- RF-35: MIENTRAS ese fondo se desliza, EL SISTEMA cambiará el color del texto de cada opción solo en la parte que el fondo cubre en ese instante.
- RF-36: CUANDO el usuario cambie de tema con el acceso directo del marco, EL SISTEMA revelará el tema nuevo con un círculo que crece desde el botón hasta cubrir la pantalla en 400 ms como mucho.
- RF-37: CUANDO el usuario elija otro tema u otro acento en Ajustes, EL SISTEMA revelará el cambio con un círculo que crece desde la opción elegida.
- RF-38: CUANDO se despliegue la fila de meses o el mini calendario de la cabecera del móvil, EL SISTEMA lo revelará de arriba abajo, sin deslizar su contenido ni cambiar su tamaño. Al plegarse, lo ocultará de abajo arriba.
- RF-39: SI el navegador no admite el revelado, ENTONCES EL SISTEMA hará el cambio con un fundido o de forma inmediata, con la misma función.

### Interruptor (consejo 5)

- RF-40: EL SISTEMA mostrará como interruptor de encendido y apagado cada ajuste de la pantalla Ajustes que se guarda al cambiarlo: "Mostrar fines de semana" y "Permitir que el asistente de otros consulte mi disponibilidad".
- RF-41: EL SISTEMA anunciará a los lectores de pantalla el nombre del interruptor y su estado ("activado" o "desactivado"), y lo cambiará con la tecla Espacio.
- RF-42: EL SISTEMA dará al interruptor un objetivo táctil de al menos 44 × 44 px y un contraste gráfico de al menos 3:1 en los dos estados y en los dos temas. Además, el estado se distinguirá por el lado de la bolita y no solo por el color.
- RF-43: CUANDO el interruptor cambie de estado, EL SISTEMA llevará la bolita al otro extremo con la curva de RF-2.
- RF-44: MIENTRAS la bolita viaja, EL SISTEMA la estirará en el sentido del viaje hasta un 12 % más de largo, conservará su área estrechándola en la otra dirección y la devolverá a su forma redonda al llegar.
- RF-45: SI no se puede guardar el ajuste, ENTONCES EL SISTEMA devolverá la bolita a su estado anterior con la misma animación y mostrará el error, como hace hoy.
- RF-46: CUANDO el usuario pulse el interruptor mientras la bolita viaja, EL SISTEMA invertirá el viaje desde el punto en que esté, sin saltar a un extremo.

### Confirmar el éxito (consejo 8)

- RF-47: CUANDO se confirme un guardado que no cierra la pantalla, EL SISTEMA hará un único pulso del control que lo lanzó. Esto vale para los formularios de Ajustes, los botones de copiar un enlace o un ID de invitación, "Actualizar ahora" en una cuenta conectada, un interruptor y "Comentar".
- RF-48: CUANDO se confirme el guardado de un evento que el usuario ha movido, redimensionado, pegado, cambiado de color o creado desde la ventana rápida, EL SISTEMA hará un único pulso de su bloque.
- RF-49: EL SISTEMA hará que el pulso crezca como mucho un 4 %, vuelva a su tamaño y dure 300 ms como mucho.
- RF-50: SI el guardado falla, ENTONCES EL SISTEMA no hará el pulso.
- RF-51: EL SISTEMA acompañará siempre el pulso de un texto o aviso de éxito: el pulso nunca es la única señal.

### Cambios de estado e iconos (consejos 16 y 18)

- RF-52: CUANDO cambie el contenido de un control o de una zona, EL SISTEMA solapará la salida del estado anterior con la entrada del nuevo, sin ningún instante en que no se vea ninguno de los dos. Esto vale para el texto de un botón al quedar pendiente ("Guardar" → "Guardando…"), el título del mes en la cabecera del móvil al cambiar de periodo, un aviso que sustituye a otro y el detalle de un evento al pasar a edición.
- RF-53: CUANDO el texto de un botón cambie de estado, EL SISTEMA mantendrá el tamaño del botón.
- RF-54: CUANDO un icono se sustituya por otro en el mismo sitio (por ejemplo, el sol y la luna del acceso directo al tema), EL SISTEMA hará un fundido cruzado. El icono saliente se reducirá hasta el 50 % de su tamaño, se desenfocará hasta 4 px y se desvanecerá, y el entrante hará lo contrario, todo en 150 a 250 ms.

### El mismo objeto se transforma (consejo 20)

- RF-55: CUANDO el usuario abra un evento desde su bloque en las vistas mes, semana, día o agenda, EL SISTEMA hará que su detalle crezca desde la posición y el tamaño del bloque. El detalle es la tarjeta junto al evento (desde 769 px), la hoja inferior (hasta 768 px) o la ventana de evento.
- RF-56: MIENTRAS el bloque se transforma, EL SISTEMA desvanecerá el contenido del bloque y hará aparecer el del detalle sin deformar ningún texto.
- RF-57: CUANDO se cierre ese detalle y el bloque siga visible, EL SISTEMA encogerá el detalle hasta la posición y el tamaño que tenga el bloque en ese momento.
- RF-58: SI el bloque ya no está visible al cerrar (la vista se ha desplazado, ha cambiado el periodo o el evento se ha borrado o movido fuera de la pantalla), ENTONCES EL SISTEMA cerrará el detalle con su salida normal.
- RF-59: SI el detalle se abre sin un bloque de origen (un enlace, una recarga, un evento citado por el asistente o el próximo evento), ENTONCES EL SISTEMA usará la entrada normal de la tarjeta, de la hoja o de la ventana.
- RF-60: CUANDO el usuario pulse "Editar" o "Abrir" en la tarjeta de detalle, EL SISTEMA transformará la tarjeta en la ventana de evento.
- RF-61: MIENTRAS dure una transformación, EL SISTEMA aplazará hasta que termine el refresco por cambios de otras personas (spec 019).
- RF-62: CUANDO el usuario elija otra opción en los selectores de tema o de acento de Ajustes, EL SISTEMA deslizará la marca de selección desde la opción anterior hasta la nueva.

### Interrupción

- RF-63: CUANDO el usuario haga una acción nueva durante una animación, EL SISTEMA la interrumpirá y partirá de la posición en que esté, sin saltos.
- RF-64: MIENTRAS haya una animación en curso, EL SISTEMA aceptará las pulsaciones y los atajos de teclado sin esperar a que termine.
- RF-65: SI el usuario abre y cierra el mismo desplegable varias veces seguidas, ENTONCES EL SISTEMA no acumulará animaciones y mostrará solo el estado final.

### Movimiento reducido

- RF-66: MIENTRAS el sistema operativo pida movimiento reducido, EL SISTEMA sustituirá por un fundido de 150 ms como mucho, o por un cambio inmediato, las escalas, los arcos, los estiramientos, los pulsos, los desenfoques, los recortes, los escalonados y la transformación del evento en su detalle.
- RF-67: MIENTRAS el sistema operativo pida movimiento reducido, EL SISTEMA seguirá moviendo bajo el dedo lo que se arrastra. Lo detendrá en seco en el límite, sin goma, y al soltar lo pondrá en su posición final sin animación.

### Alcance de pantallas

- RF-68: EL SISTEMA aplicará estas reglas a los componentes compartidos de todas las pantallas: la portada, el login, el registro, la recuperación de contraseña, la invitación, la pantalla sin conexión, la política de privacidad y todas las pantallas del panel.

## Requisitos no funcionales

- **Constitución**: necesita la enmienda 8 (abajo) para RF-35, RF-36, RF-37 y RF-38. El resto cumple la sección "Movimiento" tal como está.
- **Rendimiento**: con la CPU ralentizada 4 veces en Chrome DevTools, cada animación pierde como mucho el 5 % de sus fotogramas a 60 fps. Lo que se arrastra no va más de un fotograma por detrás del puntero.
- **Estabilidad del diseño**: ninguna animación mueve ni cambia de tamaño a los elementos que la rodean.
- **Sin dependencias nuevas** (P6): solo CSS y APIs nativas del navegador.
- **Tokens** (P9): las duraciones, curvas, escalas, distancias y retrasos son tokens de diseño. La guardia de diseño impide valores sueltos y curvas con rebote.
- **Accesibilidad** (P9): WCAG 2.2 AA en los dos temas. Nada parpadea más de 3 veces por segundo. Tras abrir un detalle, el foco va a él, como hoy, y vuelve al bloque al cerrarlo. El interruptor y el selector de vista funcionan solo con el teclado.
- **Compatibilidad**: Safari en iOS, y Chrome, Edge y Firefox actuales. Si un navegador no admite algo, el cambio se hace sin esa animación y con la misma función.

## Casos límite

- **Bloque pequeño** (un evento de 15 min, una línea del mes o el "+N"): la transformación parte de ese tamaño. El "+N" no transforma nada, porque lleva a la vista día.
- **Evento de varios días** partido en tramos en el mes: la transformación parte del tramo pulsado.
- **Bloque cortado por el borde** del contenedor que se desplaza: crece desde la parte visible.
- **Repeticiones**: se comportan como cualquier bloque. Al cerrar, el detalle vuelve al bloque de esa misma repetición.
- **Cambio de otra persona en tiempo real** mientras el detalle está abierto: al cerrar, el detalle vuelve a la posición nueva del bloque o, si ya no está, sale con su salida normal (RF-58). "Otra persona ha borrado este evento" se sigue avisando como hoy.
- **Rutas ocultas por Activity** (spec 008): una vista o ventana que vuelve a mostrarse sin cambios no repite su entrada ni su escalonado.
- **Cambiar de tema varias veces seguidas**: cada pulsación empieza un revelado nuevo desde el estado que se ve en ese momento (RF-63).
- **Avisos seguidos**: el nuevo entra mientras sale el anterior (RF-52) y el "Deshacer" llega 50 ms después (RF-19).
- **Deslizar el calendario con un diálogo, el cajón o la hoja abiertos**: no mueve la vista (spec 016).
- **Arrastrar un evento cerca del borde de la rejilla**: sigue el autodesplazamiento de la spec 017, sin goma.
- **Pantallas de 769 a 1023 px**: el detalle es la tarjeta junto al evento (spec 019) y la barra inferior se queda como está.
- **Teclado**: abrir un evento con Intro también lo transforma desde su bloque. Un desplegable abierto con el teclado crece desde el foco (RF-10).
- **Pulsar con el ratón o con el dedo**: la reducción al 97 % es la misma con los dos. El paso del puntero por encima sigue solo con ratón (spec 011).

## Fuera de alcance

- Los desplegables nativos del sistema (`select`, selector de fecha del navegador): los dibuja el sistema y no se pueden animar.
- Escalonar los eventos de las vistas mes, semana, día y agenda.
- Animar los cambios que llegan de otras personas en tiempo real, salvo lo que dice el caso límite del detalle abierto.
- Ver el periodo contiguo mientras se desliza el calendario: el hueco que deja la vista bajo el dedo muestra el fondo, y el periodo nuevo entra al soltar (RF-28).
- Abrir el cajón deslizando desde el borde izquierdo: choca con el gesto de "atrás" de iOS y Android.
- Convertir en interruptores las casillas de los formularios que se envían con un botón (por ejemplo, "Todo el día") o las de los filtros del calendario.
- Sonidos y vibración.
- Librerías de animación, físicas de muelle con rebote, parallax y animaciones ligadas al desplazamiento.
- Transiciones entre pantallas del panel que no sean el calendario (por ejemplo, de Ajustes a "Mis calendarios").
- Cambiar colores, tipografía, iconos, disposición o textos.

## Enmienda 8 de la constitución (propuesta)

Aprobada por el usuario el 2026-11-07 para los recortes. Se aplica a `docs/constitution.md` cuando se apruebe esta spec. Cambia el punto **Movimiento** de "Tipografía, forma y espacio" a:

> - **Movimiento** (enmiendas 3 y 8): microinteracciones en botones y controles (pulsar, pasar por encima, foco), apertura y cierre de ventanas, hojas y desplegables, y transiciones al cambiar de vista, de periodo, de calendario visible y de tema. Cada animación dura como mucho 400 ms y solo anima `transform`, `opacity`, `filter` o un recorte (`clip-path`). El recorte solo se usa para revelar contenido o un cambio de color. Ninguna animación de uso diario rebota más allá de su valor final; la única excepción es el pulso que confirma un guardado. Con `prefers-reduced-motion: reduce`, cada animación se sustituye por un cambio inmediato o un fundido.

Y añade a "Dudas abiertas":

> - Enmienda 8 (2026-11-07, aprobada por el usuario con la spec 021): animar recortes (`clip-path`) para revelar contenido y cambios de color, y ninguna animación con rebote salvo el pulso de confirmación.

## Criterios de finalización

- RF-1 a RF-68 con su test o su comprobación manual en verde.
- Guardia de diseño actualizada: tokens de movimiento, sin curvas con rebote y sin duraciones de más de 400 ms.
- Enmienda 8 aplicada en `docs/constitution.md`.
- Prueba manual en un móvil real (iPhone en producción, como la 016) y en el ordenador con ratón y con teclado: desplegables, transformación evento → detalle, seguir al dedo con goma, interruptor, selector de vista, cambio de tema y pulso.
- Capturas a 390, 768 y 1440 px en los dos temas con el acento rojo y el amarillo, y revisión con movimiento reducido.
- Medida de rendimiento de RNF con la CPU ralentizada 4 veces, con la salida reportada.
- Verificación obligatoria completa con la salida reportada.
- Aprobación del usuario para cerrar la spec.

## Dudas abiertas

- Ninguna bloqueante. Decisiones del usuario del 2026-11-07: enmienda 8 para los recortes, interruptor propio en Ajustes, transformación evento → detalle en la tarjeta, la hoja y la ventana, seguir al dedo en la vista, el cajón, la hoja y el visor, y escalonado solo en menús y listas.
