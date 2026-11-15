# Spec 027 — Venito y el chat del asistente

> Estado: **En curso** (2026-11-15). Aprobada de antemano por el usuario en el prompt de arranque (2026-11-15). Cuarta spec del encargo de rediseño. Sin migraciones ni dependencias.

## Contexto y objetivo

El asistente (specs 015, 022 y 024) gana cara y nombre: **Venito**, una foca pequeña vista de frente, mascota de CaFam. El chat pasa a parecerse a una conversación de WhatsApp y se abre **sin navegar**, desde el botón de Venito, en cualquier pantalla. No cambia nada de lo que el asistente sabe hacer ni sus garantías.

## Venito

- Dibujo **propio en SVG** (`components/brand/venito.tsx`), sin imágenes externas: cabeza redonda gris azulada, hocico claro, ojos grandes con brillo, nariz y bigotes, y dos aletas. Reconocible a 40 px (a ese tamaño se simplifica solo: los bigotes y los brillos son los únicos detalles finos).
- **Expresiones** (`mood`): `idle` (reposo), `wave` (saluda con una aleta), `thinking` (mira arriba, ladea la cabeza; "buscando en tu calendario"), `happy` (ojos en arco y mofletes; hecho), `confused` (un ojo entornado, boca torcida e interrogación; error) y `sleeping` (ojos cerrados y "z"; sin cuota).
- **Colores como tokens** (`seal`, `seal-light`, `seal-dark`, `seal-blush`) con valor en los dos temas; no sigue el acento.
- **Animaciones** solo de `transform` y `opacity`: parpadeo, ladeo de cabeza al pensar y aleta al saludar. Cada gesto dura menos de 400 ms dentro de un ciclo largo. Con `prefers-reduced-motion`, quieto.
- Es decorativo para los lectores de pantalla salvo cuando es el único contenido de un botón, que lleva su nombre.
- Aparece en: el botón del asistente, la cabecera y los mensajes del chat, la conversación vacía, el estado sin cuota, los errores del chat, los estados vacíos (`EmptyState`), las páginas de error y la pantalla sin conexión.

## Botón y panel

- El botón está en la **esquina inferior derecha** de todas las pantallas del panel, por encima de la barra inferior (y de la barra del calendario): es **la cara de Venito**, con nombre accesible "Venito, tu asistente".
- Pulsarlo abre el chat **en el sitio**, sin cambiar de página: en el móvil ocupa la pantalla y crece desde el botón (se "asoma"); desde 769 px es un panel flotante de 26 rem anclado a esa esquina. Se cierra con su botón, con Escape, tocando fuera (escritorio) o **deslizando la cabecera hacia abajo** (móvil). El foco vuelve al botón.
- Mientras responde con el panel cerrado, el botón lo indica: Venito pensando y un punto de actividad; al llegar la respuesta, un punto de "nuevo" hasta que se abre.
- La conversación vive **solo en memoria**, en el panel: sigue ahí al cambiar de pantalla mientras la app esté abierta, y se pierde al recargar, cerrar sesión o pulsar "Nueva conversación". No se guarda nada nuevo (privacidad sin cambios).
- `/dashboard/assistant` se conserva como dirección: muestra el mismo chat a página completa.

## Chat

- **Cabecera**: avatar de Venito, "Venito" y su estado ("en línea", "escribiendo…", "descansando hasta mañana"), "Nueva conversación" y "Cerrar".
- **Mensajes** en burbujas: los del usuario a la derecha en el acento; los de Venito a la izquierda en blanco con su avatar; **hora** en cada uno; fondo con una textura sutil de tokens.
- **Escribiendo…**: una burbuja de Venito con tres puntos y el paso real que llega del servidor (024), anunciado a los lectores de pantalla, con "Cancelar".
- **Barra de entrada** anclada abajo, que sube con el teclado (el panel mide el alto visible, `visualViewport`): adjuntar imagen, campo que crece de una a cuatro líneas (16 px) y botón redondo de enviar. Las miniaturas de las imágenes adjuntas van encima, con "Quitar".
- Desplazamiento automático al último mensaje.
- **Se conserva todo**: eventos citados que abren su detalle, "Reintentar", cuota diaria, enlace a `/privacy`, hasta 3 imágenes y la **tarjeta de propuesta** de eventos (022) como mensaje especial de Venito dentro del hilo. Nada se crea sin pulsar "Crear".

## Sugerencias

Chips sobre la barra de entrada, con desplazamiento horizontal y 44 px de alto, que cambian con el contexto:

| Contexto | Sugerencias |
|----------|-------------|
| Conversación vacía | ¿Qué tengo hoy? · ¿Qué tengo esta semana? · ¿Cuándo estamos todos libres? · Buscar un evento · Crear eventos desde una foto · ¿Qué se ha comentado últimamente? |
| Tras una respuesta | ¿Y mañana? · ¿Qué tardes tengo libres esta semana? · Buscar un evento |
| Con una imagen adjunta | Crea estos eventos · Solo los turnos de… · Es el horario de la semana que viene |

- **Decisión**: un chip que ya es una pregunta completa **se envía** al tocarlo (un toque, una respuesta). Los que necesitan un dato **rellenan el campo** y dejan el cursor al final ("Busca el evento ", "Solo los turnos de "). "Crear eventos desde una foto" abre el selector de imagen.
- Con la cuota agotada o mientras responde, los chips se desactivan.

## Requisitos funcionales

- RF-1 `Venito` con seis expresiones, tokens propios en los dos temas y animaciones que respetan `prefers-reduced-motion`.
- RF-2 Botón de Venito en la esquina inferior derecha de todo el panel; abre y cierra el panel del chat sin navegar; foco, Escape, fondo inerte y devolución del foco; indicador de actividad y de respuesta nueva.
- RF-3 La conversación persiste entre pantallas mientras la app está abierta y solo en memoria.
- RF-4 Chat con cabecera, burbujas con hora, indicador de escritura con el progreso real, barra de entrada anclada que sube con el teclado y desplazamiento al último mensaje.
- RF-5 Sugerencias contextuales según la tabla, con sus tres comportamientos (enviar, rellenar, adjuntar).
- RF-6 Se mantienen todas las funciones y garantías de las specs 015, 022 y 024 (tests existentes, actualizados donde cambian los textos o la estructura).
- RF-7 Venito en `EmptyState`, las páginas de error y la pantalla sin conexión.
- RF-8 Textos cercanos y breves; Venito se presenta por su nombre. El prompt del modelo y las herramientas **no cambian**.

## Requisitos no funcionales

- RNF-1 Abrir el chat: campo visible en menos de 300 ms (objetivo de la 024), ahora sin petición de navegación.
- RNF-2 El JS del chat no entra en la carga inicial de las pantallas: se carga en reposo o al abrir.
- RNF-3 Accesible: nombres, `role="log"`, estado anunciado, teclado completo, contraste AA en los dos temas.

## No ejecutado

`npm run eval:assistant` y `npm run eval:schedule`: no hay clave de Groq en esta sesión y, además, el prompt y las herramientas no cambian (solo la interfaz), así que no procede gastar cuota.

## Criterios de aceptación

- CA-1 P8 en verde.
- CA-2 Capturas del chat (vacío, con respuesta y eventos citados, escribiendo) a 390 y 1440 px, en claro y oscuro; y de las seis expresiones de Venito.
- CA-3 `measure.mjs`: abrir el chat por debajo de 300 ms.
