# Spec 014 — Comentarios en los eventos

## Contexto y objetivo

Hoy, quien no es propietario ni Editor de un calendario solo puede mirar sus eventos. Para avisar de "llego tarde", "yo llevo la tarta" o "¿a qué hora salimos?" hay que salir de la app. Esta spec añade **notas y comentarios** en cada evento, que puede escribir cualquier miembro del calendario, incluidos los Lectores (decisión del usuario del 2026-10-29). Es la tercera parte de la fase 3 del plan de mejoras.

## Usuarios / actores

- **Cualquier miembro del calendario** (Propietario, Editor o Lector): lee y escribe comentarios.
- **Autor de un comentario**: lo edita o lo borra.
- **Propietario del calendario**: puede borrar cualquier comentario de su calendario.

## Historias de usuario

- H1: Como miembro de un calendario quiero comentar un evento para coordinarme con los demás sin salir de la app.
- H2: Como Lector quiero comentar aunque no pueda editar el evento.
- H3: Como autor quiero corregir o borrar lo que he escrito.
- H4: Como propietario quiero poder quitar un comentario inapropiado de mi calendario.
- H5: Como miembro quiero saber qué eventos tienen comentarios.

## Requisitos funcionales (criterios de aceptación en EARS)

### Leer

- RF-1: EL SISTEMA mostrará en el detalle de cada evento, tanto en la ventana como en la página completa, una sección "Comentarios" con los comentarios en orden cronológico (el más antiguo arriba).
- RF-2: EL SISTEMA mostrará en cada comentario el avatar y el nombre de su autor, el texto y la fecha y hora relativas ("hace 5 min", "ayer a las 18:30") con la fecha completa accesible.
- RF-3: SI el autor salió del calendario, ENTONCES EL SISTEMA mostrará "un antiguo miembro"; SI borró su cuenta, "Cuenta borrada" (como el autor del evento, spec 006).
- RF-4: EL SISTEMA marcará los comentarios editados con "(editado)".
- RF-5: EL SISTEMA marcará con un icono y el número de comentarios los eventos que tienen comentarios en la agenda y, cuando quepa, en el mes, la semana y el día.
- RF-6: SI un evento tiene más de 50 comentarios, ENTONCES EL SISTEMA mostrará los 50 más recientes y un botón "Ver anteriores".

### Escribir

- RF-7: EL SISTEMA ofrecerá a cualquier miembro del calendario, incluidos los Lectores, un campo para escribir un comentario y un botón "Comentar".
- RF-8: CUANDO el usuario envíe un comentario, EL SISTEMA lo mostrará al final de la lista y vaciará el campo.
- RF-9: EL SISTEMA aceptará comentarios de 1 a 1.000 caracteres, sin contar los espacios de los extremos, y conservará los saltos de línea.
- RF-10: SI el comentario está vacío o supera los 1.000 caracteres, ENTONCES EL SISTEMA no lo enviará y lo explicará junto al campo.
- RF-11: EL SISTEMA mostrará el texto de los comentarios como texto plano: los enlaces que empiecen por `https://` se pueden pulsar y se abren en otra pestaña, y nada más se interpreta como formato.
- RF-12: SI el envío falla, ENTONCES EL SISTEMA conservará el texto escrito en el campo y mostrará el error.
- RF-13: EL SISTEMA permitirá comentar los eventos de los calendarios traídos de Google; esos comentarios solo existen en CaFam y nunca se envían a Google.

### Editar y borrar

- RF-14: EL SISTEMA permitirá al autor editar su comentario, con las mismas reglas de RF-9 y RF-10.
- RF-15: EL SISTEMA permitirá al autor borrar su comentario tras confirmarlo.
- RF-16: EL SISTEMA permitirá al propietario del calendario borrar cualquier comentario de su calendario tras confirmarlo; los Editores solo borran los suyos (decisión del usuario del 2026-10-29).
- RF-17: EL SISTEMA no permitirá a nadie editar el comentario de otra persona.
- RF-18: CUANDO se borre un evento, EL SISTEMA borrará sus comentarios.
- RF-19: CUANDO una actualización desde Google borre un evento traído, EL SISTEMA borrará sus comentarios.

### Actualización

- RF-20: MIENTRAS el detalle de un evento esté abierto, EL SISTEMA mostrará los comentarios nuevos de otras personas como mucho 30 s después de enviarse, sin que el usuario recargue.
- RF-21: SI un comentario visible se borra o se edita mientras otra persona lo mira, ENTONCES EL SISTEMA lo quitará o lo actualizará en su pantalla en la siguiente actualización.

### Privacidad

- RF-22: EL SISTEMA solo mostrará los comentarios de un evento a los miembros de su calendario.
- RF-23: CUANDO un miembro salga o sea expulsado del calendario, EL SISTEMA conservará sus comentarios y dejará de mostrarle los del calendario.
- RF-24: EL SISTEMA no mostrará el email de ningún autor.

### Otras funciones

- RF-25: CUANDO se duplique un evento, EL SISTEMA no copiará sus comentarios.
- RF-26: CUANDO se juntan calendarios o un evento se mueve a otro calendario, EL SISTEMA conservará sus comentarios.
- RF-27: CUANDO un calendario sin propietario se copie para varios miembros (spec 006), EL SISTEMA copiará sus comentarios con sus autores originales.
- RF-28: EL SISTEMA guardará por separado los comentarios de cada repetición de una serie (spec 013).

## Requisitos no funcionales

- **Privacidad** (P3): los permisos los impone la base de datos (la matriz de `test:db` incluye a los Lectores).
- **Seguridad**: el texto nunca se interpreta como HTML (sin inyección de código).
- **Rendimiento**: los comentarios no retrasan la apertura del detalle; si tardan, se ve el esqueleto de la sección.
- **Accesibilidad** (P9): los comentarios nuevos se anuncian a los lectores de pantalla sin mover el foco.
- **Coste cero** (P2): la actualización de RF-20 no supera la capa gratuita.

## Casos límite

- **Evento borrado mientras se escribe**: al enviar se avisa de que el evento ya no existe y se cierra.
- **Lector al que expulsan mientras escribe**: el envío se rechaza con "Ya no tienes acceso".
- **Comentarios enviados dos veces** (doble pulsación o red lenta): solo se guarda uno.
- **Texto con solo emojis o en otro idioma**: se acepta como cualquier texto.
- **Calendario sin propietario** (spec 006): los miembros siguen comentando; nadie tiene permisos de propietario para borrar comentarios ajenos.

## Fuera de alcance

- Notificaciones (correo, push o en la app) de comentarios nuevos.
- Menciones (@persona), respuestas en hilo, reacciones, imágenes en los comentarios o formato enriquecido.
- Moderación automática o denuncias.
- Comentarios en calendarios completos (solo en eventos).
- Historial de ediciones.

## Criterios de finalización

- RF-1 a RF-28 con su test en verde, incluida la matriz de permisos por rol en `test:db`.
- Prueba manual con dos usuarios (propietario y Lector) en móvil y escritorio.
- Capturas a 390, 768 y 1440 px en los dos temas.
- Verificación obligatoria completa con la salida reportada.
- Aprobación del usuario para cerrar la spec.

## Dudas abiertas

- Ninguna. Decidido por el usuario el 2026-10-29: comentan todos los miembros, Lectores incluidos; borran el autor y el propietario.
