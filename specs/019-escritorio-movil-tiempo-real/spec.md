# Spec 019 — Escritorio, móvil y cambios al momento

> Estado: **Cerrada** (2026-11-02). Aprobada por el usuario el 2026-11-02; la enmienda 7 de la constitución se aplicó al aprobarla. Las migraciones `live_changes` y `profile_view_options` las aplica el usuario en prod.

## Contexto y objetivo

La auditoría de Google Calendar del 2026-11-02 (`analisis-google-calendar.md`, en esta carpeta) confirmó que CaFam ya iguala a Google en crear, mover, redimensionar, el menú contextual, "Deshacer" y los atajos de vista. En el día a día del ordenador quedan cuatro diferencias:

- el detalle de un evento abre una ventana centrada con fondo que tapa el calendario, mientras que Google abre una tarjeta pequeña junto al evento;
- la barra lateral no se puede plegar;
- no se pueden ocultar los fines de semana;
- la duración de un evento nuevo es siempre de 1 h.

En el móvil, el bloque provisional de un evento nuevo no se puede alargar antes de guardar. Además, lo que crea, cambia o borra otro familiar solo aparece al recargar o al volver a la pestaña tras 60 s. Esa es justo la queja que más repiten los usuarios de Google ("se pierden los cambios", el 12 % de las 510 reseñas analizadas). Esta spec cierra esas seis diferencias sin añadir servicios ni coste.

## Usuarios / actores

- **Cualquier miembro** de un calendario: ve la tarjeta de detalle, pliega la barra, oculta los fines de semana y ve los cambios de los demás al momento.
- **Propietario o Editor** (también de un calendario traído con escritura, specs 009 y 018): además, edita, duplica y borra desde la tarjeta, y crea eventos con la duración elegida.

## Historias de usuario

- H1: Como usuario del ordenador quiero ver un evento sin que se tape el calendario, para seguir viendo el resto de la semana.
- H2: Como usuario del ordenador quiero plegar la barra lateral, para que la rejilla ocupe todo el ancho.
- H3: Como usuario que solo usa el calendario entre semana quiero ocultar los sábados y domingos, para que los días laborables se vean más anchos.
- H4: Como usuario quiero elegir cuánto dura por defecto un evento nuevo, para no ajustarlo cada vez.
- H5: Como usuario del móvil quiero alargar o acortar el evento que estoy creando antes de guardarlo.
- H6: Como miembro de un calendario familiar quiero ver al momento lo que añade o cambia otro familiar, para no fiarme de un calendario desactualizado.
- H7: Como usuario que viene de Google quiero que la tecla C cree un evento, como allí.

## Requisitos funcionales (criterios de aceptación en EARS)

### Tarjeta de detalle (ordenador, desde 769 px)

- RF-1: CUANDO el usuario pulse un evento en cualquier vista a 769 px de ancho o más, EL SISTEMA abrirá una tarjeta de detalle junto al bloque pulsado en lugar de la ventana actual.
- RF-2: EL SISTEMA colocará la tarjeta a la derecha del bloque si cabe entera en la pantalla; si no cabe, a la izquierda; y si tampoco, encima o debajo.
- RF-3: MIENTRAS la tarjeta esté abierta, EL SISTEMA no oscurecerá ni bloqueará el resto del calendario.
- RF-4: EL SISTEMA mostrará en la tarjeta el color, el título, el día y las horas (o "Todo el día"), el resumen de la repetición si la hay, el lugar, el calendario y el autor.
- RF-5: DONDE el evento tenga descripción, EL SISTEMA mostrará en la tarjeta sus 3 primeras líneas.
- RF-6: DONDE el evento tenga imágenes o comentarios, EL SISTEMA mostrará en la tarjeta cuántos tiene de cada.
- RF-7: DONDE el usuario pueda editar el evento, EL SISTEMA ofrecerá en la tarjeta Editar, Duplicar y Borrar.
- RF-8: EL SISTEMA ofrecerá siempre en la tarjeta "Abrir", que muestra el detalle completo de hoy (con imágenes y comentarios), también a los Lectores.
- RF-9: CUANDO el usuario pulse Editar en la tarjeta, EL SISTEMA abrirá el formulario de edición actual con el evento.
- RF-10: CUANDO el usuario pulse Borrar en la tarjeta, EL SISTEMA borrará el evento con el aviso "Deshacer" de la spec 017 y cerrará la tarjeta.
- RF-11: CUANDO el usuario pulse Escape, el botón Cerrar o fuera de la tarjeta, EL SISTEMA cerrará la tarjeta.
- RF-12: CUANDO el usuario pulse otro evento con la tarjeta abierta, EL SISTEMA moverá la tarjeta a ese evento.
- RF-13: CUANDO se abra la tarjeta, EL SISTEMA pondrá el foco en ella; CUANDO se cierre, lo devolverá al evento que la abrió.
- RF-14: MIENTRAS la tarjeta esté abierta, EL SISTEMA atenderá en ella los atajos de detalle de la spec 017 (E edita, Supr borra, Ctrl+C copia).
- RF-15: CUANDO se abra un enlace al detalle de un evento o se recargue esa página, EL SISTEMA seguirá mostrando el detalle en página completa, como hoy.
- RF-16: Por debajo de 769 px, EL SISTEMA seguirá abriendo el detalle en la hoja inferior de la spec 017.

### Barra lateral plegable (desde 1024 px)

- RF-17: EL SISTEMA ofrecerá en la pantalla del calendario un botón para plegar y desplegar la barra lateral del calendario (mini calendario, próximo evento y filtros).
- RF-18: MIENTRAS la barra esté plegada, EL SISTEMA usará todo el ancho para la vista.
- RF-19: MIENTRAS la barra esté plegada, EL SISTEMA mostrará una flecha junto al título del periodo que despliega el mini calendario.
- RF-20: CUANDO el usuario elija un día en el mini calendario desplegado desde el título, EL SISTEMA irá a ese día y lo cerrará.
- RF-21: EL SISTEMA recordará en ese dispositivo si la barra está plegada.
- RF-22: EL SISTEMA dará al botón de plegar un nombre accesible que diga si plegará o desplegará la barra, y anunciará su estado con `aria-expanded`.

### Ocultar los fines de semana

- RF-23: EL SISTEMA ofrecerá en Ajustes la opción "Mostrar fines de semana", activada por defecto.
- RF-24: EL SISTEMA guardará la opción en la cuenta del usuario, para que valga en todos sus dispositivos.
- RF-25: MIENTRAS la opción esté desactivada, EL SISTEMA mostrará la vista semana de lunes a viernes, con las columnas repartidas en todo el ancho.
- RF-26: MIENTRAS la opción esté desactivada, EL SISTEMA mostrará la vista mes con cinco columnas, de lunes a viernes.
- RF-27: MIENTRAS la opción esté desactivada, EL SISTEMA no cambiará la vista día, la agenda ni el mini calendario.
- RF-28: MIENTRAS la opción esté desactivada, EL SISTEMA ofrecerá también ese interruptor en el cajón del móvil y en la barra de herramientas de vista del ordenador, para volver a mostrarlos sin ir a Ajustes.
- RF-29: SI un evento de varios días empieza o acaba en fin de semana con la opción desactivada, ENTONCES EL SISTEMA mostrará la parte que cae entre lunes y viernes.

### Duración predeterminada

- RF-30: EL SISTEMA ofrecerá en Ajustes la "Duración de un evento nuevo" con las opciones 15, 30, 45, 60, 90 y 120 minutos, con 60 por defecto.
- RF-31: EL SISTEMA guardará la duración en la cuenta del usuario.
- RF-32: CUANDO el usuario cree un evento con hora con un toque o un clic en un hueco, con "+", con N o C, o con el alta completa, EL SISTEMA propondrá como fin el inicio más la duración elegida.
- RF-33: SI el inicio más la duración pasa de las 23:59, ENTONCES EL SISTEMA dejará el fin a las 23:59, como hoy.
- RF-34: CUANDO el usuario cree arrastrando un intervalo, EL SISTEMA usará el intervalo arrastrado y no la duración elegida.

### Bloque provisional ajustable (móvil, hasta 768 px)

- RF-35: MIENTRAS la hoja de creación rápida esté abierta sobre la vista semana o día, EL SISTEMA mostrará un tirador en el borde inferior del bloque provisional.
- RF-36: CUANDO el usuario arrastre el tirador, EL SISTEMA cambiará la hora de fin en pasos de 15 minutos y la actualizará en la hoja.
- RF-37: CUANDO el usuario arrastre el bloque provisional, EL SISTEMA moverá el inicio en pasos de 15 minutos conservando la duración, y lo actualizará en la hoja.
- RF-38: SI el usuario intenta dejar el bloque provisional con menos de 15 minutos, ENTONCES EL SISTEMA lo dejará en 15 minutos.
- RF-39: CUANDO el usuario cambie las horas en la hoja, EL SISTEMA moverá o ajustará el bloque provisional para que coincidan.

### Cambios de los demás al momento

- RF-40: MIENTRAS la pantalla del calendario esté abierta y la pestaña visible, CUANDO otra persona o la sincronización con Google o iCloud cree, cambie o borre un evento de un calendario que el usuario puede ver, EL SISTEMA mostrará el cambio en la vista sin recargar la página.
- RF-41: EL SISTEMA mostrará el cambio en 5 segundos o menos desde que se guarda, en el 95 % de los casos.
- RF-42: EL SISTEMA aplicará también al momento los cambios de calendarios, como el nombre, el color, un miembro añadido o expulsado, y un calendario borrado o juntado.
- RF-43: SI el usuario está arrastrando, redimensionando o editando un evento que otra persona cambia, ENTONCES EL SISTEMA no interrumpirá lo que hace y aplicará el cambio ajeno al terminar.
- RF-44: SI el evento con la tarjeta o el detalle abiertos lo borra otra persona, ENTONCES EL SISTEMA cerrará la tarjeta o el detalle y avisará "Otra persona ha borrado este evento".
- RF-45: SI el usuario deja de ser miembro de un calendario mientras lo ve, ENTONCES EL SISTEMA dejará de mostrar sus eventos sin recargar.
- RF-46: SI se pierde la conexión de los cambios al momento, ENTONCES EL SISTEMA volverá a conectar sola y, al reconectar, actualizará la vista para recuperar lo que se perdió.
- RF-47: EL SISTEMA nunca enviará al navegador cambios de eventos o calendarios que el usuario no puede ver.
- RF-48: CUANDO llegue un cambio de otra persona, EL SISTEMA no mostrará ningún aviso emergente: solo cambiará la vista, y lo anunciará a los lectores de pantalla en la región `aria-live` del calendario.

### Atajo C

- RF-49: CUANDO el usuario pulse C sin modificadores, sin escribir y sin ninguna ventana abierta, EL SISTEMA hará lo mismo que N.
- RF-50: EL SISTEMA mostrará en la ayuda de atajos (?) N y C en la misma fila.

## Requisitos no funcionales

- Coste cero (P2): los cambios al momento se hacen con lo que ya incluye el plan gratuito de Supabase. Límites del plan Free: 200 conexiones a la vez y 2 millones de mensajes al mes. Para una familia y sus amigos (decenas de usuarios) es más que suficiente; el plan dirá cómo no pasarse.
- Privacidad (P3): lo que llega al navegador pasa por los mismos permisos que la lectura (RLS); los tests de base de datos lo comprueban con un usuario ajeno.
- Identidad visual (P9): la tarjeta es un elemento que flota (`glass-float`, `shadow-float`) y solo usa tokens; capturas a 390, 768 y 1440 px con los acentos rojo y amarillo, en claro y oscuro.
- Movimiento: la tarjeta entra y sale en 400 ms como mucho, con alternativa para `prefers-reduced-motion`.
- Accesibilidad: la tarjeta es un diálogo no modal con nombre (el título del evento); todo se puede hacer con el teclado; los botones miden al menos 44 px.
- Rendimiento: un cambio ajeno no recarga toda la vista; la tarjeta abre en 100 ms o menos tras el clic, con los datos que ya tiene la vista.

## Casos límite

- **Evento al borde de la pantalla** (último día de la semana, última hora visible): la tarjeta se coloca a la izquierda o encima (RF-2), y nunca se sale de la pantalla.
- **Ventana del navegador que se estrecha** por debajo de 769 px con la tarjeta abierta: se cierra.
- **Repetición sin fila propia**: la tarjeta la muestra como el detalle actual; Borrar pregunta el alcance de la spec 013 y, con "Solo este evento", ofrece "Deshacer".
- **Evento de un calendario traído de solo lectura**: la tarjeta no ofrece Editar ni Borrar y explica que viene de Google o iCloud.
- **Barra plegada en un ordenador y abierta en otro**: cada dispositivo recuerda la suya (RF-21).
- **Hoy es sábado** con los fines de semana ocultos: la semana muestra de lunes a viernes de la semana actual y "Hoy" sigue llevando a ella.
- **Evento de un solo día en sábado o domingo** con los fines de semana ocultos: no aparece en semana ni mes, pero sí en día, agenda y mini calendario.
- **Duración de 15 min** y toque a las 23:50: el fin se queda en 23:59.
- **Dos personas mueven el mismo evento a la vez**: gana el último guardado y los dos lo ven igual a los 5 s; el "Deshacer" de la spec 017 ya no pisa un cambio ajeno.
- **Muchos cambios seguidos** (una sincronización de Google trae 300 eventos): la vista se actualiza de una vez y no evento por evento.
- **Pestaña oculta**: no se reciben cambios y, al volver, se actualiza como hoy (más de 60 s).
- **Sin conexión**: se ve la pantalla "Sin conexión" de siempre; al volver, RF-46.

## Fuera de alcance

- Vista año, vista de 4 días, números de semana, atenuar eventos pasados, calendarios en paralelo en la vista de día, elegir el día en que empieza la semana y mostrar los eventos cortos como de 30 minutos.
- Búsqueda de eventos (sigue en la hoja de ruta como spec futura).
- Ver al momento comentarios o imágenes nuevos: los comentarios ya se piden cada 20 s (spec 014).
- Avisos o notificaciones push de los cambios de otros.
- Tarjeta de detalle en el móvil: allí sigue la hoja inferior (spec 017).
- Ocultar otros días concretos (por ejemplo, solo los domingos).
- Tareas, agenda de citas, invitados y zona horaria por evento.
- Ver la disponibilidad de otras personas en la rejilla y traer los cambios de Google más rápido: van en la spec 020.

## Criterios de finalización

- RF-1 a RF-50 con su test o comprobación manual en verde.
- Prueba en dos navegadores con dos usuarios del mismo calendario: lo que uno crea, mueve y borra lo ve el otro en 5 s o menos, y un usuario ajeno no recibe nada.
- Prueba manual a 390, 768 y 1440 px (acentos rojo y amarillo, claro y oscuro): tarjeta, barra plegada, sin fines de semana y bloque provisional en el móvil.
- Verificación obligatoria completa (P8), con `test:db`, y la salida reportada.
- Aprobación del usuario para cerrar la spec.

## Dudas abiertas

Ninguna bloqueante. Decisiones tomadas por defecto que el usuario puede cambiar al aprobar:

- La tarjeta sustituye a la ventana al pulsar un evento desde 769 px; la ventana actual queda para "Abrir", Editar, el alta completa y "Más opciones".
- Ocultar los fines de semana afecta a semana y mes, no a día, agenda ni mini calendario (Google tampoco toca el mini calendario).
- Las duraciones posibles son 15, 30, 45, 60, 90 y 120 minutos (Google ofrece además 20).
- La barra plegada se recuerda por dispositivo y los fines de semana y la duración por cuenta, como el acento y el tema.
- Los cambios al momento solo llegan con la pestaña visible, para gastar menos batería y cuota.
