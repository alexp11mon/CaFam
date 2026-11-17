# Spec 035 — Modo sin conexión, fase 2

> Estado: **Borrador** (2026-11-17), pendiente de aprobación. Parte de la spec 034 (modo sin conexión), que debe estar cerrada antes de empezar esta. Decisiones de la entrevista del 2026-11-17:
> - entran los cuatro bloques que la 034 dejó fuera: calendarios de Google e iCloud, series completas, comentarios e imágenes, y enviar con la app cerrada;
> - de las imágenes ya subidas se guardan solo las miniaturas del rango;
> - un cambio de serie que pisaría lo que otra persona hizo en sus repeticiones se pregunta como un conflicto.

## Contexto y objetivo

La spec 034 deja usar CaFam sin conexión: ver el calendario y las notas, y crear y cambiar eventos y notas que se envían solos al volver la red, preguntando si chocan con lo que otra persona cambió mientras tanto. Para salir antes dejó fuera cuatro cosas que se echan en falta justo donde no hay cobertura:

- escribir en los calendarios traídos de Google e iCloud, que para muchos usuarios son los principales;
- cambiar una serie entera ("cada lunes ya no es a las 17:00, sino a las 18:00");
- ver y añadir comentarios e imágenes;
- que lo apuntado sin red llegue aunque el usuario cierre la app antes de recuperarla.

Esta spec completa el modo sin conexión con esas cuatro cosas. Mantiene las reglas de la 034: nada se aplica sin pasar por los permisos de siempre, y nada de otra persona se pisa sin preguntar.

## Usuarios / actores

- **Usuario con sesión** que ya tiene la copia de la 034 en su dispositivo y se queda sin red.
- **Otros miembros** de sus calendarios, que pueden cambiar los mismos eventos, series, comentarios e imágenes mientras tanto.
- **Google Calendar e iCloud**, donde otras personas o el propio usuario pueden cambiar los eventos de un calendario traído mientras el usuario está sin conexión.

## Historias de usuario

- H1: Como usuario que trae su calendario de Google o de iCloud, quiero apuntar y cambiar eventos en él sin conexión, para no tener que esperar a tener red ni usar otro calendario.
- H2: Como usuario sin conexión, quiero cambiar o borrar una serie entera o desde una fecha, para que la clase de cada lunes quede bien de una vez.
- H3: Como usuario sin conexión, quiero leer los comentarios de un evento y ver de qué van sus imágenes, para tener toda la información a mano.
- H4: Como usuario sin conexión, quiero añadir un comentario o una foto a un evento, y que lleguen solos a los demás al volver la red.
- H5: Como usuario, quiero que lo que cambié sin conexión llegue aunque cierre la app antes de recuperar la red.

## Requisitos funcionales (criterios de aceptación en EARS)

Los conflictos, "Cambios no enviados", el indicador, la marca "Pendiente de enviar", "Deshacer" y el envío en orden son los de la spec 034 (RF-26 a RF-59). Esta spec dice qué entra en ellos.

### Calendarios de Google e iCloud

- RF-1: MIENTRAS no haya conexión, EL SISTEMA permitirá crear, cambiar, mover y borrar eventos en los calendarios traídos de Google e iCloud a quien puede hacerlo con conexión: el propietario y los Editores, en calendarios en los que el proveedor deja escribir.
- RF-2: MIENTRAS no haya conexión, EL SISTEMA seguirá tratando como de solo lectura los calendarios que el proveedor solo deja leer y los de cuentas sin permiso de escritura, con los motivos de siempre.
- RF-3: MIENTRAS no haya conexión, EL SISTEMA solo ofrecerá mover un evento de un calendario traído a otro calendario traído de la misma cuenta, como con conexión.
- RF-4: CUANDO vuelva la conexión, EL SISTEMA escribirá primero en el proveedor cada cambio pendiente de un calendario traído, y solo si el proveedor lo acepta lo guardará en CaFam.
- RF-5: SI el evento fue cambiado en el proveedor después de la copia sobre la que se hizo el cambio, ENTONCES EL SISTEMA no lo aplicará y preguntará como en el RF-50 de la spec 034.
- RF-6: SI el evento fue borrado en el proveedor, ENTONCES EL SISTEMA preguntará como en el RF-51 de la spec 034.
- RF-7: SI la cuenta del proveedor necesita volver a conectarse cuando se envían sus cambios, ENTONCES EL SISTEMA los conservará pendientes y mostrará el aviso de siempre con "Volver a conectar".
- RF-8: CUANDO la cuenta vuelva a conectarse, EL SISTEMA enviará los cambios que había conservado pendientes.
- RF-9: SI el proveedor rechaza un cambio por otro motivo (calendario borrado, sin permiso o dato no válido), ENTONCES EL SISTEMA lo pasará a "Cambios no enviados" con el motivo en español.

### Series completas

- RF-10: MIENTRAS no haya conexión, EL SISTEMA ofrecerá "Solo este evento", "Este y los siguientes" y "Todos los eventos" al cambiar, mover o borrar una repetición, con las mismas reglas que con conexión.
- RF-11: MIENTRAS no haya conexión, EL SISTEMA permitirá crear una serie y convertir un evento suelto en serie en calendarios normales.
- RF-12: MIENTRAS no haya conexión, EL SISTEMA mostrará las repeticiones de una serie cambiada sin conexión tal como quedarán, dentro del rango guardado.
- RF-13: CUANDO un cambio de serie hecho sin conexión vaya a borrar repeticiones cambiadas, imágenes o comentarios, EL SISTEMA lo pedirá confirmar antes de guardarlo, con los que figuran en la copia ("Se perderán 2 cambios y 3 imágenes."), como con conexión.
- RF-14: SI al enviar un cambio de serie, otra persona había cambiado la serie o alguna de sus repeticiones afectadas después de la copia, ENTONCES EL SISTEMA no lo aplicará y preguntará mostrando la serie en las dos versiones y lo que se perdería, con "Conservar la mía" y "Conservar la suya".
- RF-15: SI al enviar un cambio de serie, otra persona había añadido comentarios o imágenes a alguna repetición afectada después de la copia, ENTONCES EL SISTEMA preguntará como en RF-14, nombrando cuántos comentarios e imágenes se perderían.
- RF-16: MIENTRAS no haya conexión, EL SISTEMA seguirá sin ofrecer series en calendarios traídos de Google e iCloud, como con conexión.

### Comentarios

- RF-17: MIENTRAS haya sesión y conexión, EL SISTEMA guardará en el dispositivo los 50 comentarios más recientes de cada evento del rango de la copia, con su autor, su fecha y si están editados.
- RF-18: MIENTRAS no haya conexión, EL SISTEMA mostrará en el detalle de un evento sus comentarios guardados, con "Ver anteriores" deshabilitado y el motivo "Necesita conexión" si hay más.
- RF-19: MIENTRAS no haya conexión, EL SISTEMA permitirá a cualquier miembro, Lectores incluidos, añadir un comentario a un evento del rango, con los límites de siempre (de 1 a 1.000 caracteres).
- RF-20: MIENTRAS un comentario hecho sin conexión no se haya enviado, EL SISTEMA lo mostrará en el detalle con la marca "Pendiente de enviar" y "Deshacer".
- RF-21: SI al enviar un comentario el evento ya no existe o el usuario ya no es miembro del calendario, ENTONCES EL SISTEMA lo pasará a "Cambios no enviados" con su texto visible para poder copiarlo.
- RF-22: SI se envía dos veces el mismo comentario (la conexión se cortó en mitad del envío), ENTONCES EL SISTEMA lo guardará una sola vez.

### Imágenes

- RF-23: MIENTRAS haya sesión y conexión, EL SISTEMA guardará en el dispositivo la miniatura de cada imagen de los eventos del rango de la copia.
- RF-24: MIENTRAS no haya conexión, EL SISTEMA mostrará en el detalle de un evento la galería con las miniaturas guardadas.
- RF-25: MIENTRAS no haya conexión, EL SISTEMA abrirá el visor con la imagen grande solo si ya estaba en el dispositivo; si no, con la miniatura y el aviso "La imagen completa necesita conexión".
- RF-26: MIENTRAS no haya conexión, EL SISTEMA permitirá a cualquier miembro, Lectores incluidos, añadir imágenes a un evento del rango con los formatos y la reducción de siempre.
- RF-27: MIENTRAS no haya conexión, EL SISTEMA permitirá como mucho 10 imágenes por evento, contando las que ya tiene y las pendientes.
- RF-28: MIENTRAS no haya conexión, EL SISTEMA permitirá como mucho 20 imágenes pendientes de enviar entre todos los eventos, y avisará al llegar al límite.
- RF-29: MIENTRAS una imagen añadida sin conexión no se haya enviado, EL SISTEMA la mostrará en la galería con la marca "Pendiente de enviar" y "Quitar".
- RF-30: CUANDO vuelva la conexión, EL SISTEMA subirá las imágenes pendientes de dos en dos y con su progreso.
- RF-31: SI al subir una imagen se supera un límite (10 por evento, 300 por usuario u 800 MB en total) o el evento ya no existe, ENTONCES EL SISTEMA la pasará a "Cambios no enviados" con el motivo y con "Descargar" para no perderla.
- RF-32: SI una imagen pendiente se subió a medias cuando se cortó la conexión, ENTONCES EL SISTEMA la volverá a subir entera sin crear una imagen duplicada.

### Enviar con la app cerrada

- RF-33: DONDE el navegador permita enviar con la app cerrada, CUANDO vuelva la conexión con cambios pendientes y la app cerrada, EL SISTEMA los enviará sin esperar a que se abra.
- RF-34: CUANDO se abra la app después de un envío hecho con ella cerrada, EL SISTEMA avisará "N cambios sincronizados" y mostrará en el indicador los conflictos y los "Cambios no enviados" que dejó.
- RF-35: SI la sesión ha caducado cuando se intenta enviar con la app cerrada, ENTONCES EL SISTEMA conservará todos los cambios hasta que la misma cuenta vuelva a iniciar sesión, como en el RF-63 de la spec 034.
- RF-36: EL SISTEMA no enviará a la vez desde la app abierta y con la app cerrada, ni desde dos pestañas a la vez.
- RF-37: DONDE el navegador no permita enviar con la app cerrada (Safari en iPhone), EL SISTEMA enviará al abrir la app, como en la spec 034.

### Privacidad

- RF-38: CUANDO el usuario cierre sesión o borre su cuenta, EL SISTEMA borrará también del dispositivo las miniaturas, las imágenes grandes guardadas, los comentarios y las imágenes pendientes.
- RF-39: EL SISTEMA explicará en `/privacy` que se guardan en el dispositivo las miniaturas, los comentarios y lo pendiente de enviar, y que las imágenes pendientes se pierden si el navegador borra los datos del sitio.

## Requisitos no funcionales

- RNF-1: Las mismas plataformas que la 034. En Safari de iOS el envío con la app cerrada no existe: allí se envía al abrir (RF-37).
- RNF-2: Con 300 miniaturas y 50 comentarios en 200 eventos, la copia del dispositivo ocupa 40 MB como mucho, y las 20 imágenes pendientes, 50 MB como mucho.
- RNF-3: Ningún cambio enviado sin conexión se salta los permisos de la base de datos ni las comprobaciones del proveedor: todo se vuelve a comprobar al enviarlo (P3).
- RNF-4: Las credenciales de Google e iCloud nunca se guardan en el dispositivo: las escrituras al proveedor las hace siempre el servidor (P4).
- RNF-5: Sin dependencias ni servicios nuevos, y sin coste (P2, P6).
- RNF-6: Identidad Nexo y WCAG 2.2 AA a 390, 768 y 1440 px, en claro y oscuro (P9). Textos en español.

## Casos límite

- Un evento de Google se cambia sin conexión y otra persona lo cambia en Google mientras tanto: es un conflicto (RF-5), aunque CaFam aún no se haya sincronizado.
- La cuenta de Google o iCloud se desconecta mientras el usuario está sin conexión: los cambios de sus calendarios se rechazan, porque esos calendarios ya no son traídos o ya no existen (RF-9).
- Se cambia sin conexión "Este y los siguientes" de una serie y después una repetición posterior, también sin conexión: se envían en orden y el segundo cambio se aplica sobre la serie nueva.
- Un cambio de serie sin conexión toca repeticiones fuera del rango guardado: el aviso de pérdidas solo puede contar lo que hay en la copia, y lo de fuera lo comprueba RF-14 al enviar.
- Se comenta sin conexión una repetición que todavía no existe como evento aparte: el comentario llega a esa repetición como con conexión.
- Se comenta o se añade una imagen a un evento creado sin conexión: se envían después del evento, y si el evento se rechaza, se rechazan con él.
- Se borra sin conexión un evento con comentarios o imágenes pendientes: lo pendiente de ese evento no se envía.
- Se añade una imagen sin conexión y el dispositivo se queda sin espacio: se avisa y no se guarda.
- La app se cierra en mitad de un envío con la app abierta y el navegador sigue con ella cerrada: nada se aplica dos veces (RF-22, RF-32, RF-36).
- La copia de la 034 de un dispositivo no tiene comentarios ni miniaturas: se completan en la siguiente lectura con conexión, y hasta entonces se muestra "Necesita conexión".

## Fuera de alcance

- Editar o borrar comentarios sin conexión.
- Borrar imágenes sin conexión.
- Guardar las imágenes grandes que no se hayan abierto ya con conexión.
- Comentarios anteriores a los 50 más recientes de cada evento sin conexión.
- Series en calendarios de Google e iCloud (tampoco existen con conexión).
- Conectar, reconectar o desconectar cuentas, crear calendarios en el proveedor y "Subir a Google" sin conexión.
- Notificaciones push al terminar un envío con la app cerrada.
- Enviar con la app cerrada en Safari de iPhone.
- Todo lo demás que la spec 034 deja fuera de alcance (rango más amplio, filtros, Ajustes, asistente, varias cuentas en un dispositivo…).

## Criterios de finalización

- Todos los RF con su test en verde y la verificación obligatoria completa (P8), con `npm run test:db`.
- Recorrido manual con una cuenta de Google y otra de iCloud de prueba: crear, cambiar, mover y borrar sin conexión, volver la red y comprobarlo en Google Calendar y en el iPhone; y un conflicto con un cambio hecho en Google mientras tanto.
- Recorrido de series sin conexión: "Este y los siguientes", "Todos los eventos", crear y convertir, y un conflicto de RF-14 con dos usuarios.
- Recorrido de comentarios e imágenes sin conexión en el iPhone, también una foto de la cámara.
- Envío con la app cerrada en Chrome de Android y en escritorio, y comprobación de que en el iPhone se envía al abrir.
- Medidas de RNF-2 anotadas en `tasks.md`.
- Capturas a 390, 768 y 1440 px en claro y oscuro de la galería sin conexión, un comentario pendiente y un conflicto de serie.
- `/privacy` actualizada.

## Dudas abiertas

- [NECESITA ACLARACIÓN: ¿20 imágenes pendientes como mucho (RF-28) te parece bien, o prefieres otro número?]
- [NECESITA ACLARACIÓN: editar y borrar comentarios propios y borrar imágenes sin conexión los he dejado fuera porque elegiste "ver y añadir". ¿Los quieres dentro?]
