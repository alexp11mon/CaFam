# Spec 009 — Sincronización bidireccional con Google

> Estado: **Aprobada** por el usuario (2026-10-28). Plan sin empezar.
> Parte de la spec 007 (sincronización de solo lectura con Google y grupos, cerrada el 2026-10-28 con la aplicación de Google en "Prueba", Enmienda 2). Constitución: `docs/constitution.md` (P9 para lo visual).
> Esta spec **sustituye** en la 007 (cerrada, no se edita): RF-2 (solo permiso de lectura), RF-20 (eventos traídos de solo lectura), la parte de RF-21 sobre el nombre y el requisito no funcional "Solo lectura". El resto de la 007 sigue vigente.
> Decisiones de la entrevista (2026-10-28):
>
> - Escriben en un calendario traído **el propietario y los Editores**, igual que en un calendario normal; los cambios de un Editor llegan a la cuenta de Google del propietario.
> - Conflictos: **gana el último cambio**, venga de CaFam o de Google.
> - Repeticiones de un evento repetido de Google: cambiar o borrar una en CaFam afecta **solo a esa repetición** en Google.
> - Si no se puede escribir en Google, **el cambio no se guarda en CaFam** y se avisa: CaFam nunca muestra un cambio que Google no tiene.
> - Además de los eventos llegan a Google: **mover eventos** entre calendarios traídos de la misma cuenta, el **nombre** del calendario, **crear un calendario** en Google desde CaFam y **subir** un calendario de CaFam a Google.
> - **Todas las cuentas escriben**: las ya conectadas siguen leyendo, pero no escriben hasta volver a conectar, con un aviso.
> - Entra la página pública de **política de privacidad** y la **publicación** de la aplicación de Google fuera de "Prueba" (pendiente de la 007).

## Contexto y objetivo

Desde la spec 007 los calendarios de Google llegan a CaFam y se mantienen al día, pero son de solo lectura: para cambiar un evento hay que ir a Google. La familia quiere organizarse en un solo sitio. Esta spec hace que lo que se crea, cambia, mueve o borra en CaFam dentro de un calendario de Google llegue también a Google, que se puedan crear calendarios de Google desde CaFam y que un calendario de CaFam se pueda subir a Google para tenerlo en los dos lados. Además, publica la aplicación de Google para que cualquier persona pueda conectar su cuenta sin estar en una lista de pruebas.

## Usuarios / actores

- **Propietario de un calendario traído:** conectó la cuenta de Google. Escribe en sus eventos, renombra el calendario, crea calendarios en Google y sube calendarios de CaFam.
- **Editor de un calendario traído:** crea, cambia, mueve y borra sus eventos; los cambios llegan a la cuenta de Google del propietario.
- **Lector de un calendario traído:** solo lo ve, como hasta ahora.
- **Google:** recibe los cambios; puede rechazarlos, no responder o revocar el permiso.
- **Visitante sin sesión:** lee la política de privacidad.

## Historias de usuario

- H1: Como propietario o Editor quiero crear, cambiar y borrar en CaFam los eventos de un calendario de Google para no tener que abrir Google.
- H2: Como propietario quiero renombrar en CaFam un calendario de Google y que se renombre también en Google.
- H3: Como propietario quiero crear un calendario nuevo en mi cuenta de Google desde CaFam.
- H4: Como propietario quiero subir un calendario de CaFam a mi cuenta de Google para verlo también en Google.
- H5: Como usuario quiero saber que un cambio no se ha guardado si Google no lo ha aceptado.
- H6: Como cualquier persona quiero conectar mi cuenta de Google sin pedir que me añadan a una lista de pruebas.
- H7: Como visitante quiero leer qué hace CaFam con los datos de mi cuenta de Google antes de conectarla.

## Requisitos funcionales (criterios de aceptación en EARS)

### Permiso

- RF-1: EL SISTEMA solicitará a Google permiso de lectura y escritura de calendarios y de eventos al conectar una cuenta.
- RF-2: MIENTRAS una cuenta conectada solo tiene el permiso de lectura de la spec 007, EL SISTEMA seguirá actualizando sus calendarios y los mantendrá de solo lectura, como en la spec 007.
- RF-3: MIENTRAS una cuenta conectada solo tiene el permiso de lectura, EL SISTEMA mostrará a su propietario en "Mis calendarios" y en la ficha de la cuenta un aviso para volver a conectarla y poder editar.
- RF-4: CUANDO el propietario vuelve a conectar una cuenta con el permiso de escritura, EL SISTEMA conservará sus calendarios traídos sin duplicarlos y permitirá escribir en ellos.
- RF-5: SI el usuario no concede en Google todos los permisos pedidos, ENTONCES EL SISTEMA tratará la cuenta como de solo lectura y explicará qué permiso falta.

### Quién escribe

- RF-6: MIENTRAS la cuenta tiene permiso de escritura, EL SISTEMA permitirá al propietario y a los Editores de un calendario traído crear, cambiar y borrar sus eventos.
- RF-7: EL SISTEMA no permitirá a un Lector escribir en un calendario traído.
- RF-8: SI la cuenta de Google solo puede leer un calendario (por ejemplo, festivos, cumpleaños o un calendario que otra persona le compartió en Google sin permiso de cambios), ENTONCES EL SISTEMA lo mantendrá de solo lectura en CaFam y lo indicará en pantalla.
- RF-9: EL SISTEMA ofrecerá los calendarios traídos en los que el usuario puede escribir como destino al crear, cambiar y duplicar un evento, en el formulario, en la ventana rápida y al arrastrar sobre la rejilla.

### Escribir eventos en Google

- RF-10: CUANDO alguien crea un evento en un calendario traído, EL SISTEMA lo creará en Google y después en CaFam.
- RF-11: CUANDO alguien cambia un evento de un calendario traído, EL SISTEMA aplicará el cambio en Google y después en CaFam.
- RF-12: CUANDO alguien borra un evento de un calendario traído, EL SISTEMA lo borrará en Google y después en CaFam.
- RF-13: EL SISTEMA escribirá en Google el título, el inicio, el fin, si es de día completo, la descripción y el lugar del evento.
- RF-14: CUANDO alguien cambia un evento, EL SISTEMA enviará a Google solo los datos que se han cambiado en CaFam.
- RF-15: EL SISTEMA conservará en Google los datos del evento que CaFam no muestra (invitados, recordatorios, videollamada, adjuntos y color de Google).
- RF-16: EL SISTEMA conservará en CaFam la categoría y el color que el evento tenga en CaFam cuando llegue una actualización de Google.
- RF-17: CUANDO alguien cambia o borra en CaFam una repetición de un evento repetido de Google, EL SISTEMA cambiará o borrará en Google solo esa repetición.
- RF-18: CUANDO Google acepta el cambio, EL SISTEMA mostrará el mismo aviso breve que en un calendario normal ("Evento creado", "Cambios guardados" o "Evento borrado").

### Mover eventos

- RF-19: CUANDO alguien mueve un evento de un calendario traído a otro calendario traído de la misma cuenta de Google, EL SISTEMA lo moverá también en Google.
- RF-20: EL SISTEMA no ofrecerá mover un evento de un calendario traído a un calendario de otra cuenta de Google ni a un calendario normal, ni al revés.

### Errores al escribir

- RF-21: SI Google no acepta un cambio de un evento, ENTONCES EL SISTEMA no lo guardará en CaFam, dejará el evento como estaba y conservará lo escrito en el formulario.
- RF-22: SI Google no responde al escribir, ENTONCES EL SISTEMA dirá en español que Google no responde y que se puede volver a intentar.
- RF-23: SI el permiso de la cuenta se ha revocado o ha caducado al escribir, ENTONCES EL SISTEMA dirá que hay que volver a conectar la cuenta y aplicará el RF-31 de la spec 007.
- RF-24: SI Google rechaza el cambio (por ejemplo, porque la cuenta ya no puede escribir en ese calendario), ENTONCES EL SISTEMA dirá en español que Google no ha permitido el cambio.
- RF-25: SI el evento que se cambia o se borra en CaFam ya no existe en Google, ENTONCES EL SISTEMA lo quitará de CaFam y avisará de que se borró en Google, sin guardar el cambio.
- RF-26: EL SISTEMA no mostrará al usuario mensajes técnicos de Google.

### Conflictos

- RF-27: SI un evento cambió en Google después de la última actualización y alguien lo cambia en CaFam, ENTONCES EL SISTEMA guardará en Google y en CaFam el cambio hecho en CaFam, porque es el último.
- RF-28: CUANDO una actualización trae de Google un cambio posterior al último hecho en CaFam, EL SISTEMA aplicará el de Google en CaFam, como en la spec 007.

### Calendarios

- RF-29: CUANDO el propietario renombra un calendario traído, EL SISTEMA lo renombrará también en Google.
- RF-30: SI Google no acepta el nombre nuevo, ENTONCES EL SISTEMA no lo guardará en CaFam y lo explicará con los mensajes de RF-22 a RF-24.
- RF-31: EL SISTEMA no enviará a Google el color ni la descripción del calendario, que siguen siendo solo de CaFam.
- RF-32: CUANDO el propietario crea un calendario nuevo en una cuenta de Google conectada desde CaFam, EL SISTEMA lo creará en Google con el nombre elegido y lo traerá a CaFam como calendario traído.
- RF-33: EL SISTEMA contará un calendario creado o subido a Google dentro del límite de 20 calendarios traídos por cuenta (RF-14 de la spec 007).
- RF-34: CUANDO el propietario sube un calendario normal suyo de CaFam a una cuenta de Google conectada, EL SISTEMA creará un calendario en Google con el mismo nombre, copiará sus eventos y lo convertirá en un calendario traído de esa cuenta.
- RF-35: EL SISTEMA copiará a Google, al subir un calendario, solo los eventos del rango de la sincronización (de 6 meses antes de hoy a 1 año después), con el máximo de 2.000 eventos de la spec 007.
- RF-42: EL SISTEMA conservará en CaFam los eventos de un calendario subido que quedaban fuera del rango al subirlo, sin enviarlos a Google y sin que las actualizaciones los quiten.
- RF-43: ANTES de subir un calendario, EL SISTEMA indicará cuántos eventos se copiarán a Google y cuántos se quedarán solo en CaFam.
- RF-36: CUANDO se sube un calendario, EL SISTEMA conservará en CaFam sus miembros, sus categorías y el color y la categoría de cada evento.
- RF-37: SI la subida falla antes de terminar, ENTONCES EL SISTEMA dejará el calendario de CaFam como estaba, borrará de Google lo que hubiera creado y explicará el fallo.
- RF-38: EL SISTEMA no permitirá subir un calendario sin propietario (spec 006), uno ya traído ni uno del que el usuario no es propietario.

### Privacidad y publicación

- RF-39: EL SISTEMA tendrá una página pública de política de privacidad, accesible sin sesión, que explica en español qué datos de Google se leen y se escriben, para qué, dónde se guardan, con quién se comparten y cómo retirar el permiso y borrar los datos.
- RF-40: EL SISTEMA enlazará la política de privacidad desde la portada y desde el aviso previo a conectar Google.
- RF-41: CUANDO la aplicación de Google está publicada, EL SISTEMA permitirá conectar a cualquier cuenta de Google, con el aviso de "aplicación no verificada" de la spec 007 (RF-48).

## Requisitos no funcionales

- **Privacidad y seguridad:** la autorización de Google solo se guarda en el servidor y nunca llega al navegador ni a otros usuarios (P3 y P4). Que un Editor escriba en la cuenta de Google del propietario no le da acceso a esa cuenta ni a otros calendarios suyos.
- **Base de datos como frontera:** quién puede escribir en un calendario traído se decide igual que en un calendario normal y lo sigue imponiendo la base de datos (P3).
- **Coste cero:** solo capas gratuitas (P1 y P6); la publicación de la aplicación de Google se hace sin verificar, sin dominio propio y sin pagar nada.
- **Dependencias:** ninguna nueva salvo aprobación expresa del usuario (P6).
- **Tiempo de respuesta:** guardar un evento en un calendario traído responde en menos de 10 segundos; si Google tarda más, se aplica RF-22.
- **Identidad visual (P9):** las pantallas nuevas y cambiadas siguen la spec 005, con capturas a 390, 768 y 1440 px con el acento rojo y el amarillo.
- **Idioma:** textos, errores y política de privacidad en español.
- **Accesibilidad:** todo se puede hacer con teclado, con etiqueta en cada campo y los errores anunciados a lectores de pantalla.

## Casos límite

- Un Editor cambia un evento: en Google aparece como cambiado por la cuenta del propietario; en CaFam se sigue viendo "Creado por" de la spec 006.
- Dos personas cambian el mismo evento en CaFam a la vez: se queda el último que guarda (RF-27).
- El evento lo organiza otra persona en Google (invitación recibida): Google puede rechazar el cambio; se aplica RF-24.
- La descripción de un evento se recortó a 2.000 caracteres al traerlo: cambiar solo el título no la recorta en Google (RF-14).
- Un evento de día completo cambia a evento con hora, o al revés: se escribe en Google con la regla de día completo de la spec 002.
- Se crea un evento en CaFam y llega la actualización automática antes de terminar: no se duplica.
- La cuenta conectada pierde en Google el permiso sobre un calendario compartido: el calendario pasa a solo lectura (RF-8) y los cambios se rechazan (RF-24).
- Se sube un calendario con eventos de varios días o de día completo: se copian con las mismas reglas que al crearlos.
- Se desmarca o se desconecta un calendario creado o subido desde CaFam: se aplica la elección de la spec 007 (conservar o borrar en CaFam); en Google no se borra nada.
- La aplicación de Google llega al tope de 100 usuarios de las aplicaciones no verificadas: se aplica RF-47 de la spec 007.

## Fuera de alcance

- Borrar un calendario en Google desde CaFam: borrar, desmarcar o desconectar en CaFam nunca borra el calendario en Google.
- Mover un evento entre cuentas de Google distintas o entre un calendario traído y uno normal (RF-20).
- Enviar a Google el color o la descripción del calendario, o el color y la categoría de un evento.
- Crear o editar eventos repetidos (series) desde CaFam: solo se tocan repeticiones sueltas (RF-17).
- Invitados, respuestas, recordatorios, videollamadas y adjuntos.
- Guardar un cambio en CaFam y enviarlo a Google más tarde (cola de cambios pendientes): si Google no lo acepta, no se guarda (RF-21).
- Avisar a otros miembros de que un calendario cambió.
- Juntar calendarios traídos (RF-44 de la spec 007 sigue vigente).
- Pasar la verificación de Google, contratar un dominio propio o cualquier servicio de pago.
- Microsoft (Outlook), Apple/iCloud y otros proveedores.
- Elegir por cuenta si escribe o solo lee: todas las cuentas escriben tras volver a conectar.

## Criterios de finalización

- Todos los RF con test en verde y la verificación de P8 (`typecheck`, `lint`, `format:check`, `test`, `build` y `test:db`).
- La aplicación de Google publicada sin verificar y una cuenta que no está en la lista de pruebas conecta pasando por el aviso de "aplicación no verificada".
- Demo manual en producción con una cuenta real de Google: volver a conectar una cuenta de la 007; crear, cambiar, mover y borrar eventos en CaFam y verlos en Google; cambiar una repetición; un Editor cambia un evento; renombrar un calendario; crear un calendario en Google; subir un calendario de CaFam; y un cambio rechazado que no se guarda.
- Revisión visual a 390, 768 y 1440 px con el acento rojo y el amarillo (P9).
- `no-secrets` en verde y revisión del diff: ninguna autorización de Google llega al navegador.
- Aprobación explícita del usuario para cerrar la spec.

## Dudas abiertas

- (Resuelta 2026-10-28: RF-25, un evento borrado en Google mientras se cambiaba en CaFam se quita de CaFam con un aviso.)
- (Resuelta 2026-10-28: RF-35, al subir un calendario solo se copian a Google los eventos del rango; los demás se quedan en CaFam, RF-42 y RF-43.)
