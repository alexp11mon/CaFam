# Spec 006 — Gestión de cuenta

> Estado: **Aprobada** por el usuario (2026-10-22). Pendiente de plan, tareas e implementación. Rama: `006-gestion-de-cuenta`. Constitución: `docs/constitution.md`. Parte de las specs 001 a 005 (cerradas).
> Decisiones de la entrevista (2026-10-22):
> - Alcance: recuperar contraseña, cambiar email, editar perfil y borrar cuenta.
> - Borrar cuenta con calendarios compartidos: los miembros reciben aviso y deciden si conservar el calendario o salir de él. Si nadie lo conserva, se borra a los 15 días. Si solo uno lo conserva, pasa a ser suyo; si lo conservan varios, cada uno recibe una copia completa.
> - Cambiar la contraseña desde Ajustes también forma parte de la spec (además de la recuperación por correo).
> - Avisos a los miembros: dentro de la app y por correo.
> - Correo: servicio SMTP gratuito propio, no el envío por defecto de Supabase.
> - Cambio de email: pide la contraseña actual y la confirmación desde el correo nuevo; el antiguo recibe un aviso.

## Contexto y objetivo

Hoy la cuenta es irrecuperable: quien olvida la contraseña pierde sus calendarios, no puede cambiar su email, no puede corregir su nombre ni su zona horaria y no puede dejar la app sin pedir ayuda. Esta spec añade lo mínimo para gestionar la cuenta de forma completa y segura en un entorno de uso familiar. Todas las funciones nuevas viven en Ajustes, salvo la recuperación de contraseña, que es pública. Lo que ya funciona (registro, acceso, calendarios, compartir, importar) no cambia.

## Usuarios / actores

- **Usuario que ha olvidado su contraseña:** sin sesión, pide un enlace por correo.
- **Usuario con sesión:** gestiona su email, su perfil y su cuenta desde Ajustes.
- **Miembro de un calendario cuyo propietario ha borrado su cuenta:** recibe un aviso y decide qué hacer con ese calendario.

## Historias de usuario

- H1: Como usuario que ha olvidado su contraseña quiero recuperar el acceso por correo para no perder mis calendarios.
- H2: Como usuario quiero cambiar mi email sin perder el acceso, confirmando el nuevo.
- H3: Como usuario quiero cambiar mi nombre visible y mi zona horaria.
- H4: Como usuario quiero borrar mi cuenta y mis datos cuando ya no la use.
- H5: Como miembro de un calendario cuyo propietario se da de baja quiero saberlo y decidir si conservarlo.

## Requisitos funcionales (criterios de aceptación en EARS)

### Recuperar contraseña

- RF-1: CUANDO el usuario envía su email en "¿Olvidaste tu contraseña?", EL SISTEMA mostrará siempre el mismo mensaje ("Si la dirección existe, te hemos enviado un correo"), exista o no la cuenta.
- RF-2: CUANDO el usuario abre el enlace del correo dentro de 1 hora desde su envío, EL SISTEMA le pedirá una contraseña nueva de 8 a 72 caracteres, con las mismas reglas que el registro.
- RF-3: SI el enlace ha caducado o ya se ha usado, ENTONCES EL SISTEMA lo indicará y ofrecerá pedir uno nuevo.
- RF-4: CUANDO el usuario guarda una contraseña nueva, EL SISTEMA cerrará las demás sesiones de esa cuenta.
- RF-5: SI se piden más de 3 enlaces de recuperación para la misma cuenta en 15 minutos, ENTONCES EL SISTEMA no enviará otro y mostrará el mismo mensaje de RF-1.

### Cambiar email

- RF-6: CUANDO el usuario pide cambiar su email en Ajustes, EL SISTEMA le pedirá la nueva dirección y su contraseña actual.
- RF-7: SI la contraseña actual no es correcta, ENTONCES EL SISTEMA no iniciará el cambio y lo indicará.
- RF-8: SI la dirección nueva no es válida o ya la usa otra cuenta, ENTONCES EL SISTEMA no iniciará el cambio y lo indicará.
- RF-9: CUANDO el usuario pide el cambio, EL SISTEMA enviará un enlace de confirmación a la dirección nueva y un aviso a la anterior.
- RF-10: MIENTRAS el cambio no esté confirmado, EL SISTEMA mantendrá el email anterior para iniciar sesión y mostrará el cambio como pendiente en Ajustes.
- RF-11: CUANDO el usuario abre el enlace de confirmación dentro de 1 hora, EL SISTEMA usará la dirección nueva para iniciar sesión y dejará de aceptar la anterior.
- RF-12: SI el enlace de confirmación ha caducado o ya se ha usado, ENTONCES EL SISTEMA lo indicará y no cambiará nada.

### Editar perfil

- RF-13: CUANDO el usuario guarda su nombre visible (de 1 a 50 caracteres), EL SISTEMA lo mostrará desde entonces en las listas de miembros y en los avatares de los calendarios que comparte.
- RF-14: CUANDO el usuario cambia su zona horaria, EL SISTEMA mostrará desde entonces sus eventos con hora en la nueva zona, sin modificar los datos guardados.
- RF-15: SI el nombre está vacío, supera 50 caracteres o la zona horaria no es válida, ENTONCES EL SISTEMA no guardará nada y mostrará el error.

### Borrar cuenta

- RF-16: CUANDO el usuario pide borrar su cuenta, EL SISTEMA mostrará una advertencia de que es irreversible y pedirá su contraseña y su email para confirmar.
- RF-17: SI la contraseña o el email de confirmación no coinciden, ENTONCES EL SISTEMA no borrará nada.
- RF-18: CUANDO el usuario confirma el borrado, EL SISTEMA eliminará sus calendarios en los que no haya otros miembros, con todos sus eventos, categorías y preferencias.
- RF-19: CUANDO el usuario confirma el borrado, EL SISTEMA eliminará su cuenta y sus datos de perfil, y cerrará su sesión en todos sus dispositivos.
- RF-20: CUANDO el usuario confirma el borrado, EL SISTEMA quitará al usuario de los calendarios en los que era miembro, y conservará los eventos y categorías que creó en ellos, sin mostrar su nombre como autor.
- RF-21: CUANDO el usuario confirma el borrado y es propietario de calendarios con otros miembros, EL SISTEMA dejará esos calendarios sin propietario durante 15 días.
- RF-22: MIENTRAS un calendario esté sin propietario, EL SISTEMA mantendrá los permisos de cada miembro sin cambios.
- RF-23: CUANDO un calendario queda sin propietario, EL SISTEMA avisará a sus miembros dentro de la app y por correo, nombrando a la persona que borró su cuenta y el plazo de 15 días.
- RF-24: CUANDO un miembro elige conservar un calendario sin propietario, EL SISTEMA registrará su decisión.
- RF-25: CUANDO un miembro elige salir de un calendario sin propietario, EL SISTEMA lo quitará de su lista.
- RF-26: CUANDO todos los miembros de un calendario sin propietario han decidido o han pasado 15 días desde el borrado, EL SISTEMA aplicará la decisión de RF-27 a RF-29.
- RF-27: SI un único miembro ha decidido conservar el calendario, ENTONCES EL SISTEMA le dará su propiedad, sin copia.
- RF-28: SI varios miembros han decidido conservar el calendario, ENTONCES EL SISTEMA dará a cada uno una copia completa (nombre, color, eventos y categorías) de la que es propietario, y eliminará el original. Los eventos de la copia conservan su autor original. Las copias no heredan invitaciones ni el ID y PIN de acceso.
- RF-29: SI nadie ha decidido conservar el calendario al terminar el plazo, ENTONCES EL SISTEMA lo eliminará con todos sus eventos y lo quitará de las listas de sus miembros, avisándoles.

### Cambiar contraseña

- RF-30: CUANDO el usuario pide cambiar su contraseña en Ajustes, EL SISTEMA le pedirá la contraseña actual y la nueva, de 8 a 72 caracteres con las mismas reglas que el registro.
- RF-31: SI la contraseña actual no es correcta, ENTONCES EL SISTEMA no cambiará nada y lo indicará.
- RF-32: SI la contraseña nueva es igual a la actual, ENTONCES EL SISTEMA no la aceptará y lo indicará.
- RF-33: CUANDO el usuario guarda la contraseña nueva, EL SISTEMA cerrará las demás sesiones de la cuenta y mantendrá la actual.

## Requisitos no funcionales

- NF-1: La respuesta de RF-1 es la misma para cualquier dirección, para no revelar qué cuentas existen.
- NF-2: Los correos de la cuenta se envían solo con un servicio de envío gratuito configurado, y las credenciales no aparecen en el código ni en la base de datos pública.
- NF-3: Todo lo nuevo sigue la identidad visual de la constitución (P9) y pasa la guardia de diseño.
- NF-4: Las pantallas nuevas se revisan con capturas a 390, 768 y 1440 px, con el acento rojo y con el amarillo.
- NF-5: No se añaden dependencias nuevas (stack cerrado, P6).

## Casos límite

- Dos cambios de email pedidos seguidos: solo vale el último enlace confirmado.
- El usuario borra su cuenta con un calendario compartido con un único miembro que ya es Lector: sigue el mismo proceso de RF-21 a RF-26.
- Varios miembros confirman a la vez que conservan el calendario: cada uno recibe su copia y el original se elimina una sola vez.
- Un miembro que había decidido conservar ya no está en el calendario cuando se aplica la decisión: no recibe copia.
- Un calendario sin propietario se elimina mientras un miembro lo tiene abierto: al actualizar, se indica que ya no existe.
- Enlace de recuperación abierto en un dispositivo distinto del que lo pidió: funciona si está dentro de plazo.

## Fuera de alcance

- Transferir un calendario a otra persona de forma voluntaria (la propiedad solo cambia por RF-27).
- Exportar los datos de la cuenta antes de borrarla.
- Verificación de identidad en dos pasos y acceso social (007).
- Copia de seguridad de los calendarios borrados.
- Notificaciones distintas de las de RF-23 y RF-26.

## Criterios de finalización

- Todos los RF con prueba en verde, incluidas las pruebas de base de datos del borrado y del cambio de propietario.
- Flujos principales probados en el navegador: recuperar contraseña, cambiar email, editar perfil y borrar una cuenta de prueba, a 390 y 1440 px.
- Correos de recuperación, cambio de email y aviso de calendario sin propietario recibidos y revisados en producción.
- Demo manual y aprobación explícita del usuario para cerrar la spec.

## Dudas abiertas

- [NECESITA ACLARACIÓN: los eventos que el usuario creó en calendarios ajenos (RF-20) se conservan sin autor. Propuesta por defecto: sí, se conservan.]
- Resuelta: en las copias (RF-28), los eventos conservan su autor original.
- [NECESITA ACLARACIÓN: la confirmación del borrado (RF-16) pide email y contraseña. Propuesta por defecto: sí, ambos.]
- [NECESITA ACLARACIÓN: el enlace de recuperación (RF-2) y el de cambio de email (RF-11) caducan a la hora. Propuesta por defecto: sí.]
- [NECESITA ACLARACIÓN: RF-5 limita a 3 enlaces en 15 minutos. Propuesta por defecto: sí.]
