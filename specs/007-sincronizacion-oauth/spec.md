# Spec 007 — Sincronización de calendarios externos (Google)

> Estado: **Aprobada** por el usuario (2026-10-23), con las dudas resueltas en la entrevista. **Enmendada** el 2026-10-27 (ver "Enmienda 1").
>
> **Enmienda 1 (2026-10-27, decisión del usuario tras la T1):** se quita Microsoft. Registrar la aplicación exige un directorio de Microsoft Entra, y con una cuenta personal solo se consigue con una suscripción de Azure que pide tarjeta (P2). Microsoft pasa a "Fuera de alcance" (versión futura). Los RF conservan su número: RF-30 deja la parte de Microsoft y el requisito "Cuentas admitidas" queda solo con Google. Constitución: `docs/constitution.md` (P9 para lo visual). Parte de las specs 001 a 006 (cerradas) y es independiente de la 008 (mejoras de experiencia).
> Numeración: AGENTS.md y la constitución reservaban el 007 para OAuth; la 008 se redactó antes. Las specs 001 a 004 citan OAuth como "spec 006": hoy es esta.
> Decisiones de la entrevista (2026-10-23):
>
> - Proveedores: **Google Calendar y Microsoft (Outlook)**. Apple/iCloud queda fuera (no ofrece OAuth para calendarios). *(Enmienda 1: solo Google.)*
> - Dirección: **solo traer** (proveedor → CaFam). La sincronización bidireccional queda para una versión futura del proyecto, con su propia spec.
> - Frecuencia: **automática y con botón "Actualizar ahora"**.
> - Alcance: el usuario **elige qué calendarios** de su cuenta trae; cada uno es un calendario de CaFam. Además hay **grupos de calendarios** que se ordenan y se ocultan o muestran de golpe.
> - Al desconectar: **el usuario elige** conservar los calendarios (como normales y editables) o borrarlos.
> - Rango: de **6 meses atrás a 1 año adelante**; los eventos repetidos se traen como eventos sueltos.
> - Resolución de dudas (2026-10-23): Google se publica **sin pasar la verificación** (decisión del 2026-10-23, que sustituye a la anterior): gratis y sin dominio propio, con el aviso de "aplicación no verificada" de Google y su tope de 100 usuarios en total; se admiten cuentas de Microsoft **personales y de trabajo o escuela** (anulado por la Enmienda 1); se aceptan las cifras propuestas (5 cuentas, 20 calendarios, 6 horas, 5 minutos, 3 fallos); los grupos valen para **todos los calendarios** que ve el usuario, también los sin propietario; un calendario traído **no se puede juntar**; **no entran dependencias nuevas** salvo que el plan demuestre que son necesarias.

## Contexto y objetivo

Hoy un calendario externo entra en CaFam solo con la importación única de un `.ics` (spec 004): se queda congelado y hay que repetirla a mano para ver los cambios. Esta spec permite conectar una cuenta de Google con su autorización, elegir qué calendarios traer y mantenerlos al día sin tocar nada. Así la familia ve en un solo sitio, junto a los calendarios propios de CaFam, lo que ya organiza en Google. La sincronización es de un solo sentido: CaFam nunca escribe en la cuenta externa.

Además, al poder haber muchos más calendarios en el panel, se añaden grupos para ordenarlos y mostrarlos u ocultarlos juntos.

## Usuarios / actores

- **Propietario:** conecta la cuenta, elige los calendarios, los actualiza, los desconecta y decide cómo se agrupan en su panel.
- **Miembro (Editor o Lector) de un calendario traído:** lo ve y, si el propietario lo ha compartido, lo usa como cualquier calendario compartido, pero no puede cambiar sus eventos.
- **Proveedor externo (Google):** origen de los datos; puede revocar el permiso o dejar de responder.

## Historias de usuario

- H1: Como usuario quiero conectar mi cuenta de Google para traer mis calendarios a CaFam.
- H2: Como usuario quiero elegir qué calendarios de la cuenta se traen y cambiar esa elección más tarde.
- H3: Como usuario quiero que los calendarios traídos se actualicen solos para no repetir ninguna importación.
- H4: Como usuario quiero un botón para actualizar ahora cuando acabo de cambiar algo en el proveedor.
- H5: Como usuario quiero compartir un calendario traído con mi familia para que lo vean sin tener cuenta del proveedor.
- H6: Como usuario quiero meter calendarios en grupos, ordenarlos y ocultar o mostrar un grupo entero de un toque.
- H7: Como usuario quiero desconectar mi cuenta y decidir si me quedo con lo traído o lo borro.

## Requisitos funcionales (criterios de aceptación en EARS)

### Conectar una cuenta

- RF-1: CUANDO el usuario pide conectar una cuenta de Google, EL SISTEMA le llevará a la pantalla de autorización de Google.
- RF-2: EL SISTEMA solicitará al proveedor únicamente permiso de lectura de calendarios, y nunca de escritura.
- RF-3: CUANDO el usuario autoriza, EL SISTEMA volverá a CaFam, mostrará la cuenta conectada (proveedor y dirección de correo de la cuenta) y le pedirá elegir calendarios.
- RF-4: SI el usuario cancela o rechaza la autorización en el proveedor, ENTONCES EL SISTEMA volverá a CaFam sin conectar nada e informará de ello.
- RF-5: SI el proveedor devuelve un error o no responde al conectar, ENTONCES EL SISTEMA no conectará la cuenta y mostrará un mensaje en español con la opción de reintentar.
- RF-6: SI la cuenta del proveedor ya está conectada por el mismo usuario, ENTONCES EL SISTEMA no creará una conexión duplicada e informará de que ya existe.
- RF-7: SI la cuenta del proveedor ya está conectada por otro usuario de CaFam, ENTONCES EL SISTEMA permitirá la conexión de forma independiente, sin compartir nada entre los dos usuarios.
- RF-47: SI Google devuelve a la aplicación el rechazo de la conexión (por ejemplo, por haber alcanzado el tope de usuarios de las aplicaciones no verificadas), ENTONCES EL SISTEMA no conectará la cuenta y explicará en español que puede ser por falta de plazas disponibles. Si Google muestra el error en su propia pantalla y no vuelve, no hay respuesta de CaFam.
- RF-48: ANTES de enviar al usuario a la autorización de Google, EL SISTEMA le avisará de que Google mostrará un aviso de "aplicación no verificada" y de por qué (aplicación personal sin ánimo de lucro).
- RF-8: EL SISTEMA permitirá como máximo 5 cuentas conectadas por usuario y, SI se supera, ENTONCES lo rechazará con un mensaje que explique el límite.

### Elegir calendarios

- RF-9: CUANDO la cuenta está conectada, EL SISTEMA mostrará los calendarios de esa cuenta con su nombre y color, para marcar cuáles traer.
- RF-10: CUANDO el usuario marca un calendario y confirma, EL SISTEMA creará un calendario nuevo en CaFam, propiedad del usuario, con el nombre y el color más cercano de la paleta de CaFam, y traerá sus eventos.
- RF-11: CUANDO el usuario desmarca un calendario ya traído, EL SISTEMA pedirá confirmación y, tras ella, dejará de traerlo y le aplicará la elección de desconexión del RF-27.
- RF-12: CUANDO el usuario vuelve a la pantalla de la cuenta, EL SISTEMA mostrará la lista actual de calendarios de la cuenta, incluidos los creados después de conectarla, para poder marcarlos.
- RF-13: SI un calendario traído se borra en el proveedor, ENTONCES EL SISTEMA lo marcará como "ya no existe en la cuenta" y dejará de actualizarlo, sin borrarlo de CaFam, hasta que el usuario decida.
- RF-14: EL SISTEMA permitirá traer como máximo 20 calendarios por cuenta conectada.

### Eventos traídos

- RF-15: EL SISTEMA traerá los eventos del rango que va desde 6 meses antes de hoy hasta 1 año después de hoy.
- RF-16: EL SISTEMA traerá cada repetición de un evento repetido como un evento suelto, respetando las excepciones y las repeticiones modificadas del proveedor, y no traerá los eventos cancelados.
- RF-17: EL SISTEMA traerá de cada evento título, inicio, fin, día completo, descripción y lugar, con las mismas reglas de día completo y de zona horaria de la importación `.ics` (spec 004).
- RF-18: SI un evento tiene una zona horaria que el sistema no reconoce o un fin anterior al inicio, ENTONCES EL SISTEMA lo omitirá y lo contará en el resumen de la actualización.
- RF-19: EL SISTEMA traerá como máximo 2.000 eventos por calendario; SI el rango tiene más, ENTONCES traerá los más cercanos a hoy y avisará de que se han omitido el resto.
- RF-20: MIENTRAS un calendario es traído, EL SISTEMA no permitirá a nadie crear, editar, mover ni borrar sus eventos, y lo indicará en pantalla.
- RF-21: EL SISTEMA permitirá al propietario cambiar el nombre, la descripción y el color de un calendario traído, y compartirlo, con las reglas de la spec 003.
- RF-44: MIENTRAS un calendario es traído, EL SISTEMA no lo ofrecerá como origen ni como destino de "juntar calendarios" (spec 002) y lo indicará en pantalla.
- RF-45: CUANDO el usuario desconecta la cuenta y conserva un calendario, EL SISTEMA lo ofrecerá de nuevo para "juntar calendarios".

### Actualizar

- RF-22: EL SISTEMA actualizará cada calendario traído de forma automática al menos cada 6 horas.
- RF-23: CUANDO el usuario pulsa "Actualizar ahora" en una cuenta, EL SISTEMA actualizará los calendarios traídos de esa cuenta y mostrará cuándo terminó y cuántos eventos se añadieron, cambiaron, se quitaron u omitieron.
- RF-24: SI el usuario pulsa "Actualizar ahora" y la cuenta se actualizó hace menos de 5 minutos, ENTONCES EL SISTEMA no volverá a consultar al proveedor e indicará cuándo se podrá actualizar de nuevo.
- RF-25: EN cada actualización, EL SISTEMA reflejará los cambios del proveedor: añadirá los eventos nuevos, modificará los cambiados y quitará los borrados o los que salgan del rango.
- RF-26: EL SISTEMA mostrará en cada calendario traído su cuenta de origen y la fecha y hora de su última actualización correcta.

### Desconectar y errores de la cuenta

- RF-27: CUANDO el usuario desconecta una cuenta, EL SISTEMA le preguntará, indicando cuántos calendarios afecta y cuáles están compartidos y con cuántas personas, si quiere **conservar** los calendarios traídos como calendarios normales y editables, o **borrarlos**.
- RF-28: CUANDO el usuario elige conservar, EL SISTEMA dejará los calendarios y sus eventos tal como están, sin conexión, y a partir de ese momento serán editables.
- RF-29: CUANDO el usuario elige borrar, EL SISTEMA eliminará los calendarios traídos y sus eventos, incluidos los de los demás miembros con quienes estuvieran compartidos.
- RF-30: CUANDO el usuario desconecta una cuenta, EL SISTEMA eliminará los datos de autorización que guardaba y revocará además el permiso en Google.
- RF-31: SI el proveedor revoca el permiso o este caduca y no se puede renovar, ENTONCES EL SISTEMA dejará de actualizar esa cuenta, conservará los calendarios traídos sin cambios, avisará al usuario en la aplicación y le ofrecerá volver a conectar.
- RF-32: CUANDO el usuario vuelve a conectar una cuenta cuyo permiso ha caducado, EL SISTEMA reanudará la actualización de los calendarios que ya tenía, sin duplicarlos.
- RF-33: SI una actualización falla de forma temporal (el proveedor no responde o limita las peticiones), ENTONCES EL SISTEMA conservará los datos anteriores, lo reintentará en la siguiente actualización automática y mostrará en la cuenta que la última actualización falló.
- RF-34: SI una actualización falla 3 veces seguidas, ENTONCES EL SISTEMA avisará al usuario en la aplicación.

### Grupos de calendarios

- RF-35: CUANDO el usuario crea un grupo con un nombre (1 a 40 caracteres, único ignorando mayúsculas y espacios exteriores), EL SISTEMA lo añadirá a su lista de grupos.
- RF-36: CUANDO el usuario asigna un calendario a un grupo, EL SISTEMA lo mostrará dentro de ese grupo en "Mis calendarios" y en los filtros del calendario.
- RF-37: EL SISTEMA permitirá que un calendario esté como máximo en un grupo y que los calendarios sin grupo se muestren aparte, como hasta ahora.
- RF-38: CUANDO el usuario reordena grupos o calendarios dentro de un grupo, EL SISTEMA guardará ese orden solo para él.
- RF-39: CUANDO el usuario oculta un grupo, EL SISTEMA ocultará en el calendario los eventos de todos sus calendarios; CUANDO lo muestra, los mostrará todos.
- RF-40: MIENTRAS un grupo tiene calendarios mostrados y ocultos a la vez, EL SISTEMA lo indicará como parcialmente visible.
- RF-41: CUANDO el usuario renombra un grupo, EL SISTEMA aplicará el nombre nuevo, y CUANDO lo borra, EL SISTEMA devolverá sus calendarios a "sin grupo" sin borrar ningún calendario ni evento.
- RF-42: EL SISTEMA aplicará los grupos a cualquier calendario que el usuario ve (propio, compartido, importado, traído o sin propietario) y los guardará en privado: otros miembros no verán sus grupos.
- RF-46: MIENTRAS un calendario sin propietario (spec 006) está en un grupo del usuario, EL SISTEMA seguirá mostrando su aviso de decisión (Conservar o Salir) y su plazo en "Mis calendarios", lo mostrará dentro del grupo con la etiqueta "Sin propietario" y mantendrá sus permisos sin cambios.
- RF-43: CUANDO el usuario sale de un calendario, lo pierde o se borra, EL SISTEMA lo quitará de su grupo.

## Requisitos no funcionales

- **Privacidad y seguridad:** la autorización del proveedor solo se guarda en el servidor y nunca llega al navegador ni a otros usuarios (P3 y P4 de la constitución). Ningún usuario puede ver ni usar la conexión de otro.
- **Solo lectura:** el permiso pedido nunca permite modificar nada en Google (RF-2).
- **Coste cero:** solo capas gratuitas (P1 y P6). La frecuencia y los límites de esta spec tienen que poder cumplirse sin pagar ningún servicio, y no se contrata ningún dominio ni servicio de pago para Google.
- **Cuentas admitidas:** Google (cuentas personales). (Enmienda 1: Microsoft queda fuera.)
- **Dependencias:** esta spec no introduce dependencias de producción nuevas; si el plan demuestra que alguna es imprescindible, necesitará aprobación expresa del usuario (P6).
- **Identidad visual (P9):** las pantallas nuevas siguen la identidad de la spec 005, con capturas a 390, 768 y 1440 px.
- **Idioma:** textos y errores en español; el tratamiento de errores del proveedor no muestra mensajes técnicos al usuario.
- **Accesibilidad:** todo se puede hacer con teclado, con etiqueta en cada campo y los avisos anunciados a lectores de pantalla.
- **Privacidad de los datos del proveedor:** CaFam solo guarda los eventos y datos de calendarios elegidos por el usuario; no guarda contactos ni otros datos de la cuenta.
- **Rendimiento:** una actualización de un calendario de hasta 2.000 eventos termina en menos de 60 segundos.

## Casos límite

- El usuario conecta la misma cuenta dos veces o desde dos dispositivos a la vez: solo se crea una conexión (RF-6).
- Un evento cambia de calendario, o un calendario cambia de nombre o de color en el proveedor: el nombre y el color de CaFam no se vuelven a sobrescribir tras la primera vez; los eventos sí se actualizan.
- Un evento se actualiza o borra en el proveedor a la vez que el usuario pulsa "Actualizar ahora" y llega la actualización automática: el resultado es el estado del proveedor y no se duplican eventos.
- El mismo calendario existe en dos cuentas conectadas del usuario (p. ej. compartido entre cuentas): se trae dos veces como calendarios independientes.
- Un calendario traído compartido y el propietario borra su cuenta de CaFam: se sigue la regla de la spec 006 (calendario sin propietario); la conexión con el proveedor se elimina y el calendario queda como conservado, sin actualizaciones.
- Un calendario traído no se puede juntar con otros (RF-44): para juntarlo hay que desconectar la cuenta conservándolo.
- Un calendario traído tiene eventos de cumpleaños o festivos, repetidos cada año: se traen como eventos sueltos dentro del rango.
- La cuenta del usuario tiene más de 20 calendarios: solo se pueden marcar 20 (RF-14).
- Se llega al límite de peticiones del proveedor: se aplica RF-33.
- El usuario tiene la aplicación abierta durante una actualización: los eventos aparecen al recargar o al navegar, sin errores a medias.

## Fuera de alcance

- Sincronización bidireccional: escribir, editar o borrar eventos en el proveedor desde CaFam (versión futura, con su propia spec).
- Microsoft (Outlook): registrar la aplicación exige un directorio de Entra que no se crea sin tarjeta con una cuenta personal (Enmienda 1; versión futura).
- Apple/iCloud (CalDAV) y otros proveedores distintos de Google.
- Eventos recurrentes propios de CaFam (los repetidos del proveedor llegan sueltos).
- Invitaciones, asistentes, respuestas (acepto/rechazo), recordatorios, archivos adjuntos, videollamadas y colores de evento del proveedor.
- Traer tareas, contactos, salas, calendarios de otras personas a las que no se ha dado acceso, ni calendarios "delegados" de cuentas de empresa.
- Notificaciones push o por correo cuando un calendario cambia.
- Actualización en tiempo real (el cambio llega en la siguiente actualización, automática o manual).
- Iniciar sesión en CaFam con Google (login social); esta spec solo conecta calendarios.
- Sustituir la importación `.ics` de la spec 004, que sigue igual.
- Juntar calendarios traídos mientras la cuenta esté conectada (RF-44).
- Exportar calendarios.

## Criterios de finalización

- Todos los RF con test en verde y la verificación de P8 (`typecheck`, `lint`, `format:check`, `test`, `build` y `test:db`).
- La aplicación de Google está publicada (no en modo de pruebas) sin verificar, y un usuario que no está en ninguna lista de pruebas puede conectar su cuenta de Google pasando por el aviso de "aplicación no verificada".
- Demo manual en producción, con una cuenta real de Google: conectar, elegir dos calendarios, ver los eventos, cambiar un evento en el proveedor y comprobar que llega con "Actualizar ahora", compartir uno con otra persona, desconectar conservando uno y borrando otro.
- Demo manual de grupos: crear un grupo, meter calendarios, reordenar, ocultar y mostrar el grupo.
- Revisión visual a 390, 768 y 1440 px con el acento rojo y el amarillo (P9).
- Comprobación de que ningún secreto ni autorización del proveedor llega al navegador (`no-secrets` y revisión del diff).
- Aprobación explícita del usuario para cerrar la spec.

## Dudas abiertas

Resueltas el 2026-10-23 (ver la cabecera): verificación de Google, tipos de cuenta de Microsoft, cifras, alcance de los grupos, juntar calendarios traídos y dependencias. Quedan:

(Resuelta 2026-10-23: un calendario sin propietario agrupado aparece dentro del grupo con la etiqueta "Sin propietario"; ver RF-46.)
(Resuelta 2026-10-23: no se verifica con Google, así que no hace falta dominio propio ni política de privacidad pública.)
(Resuelta 2026-10-23 con la documentación de Google: el límite de 7 días solo aplica al estado "Testing"; una aplicación publicada conserva la autorización mientras no se revoque ni pase seis meses sin usarse.)
