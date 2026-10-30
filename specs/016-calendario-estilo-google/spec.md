# Spec 016 — Calendario al estilo Google Calendar en el móvil

## Contexto y objetivo

En el móvil, el calendario de CaFam no se ve como el usuario quiere. Los eventos son filas de texto con una barra de color, la agenda avanza de 14 en 14 días con flechas y la navegación vive en una barra inferior. El usuario usa Google Calendar a diario y quiere que CaFam **se le parezca lo máximo posible**. Ha aportado cuatro capturas de la app de Google en iOS con las vistas mes, semana, día y agenda (2026-10-30). Esta spec cambia el **aspecto** y la **navegación** del calendario. No cambia los datos ni los permisos. Se hace antes de la 013.

Ya se acordó en la entrevista:

- Los eventos pasan a ser **bloques rellenos** del color pastel en las cuatro vistas. Hace falta una enmienda de P9.
- En el móvil, la navegación pasa a ser la de Google: cabecera arriba, cajón lateral y botón flotante "+".
- Los bloques rellenos valen también en el escritorio, que conserva su marco actual.
- Se añaden tres cosas más: deslizar para cambiar de periodo, una agenda continua y una fila de meses en la vista mes.
- Mover o redimensionar eventos arrastrando y el menú contextual para cambiar el color irán en una spec aparte (017).

Se toma de Google **solo la composición y el comportamiento**. No se copian sus imágenes, iconos ni colores: CaFam conserva sus tokens, sus seis acentos, sus temas claro y oscuro, la tipografía Inter Tight y la paleta pastel.

## Usuarios / actores

- **Usuario con sesión en el móvil** (≤ 768 px): el destinatario principal.
- **Usuario con sesión en el escritorio**: ve los eventos como bloques rellenos y la agenda nueva, con el marco actual.

## Historias de usuario

- H1: Como usuario de Google Calendar quiero que CaFam se vea como él en el móvil, para entenderlo sin aprender nada nuevo.
- H2: Como usuario quiero distinguir los eventos de un vistazo por su color de relleno.
- H3: Como usuario del móvil quiero cambiar de mes, semana o día deslizando el dedo.
- H4: Como usuario quiero recorrer la agenda hacia delante y hacia atrás sin pulsar botones.
- H5: Como usuario del móvil quiero que el calendario ocupe toda la pantalla, con la navegación en un cajón.

## Requisitos funcionales (criterios de aceptación en EARS)

### Eventos como bloques (todas las anchuras)

- RF-1: EL SISTEMA pintará cada evento, en las vistas mes, semana, día y agenda, como un bloque relleno con el color del evento o, si no tiene, el de su calendario.
- RF-2: EL SISTEMA escribirá el texto de los bloques en tinta oscura y en negrita para el título, en los dos temas.
- RF-3: EL SISTEMA mantendrá un contraste de al menos 4,5:1 entre el texto del bloque y cada color de la paleta pastel.
- RF-4: EL SISTEMA mantendrá en los bloques el icono de los eventos con imágenes (spec 012) con las mismas condiciones de tamaño que hoy.
- RF-5: EL SISTEMA no dependerá solo del color para distinguir los eventos: el título siempre es visible en el bloque, aunque esté recortado.

### Cabecera y navegación del móvil (≤ 768 px)

- RF-6: MIENTRAS la anchura sea de 768 px o menos, EL SISTEMA mostrará en todas las pantallas del panel una cabecera superior con el botón de menú (≡), el título de la pantalla, el botón "Hoy" y el avatar del usuario.
- RF-7: MIENTRAS la anchura sea de 768 px o menos, EL SISTEMA no mostrará la barra inferior.
- RF-8: MIENTRAS se esté en el calendario, EL SISTEMA mostrará en la cabecera, como título, el nombre del mes de la fecha visible, con una flecha que indica que se despliega.
- RF-9: EL SISTEMA mostrará el botón "Hoy" de la cabecera con el número del día de hoy dentro de un icono de calendario.
- RF-10: CUANDO el usuario pulse "Hoy", EL SISTEMA llevará la vista actual a la fecha de hoy.
- RF-11: CUANDO el usuario pulse el avatar, EL SISTEMA abrirá Ajustes.
- RF-12: CUANDO el usuario pulse el botón de menú, EL SISTEMA abrirá un cajón lateral desde la izquierda.
- RF-13: EL SISTEMA mostrará en el cajón, por este orden: las cuatro vistas (Agenda, Día, Semana, Mes) con la actual marcada, los filtros de calendarios (con personas, grupos y categorías, como hoy) y los destinos Mis calendarios, Unirme, Importar, Cuentas conectadas y Ajustes, el acceso directo del tema y Cerrar sesión.
- RF-14: CUANDO el usuario elija una vista o un destino en el cajón, EL SISTEMA cerrará el cajón y mostrará lo elegido.
- RF-15: CUANDO el usuario pulse fuera del cajón, pulse Escape o lo deslice hacia la izquierda, EL SISTEMA lo cerrará.
- RF-16: MIENTRAS el cajón esté abierto, EL SISTEMA mantendrá el foco del teclado dentro de él y lo devolverá al botón de menú al cerrarlo.
- RF-17: MIENTRAS se esté en el calendario con una anchura de 768 px o menos, EL SISTEMA mostrará abajo a la derecha un botón flotante "+" que abre el alta de evento, como hoy "+ Evento".
- RF-18: SI el usuario no puede crear eventos en ningún calendario, ENTONCES EL SISTEMA no mostrará el botón flotante "+".
- RF-19: MIENTRAS la anchura sea de 768 px o menos, EL SISTEMA no mostrará en el calendario la barra de herramientas actual de la vista (selector de vista, anterior, siguiente y hoy) ni la tarjeta "Próximo evento".

### Selector del título

- RF-20: CUANDO el usuario pulse el título del mes en la vista mes, EL SISTEMA mostrará u ocultará bajo la cabecera una fila desplazable de meses.
- RF-21: EL SISTEMA mostrará en la fila de meses los meses abreviados en orden, con el año escrito entre diciembre y enero, y el mes visible marcado.
- RF-22: CUANDO el usuario pulse un mes de la fila, EL SISTEMA mostrará ese mes en la vista mes.
- RF-23: CUANDO el usuario pulse el título del mes en las vistas agenda, semana o día, EL SISTEMA mostrará u ocultará un mini calendario mensual bajo la cabecera.
- RF-24: CUANDO el usuario pulse un día del mini calendario desplegado, EL SISTEMA llevará la vista actual a ese día y plegará el mini calendario.

### Deslizar para cambiar de periodo (pantallas táctiles)

- RF-25: CUANDO el usuario deslice el dedo horizontalmente sobre la vista mes, semana o día hacia la izquierda, EL SISTEMA mostrará el periodo siguiente.
- RF-26: CUANDO el usuario deslice el dedo horizontalmente sobre la vista mes, semana o día hacia la derecha, EL SISTEMA mostrará el periodo anterior.
- RF-27: SI el desplazamiento del dedo es más vertical que horizontal o no llega a 50 px, ENTONCES EL SISTEMA no cambiará de periodo.
- RF-28: MIENTRAS esté abierta la ventana rápida, la ventana de evento o el cajón, EL SISTEMA no cambiará de periodo al deslizar.
- RF-29: CUANDO cambie el periodo al deslizar, EL SISTEMA desplazará el contenido en el sentido del gesto con la transición de la spec 011, o sin ella con movimiento reducido.

### Vista mes

- RF-30: EL SISTEMA mostrará la vista mes como una rejilla de semanas que llena la altura disponible, con la fila de iniciales de los días (L M X J V S D) arriba.
- RF-31: EL SISTEMA marcará la inicial del día de la semana de hoy con el color de acento.
- RF-32: EL SISTEMA marcará el número de hoy con un círculo relleno del color de acento.
- RF-33: EL SISTEMA mostrará los días de fuera del mes visible con el número en el color secundario.
- RF-34: EL SISTEMA mostrará cada evento del día, con hora o sin ella, como un bloque relleno de una línea con su título recortado, sin la hora.
- RF-35: EL SISTEMA pintará los eventos de varios días como un bloque continuo que cruza los días que ocupa dentro de la semana.
- RF-36: SI los eventos de un día no caben en su celda, ENTONCES EL SISTEMA mostrará los que quepan y una última línea "+N" con el número de eventos ocultos.
- RF-37: CUANDO el usuario pulse "+N", EL SISTEMA abrirá la vista día de esa fecha.

### Vistas semana y día

- RF-38: EL SISTEMA mostrará sobre la rejilla horaria una cabecera fija con la inicial del día y su número grande, para cada día visible.
- RF-39: EL SISTEMA mostrará el número del día de hoy en un círculo relleno del color de acento, y su inicial en el color de acento.
- RF-40: EL SISTEMA mostrará los eventos de día completo y de varios días en una franja bajo la cabecera de los días, como bloques rellenos de una línea.
- RF-41: EL SISTEMA mostrará cada evento con hora como un bloque relleno de esquinas redondeadas que ocupa su intervalo, con el título en negrita y debajo el lugar.
- RF-42: SI el texto de un bloque con hora no cabe a lo ancho, ENTONCES EL SISTEMA lo partirá en varias líneas y recortará lo que no quepa a lo alto.
- RF-43: EL SISTEMA mostrará la hora actual en el día de hoy como una línea horizontal con un punto en su inicio, en el color de acento.
- RF-44: EL SISTEMA mostrará las horas de la columna izquierda en formato de 24 h ("9:00") y líneas horizontales finas en cada hora.
- RF-45: CUANDO se abra la vista semana o día en el día de hoy, EL SISTEMA desplazará la rejilla para que la hora actual quede visible.
- RF-46: EL SISTEMA mantendrá en semana y día la creación de eventos al pulsar una franja y al arrastrar con el ratón (spec 008).

### Vista agenda

- RF-47: EL SISTEMA mostrará la agenda como una lista continua de los días con eventos, sin botones de anterior y siguiente.
- RF-48: CUANDO el usuario llegue al final de la lista, EL SISTEMA cargará los días siguientes.
- RF-49: CUANDO el usuario llegue al principio de la lista, EL SISTEMA cargará los días anteriores sin mover lo que está viendo.
- RF-50: EL SISTEMA mostrará al empezar cada mes una banda alta con el nombre del mes en grande sobre un degradado suave de tokens, igual para todos los meses.
- RF-51: EL SISTEMA mostrará al empezar cada semana un separador con su intervalo ("2–8 de noviembre").
- RF-52: EL SISTEMA mostrará, a la izquierda de los eventos de cada día, la abreviatura del día de la semana y su número.
- RF-53: EL SISTEMA marcará el día de hoy con su número en un círculo relleno del color de acento y su abreviatura en el color de acento.
- RF-54: EL SISTEMA mostrará cada evento con hora como un bloque relleno con el título en negrita y debajo una línea "A las 11:15–14:15 en <lugar>", o "11:15–14:15" si no tiene lugar.
- RF-55: EL SISTEMA mostrará cada evento de día completo como un bloque relleno con solo el título.
- RF-56: SI una línea del bloque no cabe a lo ancho, ENTONCES EL SISTEMA la recortará con puntos suspensivos.
- RF-57: SI no hay ningún evento en una semana, ENTONCES EL SISTEMA mostrará su separador seguido de "Sin eventos".
- RF-58: CUANDO se abra la agenda o se pulse "Hoy" en ella, EL SISTEMA desplazará la lista hasta hoy o, si hoy no tiene eventos, hasta el primer día posterior con eventos.
- RF-59: CUANDO el usuario se desplace por la agenda, EL SISTEMA mostrará en la cabecera el mes del primer día visible.
- RF-60: EL SISTEMA aplicará esta agenda en todas las anchuras, también en el escritorio.

### Lo que no cambia

- RF-61: EL SISTEMA mantendrá en el escritorio (más de 768 px) el marco actual: barra lateral, panel con mini calendario, filtros y "Próximo evento" y barra de herramientas de la vista.
- RF-62: EL SISTEMA mantendrá sin cambios los atajos de teclado, la ventana de evento, la ventana rápida, la vista recordada, los filtros, los permisos y los calendarios de solo lectura.
- RF-63: EL SISTEMA aplicará la nueva composición en los dos temas y con los seis acentos.

## Requisitos no funcionales

- **Constitución:** antes de implementar hay que aprobar una enmienda de P9 ("Identidad visual") que:
  - sustituya "eventos como filas de texto, no como bloques de color" por bloques rellenos en las cuatro vistas;
  - quite el límite de una superficie de color pleno por pantalla para los bloques de evento;
  - cambie la composición del móvil (cabecera superior, cajón y botón flotante, sin barra inferior);
  - sustituya el número del día gigante de la agenda por la columna de día de Google;
  - permita la banda del mes de la agenda.
  
  La guardia de diseño se actualiza en consecuencia.
- **Sin dependencias nuevas** (P6): los gestos, el cajón y la lista continua se hacen con APIs del navegador.
- **Accesibilidad** (P9, WCAG 2.2 AA): cada acción de deslizar tiene también un control o atajo; los bloques se pueden enfocar y abrir con el teclado; objetivos táctiles de 44 px, salvo los bloques del mes, que se pueden pulsar en toda la celda del día; el cajón es un diálogo con nombre accesible.
- **Rendimiento:** la agenda continua no tiene más de 120 días cargados a la vez en el DOM. El desplazamiento y el deslizamiento van a 60 fps en un móvil de gama media.
- **Revisión visual:** capturas a 390, 768 y 1440 px de las cuatro vistas, en claro y oscuro, con el acento rojo y el amarillo, comparadas con las capturas de Google del usuario.

## Casos límite

- **Día del mes con muchos eventos:** se muestran los que caben y "+N" (RF-36). Nunca crece la celda ni aparece desplazamiento dentro de ella.
- **Evento de varios días que cruza dos semanas** en la vista mes: un bloque en cada semana.
- **Evento con hora que cruza la medianoche**: en semana y día se corta en cada día; en la agenda aparece en cada día que ocupa.
- **Eventos solapados** en semana y día: se reparten el ancho como hoy, sin taparse el título.
- **Bloques muy cortos** (menos de 30 min): solo el título en una línea.
- **Agenda sin ningún evento** en todo lo cargado: banda del mes, separadores de semana y "Sin eventos".
- **Deslizar sobre la franja de días completos o sobre la cabecera**: cambia de periodo igual.
- **Deslizar en el borde izquierdo en iOS**: el navegador puede usarlo para ir atrás. No se intenta bloquear.
- **Cambiar de anchura** (girar el móvil o redimensionar la ventana por encima o por debajo de 768 px): la interfaz cambia de composición sin perder la vista ni la fecha.
- **Pantallas del panel distintas del calendario en el móvil** (Mis calendarios, Ajustes…): cabecera con su título y el botón de menú, sin "Hoy" desplegable ni botón "+".
- **Evento de un calendario oculto por los filtros**: no aparece en ninguna vista, tampoco en "+N".

## Fuera de alcance

- Mover o redimensionar eventos arrastrando (con el dedo o con el ratón): spec 017.
- Menú contextual (clic derecho o pulsación larga) para cambiar el color de un evento: spec 017.
- Buscar eventos (Google tiene una lupa; CaFam no tiene búsqueda).
- Tareas (el "1 tarea pendiente" de Google), vistas de año, de 3 o 4 días y de horario personalizado.
- Ilustraciones por mes en la agenda o cualquier imagen copiada de Google.
- Cambiar el marco del escritorio al de Google Calendar web.
- Nuevos colores de calendario, colores intensos como los de Google o cambiar los tokens.
- Vibración al deslizar o al pulsar.

## Criterios de finalización

- RF-1 a RF-63 con su test o comprobación manual en verde.
- Enmienda de la constitución aprobada y guardia de diseño actualizada.
- Test de contraste de la paleta pastel con el texto de los bloques en los dos temas.
- Capturas de la revisión visual (ver requisitos no funcionales) y prueba en un iPhone real o en su emulación con gestos táctiles.
- Verificación obligatoria completa (P8) con la salida reportada.
- Aprobación del usuario para cerrar la spec.

## Dudas abiertas

- Ninguna bloqueante. Decisiones tomadas por defecto que el usuario puede cambiar al aprobar:
  - El avatar abre Ajustes (RF-11), porque CaFam no tiene cambio de cuenta.
  - La agenda nueva también se usa en el escritorio (RF-60), para no mantener dos agendas.
  - El botón "+" se pinta en tinta, como los botones primarios de CaFam, no en azul como en Google.
  - La tarjeta "Próximo evento" desaparece del móvil (RF-19).
