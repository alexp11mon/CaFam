# Spec 005 — Identidad visual

> Estado: **Aprobada** por el usuario (2026-10-22). Constitución: `docs/constitution.md` (P9 y sección "Identidad visual y diseño de interfaz"). Parte de las specs 001 a 004 (cerradas).
> Decisiones de la entrevista (2026-10-22): el acento se guarda por usuario y se ve igual en todos sus dispositivos; se añade una vista de agenda de 14 días; la app pasa a un marco fijo (escritorio) y a una barra inferior (móvil); se añade el bloque "Próximo evento"; el rediseño alcanza también las páginas sin sesión y el icono de la app.
> Esta spec **amplía el alcance**: la vista de agenda figuraba como fuera de alcance en la spec 002 y en `AGENTS.md`. Al aprobarla se actualiza `AGENTS.md` (§11).

## Contexto y objetivo

CalenderFam ya hace lo que tiene que hacer (calendarios, eventos, compartir, importar), pero su aspecto es la plantilla por defecto: azul sobre blanco y cada pantalla como una página suelta con enlaces. Esta spec le da una identidad propia, sobria y editorial, definida en la constitución a partir de una imagen de referencia: fondo piedra, tinta casi negra, el número del día enorme como protagonista y un único color de acento que cada persona elige entre seis. Además reorganiza la forma de moverse por la app (un marco fijo con mini calendario y personas en escritorio, una barra inferior en móvil), añade la vista de agenda que da sentido al número gigante y un bloque con el próximo evento. Se hace antes de la gestión de cuenta (spec 006) para que sus pantallas nazcan ya con el estilo nuevo. Todo lo que hoy funciona tiene que seguir funcionando igual.

## Usuarios / actores

- **Usuario con sesión:** cualquier persona registrada, sea Propietario, Editor o Lector de sus calendarios. Elige su acento y usa el marco, la agenda y el próximo evento.
- **Visitante sin sesión:** ve la portada, el login, el registro, la invitación y la pantalla sin conexión, siempre con el acento por defecto (rojo).

## Historias de usuario

- H1: Como usuario quiero una app con un aspecto propio y coherente en todas sus pantallas para que se sienta como un producto y no como una plantilla.
- H2: Como usuario quiero elegir el color de acento entre seis para que la app se sienta mía, y verlo igual en el móvil y en el ordenador.
- H3: Como usuario quiero ver de un vistazo los próximos 14 días seguidos, con los días libres incluidos, para organizarme.
- H4: Como usuario de escritorio quiero tener siempre a mano el mini calendario y las personas para saltar de fecha y filtrar sin cambiar de pantalla.
- H5: Como usuario de móvil quiero una barra inferior con lo principal y crear un evento con un toque.
- H6: Como usuario quiero ver cuánto falta para mi próximo evento sin buscarlo.
- H7: Como usuario que instala la app quiero que su icono y su barra de sistema tengan la nueva identidad.
- H8: Como usuario con baja visión o que navega con teclado quiero que el nuevo diseño siga siendo legible y usable.

## Requisitos funcionales (criterios de aceptación en EARS)

### Identidad en todas las pantallas

- RF-1: EL SISTEMA mostrará todas las pantallas existentes (portada, login, registro, panel y calendarios, vistas de calendario, alta y detalle de eventos, categorías, juntar, compartir, miembros, unirme con código, importar, invitación y sin conexión) con la identidad visual de la constitución.
- RF-2: EL SISTEMA conservará todo el comportamiento de las specs 001 a 004 (mismos datos, permisos, validaciones, mensajes y flujos).
- RF-3: EL SISTEMA usará el color de acento solo para marcar el día de hoy, la hora actual, las abreviaturas de los días de la semana, el elemento seleccionado y el bloque "Próximo evento".
- RF-4: EL SISTEMA mostrará el color de cada calendario o categoría como marca junto al evento (barra, punto o borde), con el texto del evento siempre en tinta.
- RF-5: EL SISTEMA marcará el día de hoy también con un recurso que no sea el color (relleno, peso o forma).

### Color de acento

- RF-6: EL SISTEMA ofrecerá en una pantalla de Ajustes la elección del acento entre rojo, azul, verde, amarillo, morado y gris, con una muestra de cada uno y su nombre.
- RF-7: CUANDO el usuario elige un acento, EL SISTEMA lo aplicará a la interfaz sin recargar la página.
- RF-8: CUANDO el usuario elige un acento, EL SISTEMA lo guardará en su cuenta.
- RF-9: CUANDO el usuario abre la app en cualquier dispositivo con su sesión, EL SISTEMA mostrará el acento guardado desde la primera pantalla, sin un destello del acento por defecto.
- RF-10: SI el usuario no ha elegido nunca un acento, ENTONCES EL SISTEMA usará el rojo.
- RF-11: MIENTRAS no hay sesión, EL SISTEMA usará el rojo.
- RF-12: SI no se puede guardar el acento, ENTONCES EL SISTEMA volverá a mostrar el acento anterior y explicará que no se ha guardado.
- RF-13: EL SISTEMA solo permitirá a cada usuario leer y cambiar su propio acento.
- RF-14: EL SISTEMA garantizará con cada uno de los seis acentos un contraste de 4,5:1 en el texto y de 3:1 en marcas y líneas, sobre las superficies donde se usa.

### Marco de la aplicación

- RF-15: CUANDO un usuario inicia sesión o abre la app con sesión, EL SISTEMA mostrará como pantalla de inicio el calendario en vista agenda empezando hoy.
- RF-16: MIENTRAS el ancho sea de 1024 px o más, EL SISTEMA mostrará en todas las pantallas con sesión una barra lateral estrecha con la marca de la app y accesos a Calendario, Mis calendarios, Unirme con código, Importar calendario, Ajustes y Cerrar sesión.
- RF-17: MIENTRAS el ancho sea de 1024 px o más y se esté en la pantalla de calendario, EL SISTEMA mostrará un panel con el mini calendario mensual, el bloque "Próximo evento" y los filtros por persona, calendario y categoría.
- RF-18: MIENTRAS el ancho sea menor de 1024 px, EL SISTEMA mostrará una barra inferior fija con accesos a Calendario, Mis calendarios y Más (Unirme con código, Importar calendario, Ajustes y Cerrar sesión), y la acción "+ Evento" destacada en el centro.
- RF-19: MIENTRAS el ancho sea menor de 1024 px, EL SISTEMA ofrecerá el mini calendario y los filtros desde la pantalla de calendario en un panel que se abre y se cierra.
- RF-20: EL SISTEMA marcará en la barra lateral y en la barra inferior la sección en la que está el usuario.
- RF-21: EL SISTEMA mantendrá la lista de calendarios del panel actual (orden guardado, crear, editar, categorías, compartir, miembros y juntar) en la pantalla "Mis calendarios".
- RF-22: CUANDO el usuario pulsa "+ Evento", EL SISTEMA abrirá el alta de evento con las mismas reglas de permisos de la spec 002.

### Mini calendario

- RF-23: EL SISTEMA mostrará en el mini calendario un mes con las semanas empezando en lunes y el día de hoy marcado con el acento.
- RF-24: EL SISTEMA mostrará bajo cada día con eventos visibles hasta tres puntos, uno por calendario, con el color de cada calendario.
- RF-25: CUANDO el usuario pulsa un día del mini calendario, EL SISTEMA mostrará la vista actual del calendario en esa fecha.
- RF-26: CUANDO el usuario cambia de mes en el mini calendario, EL SISTEMA mostrará ese mes sin cambiar la vista principal.

### Personas

- RF-27: EL SISTEMA mostrará a cada persona del filtro como un avatar circular con sus iniciales sobre un tinte pálido propio y su nombre.
- RF-28: EL SISTEMA asignará a cada persona el mismo tinte en todas las pantallas y dispositivos del usuario.
- RF-29: CUANDO el usuario pulsa una persona del filtro, EL SISTEMA mostrará u ocultará sus calendarios, guardando la visibilidad como en la spec 002.

### Vista agenda

- RF-30: EL SISTEMA ofrecerá la vista agenda junto a las vistas mensual, semanal y diaria.
- RF-31: EL SISTEMA mostrará en la vista agenda 14 días seguidos desde la fecha de inicio, incluidos los días sin eventos.
- RF-32: EL SISTEMA encabezará cada día de la agenda con su número a gran tamaño y la abreviatura del día de la semana en el acento.
- RF-33: EL SISTEMA anunciará a los lectores de pantalla cada día de la agenda con la fecha completa (p. ej. "miércoles, 3 de mayo de 2026").
- RF-34: EL SISTEMA mostrará los eventos de cada día ordenados con los de día completo primero y después por hora de inicio.
- RF-35: EL SISTEMA mostrará en cada evento con hora su hora de inicio, su hora de fin, la marca de color, el título y el lugar si lo tiene.
- RF-36: EL SISTEMA mostrará un evento de varios días en cada uno de los días que ocupa dentro del rango.
- RF-37: SI un día de la agenda no tiene eventos visibles, ENTONCES EL SISTEMA mostrará "Sin eventos" en ese día.
- RF-38: DONDE el usuario pueda crear eventos en al menos un calendario, EL SISTEMA ofrecerá en cada día de la agenda crear un evento en esa fecha.
- RF-39: MIENTRAS hoy esté dentro del rango, EL SISTEMA mostrará en el día de hoy una línea en el acento con la hora actual, situada entre los eventos ya empezados y los siguientes.
- RF-40: CUANDO el usuario pide los 14 días siguientes o anteriores, EL SISTEMA mostrará el rango contiguo.
- RF-41: CUANDO el usuario pulsa "Hoy", EL SISTEMA mostrará la agenda empezando hoy.
- RF-42: CUANDO el usuario pulsa un evento de la agenda, EL SISTEMA abrirá su detalle.
- RF-43: EL SISTEMA aplicará a la agenda los mismos filtros, zona horaria del perfil y convención de días completos que a las demás vistas.
- RF-44: SI una fecha de inicio pedida para la agenda no es válida, ENTONCES EL SISTEMA mostrará la agenda empezando hoy, como hacen las demás vistas.

### Próximo evento

- RF-45: EL SISTEMA mostrará en la pantalla de calendario un bloque "Próximo evento" con el siguiente evento con hora, aún no empezado, de los calendarios visibles, que empiece en las próximas 24 horas.
- RF-46: EL SISTEMA mostrará en el bloque el título, la hora de inicio, el calendario y el tiempo que falta (p. ej. "en 25 min", "en 3 h 10 min").
- RF-47: MIENTRAS la pantalla está abierta, EL SISTEMA actualizará el tiempo que falta al menos una vez por minuto, sin recargar.
- RF-48: CUANDO el evento mostrado empieza, EL SISTEMA pasará al siguiente que cumpla RF-45 sin recargar.
- RF-49: SI no hay ningún evento que cumpla RF-45, ENTONCES EL SISTEMA mostrará en el bloque "Nada en las próximas 24 horas".
- RF-50: CUANDO el usuario pulsa el bloque, EL SISTEMA abrirá el detalle del evento.

### Marca e instalación

- RF-51: EL SISTEMA mostrará una marca nueva (logotipo e icono) en negro y piedra en la portada, las pantallas de acceso y el marco de la app.
- RF-52: EL SISTEMA usará el icono nuevo como favicon, icono de la app instalada (incluidos el adaptable de Android y el de iOS) y en la pantalla sin conexión.
- RF-53: EL SISTEMA usará el color piedra del fondo como color de la barra del sistema en la app instalada.
- RF-54: CUANDO se publica la nueva versión, EL SISTEMA hará que las apps ya instaladas dejen de usar los recursos antiguos guardados sin que el usuario tenga que reinstalar.

## Requisitos no funcionales

- Accesibilidad (P9): WCAG 2.2 AA en todas las pantallas con los seis acentos: texto 4,5:1, marcas y controles 3:1, objetivos táctiles de al menos 44 px, foco visible, todo usable con teclado y animaciones reducidas con `prefers-reduced-motion`.
- Mobile-first (P5): sin scroll horizontal entre 360 y 1920 px; revisión con capturas a 390, 768 y 1440 px de cada pantalla.
- Rendimiento: la vista agenda con 500 eventos en sus 14 días se abre en menos de 3 s en una conexión 4G, el mismo umbral que las vistas de la spec 002.
- Privacidad (P3): el acento es un dato privado de cada usuario; el service worker sigue sin cachear HTML con sesión ni datos.
- Coste cero (P2) y stack cerrado (P6): sin servicios nuevos; tipografía e iconos sin librerías nuevas salvo aprobación explícita en el plan.
- Idioma: todo texto visible en español, incluidos los nombres de los acentos y el tiempo que falta.

## Casos límite

- Un evento que cruza la medianoche aparece en los dos días de la agenda (RF-36), y en el segundo no se presenta como si empezara a las 00:00 sin aclararlo.
- Un evento con hora que ya ha empezado y sigue en curso no es el "Próximo evento" (RF-45), pero sí aparece antes de la línea de la hora actual en la agenda.
- El usuario oculta todas las personas o calendarios: la agenda muestra los 14 días con "Sin eventos" y el próximo evento dice "Nada en las próximas 24 horas".
- Un Lector sin ningún calendario editable: no ve "crear en este día" (RF-38) y "+ Evento" se comporta como hoy en la spec 002.
- El usuario cambia el acento en dos dispositivos a la vez: queda el último guardado y el otro dispositivo lo muestra al cargar la siguiente pantalla.
- Acento amarillo: nunca se usa como color de texto sobre el fondo claro; el texto encima de un relleno amarillo va en tinta (RF-14).
- Dos personas con las mismas iniciales: tienen tintes distintos y su nombre visible las distingue.
- Un nombre que empieza por un número o un símbolo: el avatar muestra el primer carácter visible sin fallar.
- Un título de evento muy largo: se corta con puntos suspensivos sin romper la fila ni ocultar la hora.
- Un día con más de 20 eventos: la agenda los muestra todos sin solaparlos.
- La pantalla del próximo evento se deja abierta horas o el dispositivo se suspende: al volver, el tiempo y el evento son los correctos (RF-47, RF-48).
- El cambio de hora (horario de verano) dentro de los 14 días: cada evento sigue a su hora en la zona del perfil.
- Un móvil de 360 px con el número gigante: la fecha y los eventos caben sin scroll horizontal.

## Fuera de alcance

- Tema oscuro.
- Más acentos, un color libre o personalizar fondo, tipografía o densidad.
- Notificaciones, avisos o sonidos del próximo evento.
- Recordar la última vista elegida entre sesiones.
- Fotos de perfil (los avatares son de iniciales) y editar el nombre o el perfil (spec 006).
- Cambiar la paleta de colores de los calendarios de la spec 002.
- Arrastrar y soltar eventos, búsqueda, eventos recurrentes propios.
- Lo que la referencia muestra y la app no tiene: asistente de IA, tareas, notas de voz, temporizador, documentos, integraciones y videollamadas.
- Animaciones de entrada; el movimiento es solo respuesta a una acción.
- Gestión de cuenta (spec 006) y OAuth (spec 007).

## Criterios de finalización

- Todos los RF tienen test en verde (unitario, de componente o de base de datos según corresponda) y el checklist de verificación obligatoria pasa completo, incluidos los tests de las specs 001 a 004.
- Capturas a 390, 768 y 1440 px de cada pantalla, revisadas contra la sección "Identidad visual y diseño de interfaz" de la constitución, con el contraste comprobado en los seis acentos.
- Demo manual en producción, en móvil y escritorio: iniciar sesión y llegar a la agenda, avanzar y volver 14 días, saltar de fecha con el mini calendario, filtrar por persona, crear un evento desde un día vacío, ver la cuenta atrás del próximo evento, cambiar el acento en el móvil y verlo en el ordenador, e instalar la app con el icono nuevo.
- Las migraciones, si las hay, están aplicadas en dev y en prod.
- `AGENTS.md` actualizado (la vista agenda deja de estar fuera de alcance).
- El usuario aprueba el cierre de la spec.

## Dudas abiertas

- Pendientes para el plan, no para esta spec: la familia tipográfica, los valores exactos de los seis acentos con su contraste medido y el diseño del logotipo e icono (el plan los presenta para aprobación del usuario).
