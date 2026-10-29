# Spec 003 — Compartición de calendarios

> Estado: **Aprobada** por el usuario el 2026-10-21 (con el cambio de que el PIN lo elige el propietario). Constitución: `docs/constitution.md`. Parte de las specs 001 y 002 (cerradas).

## Contexto y objetivo

CaFam es un calendario compartido para familia y amigos, pero hasta ahora cada calendario tiene un único miembro: su propietario. Esta spec permite que el propietario de un calendario invite a otras personas con cuenta como Lector o Editor, por dos vías (un enlace de invitación y un ID de calendario con PIN), y gestione después quién forma parte de él. Los roles y la privacidad ya existen desde la spec 001 (nadie sin invitación ve nada, un Lector no modifica nada); aquí se construye la forma de incorporar, ver, cambiar y quitar miembros, sin perder el control del propietario. Resuelve también la duda que dejó la spec 002 sobre qué pasa al juntar calendarios que tienen miembros.

## Usuarios / actores

- **Propietario:** crea el calendario y es el único que lo comparte y gestiona a sus miembros.
- **Editor:** miembro que gestiona eventos y categorías del calendario, pero no a sus miembros.
- **Lector:** miembro que solo consulta el calendario.
- **Invitado:** persona con cuenta que usa un enlace o un ID con PIN para unirse.
- **Visitante con enlace:** persona sin sesión que abre un enlace de invitación y debe registrarse o entrar antes de unirse.

## Historias de usuario

- H1: Como propietario quiero crear un enlace de invitación con un rol y un límite de usos para compartir mi calendario sin dar acceso indefinido a cualquiera.
- H2: Como propietario quiero activar un ID y elegir un PIN para que alguien pueda unirse a mi calendario aunque no tenga el enlace.
- H3: Como propietario quiero revocar un enlace o cambiar el PIN para cortar el acceso si se filtra.
- H4: Como invitado quiero ver a qué calendario me invitan y con qué rol antes de unirme, para no entrar por error.
- H5: Como miembro quiero ver quién más está en el calendario y con qué rol, para saber con quién lo comparto.
- H6: Como propietario quiero cambiar el rol de un miembro o expulsarlo para controlar quién puede cambiar mis eventos.
- H7: Como miembro que no es propietario quiero poder abandonar un calendario para dejar de verlo.
- H8: Como propietario quiero saber qué pasa con los miembros cuando junto calendarios compartidos, para no dar o quitar acceso sin darme cuenta.

## Requisitos funcionales (criterios de aceptación en EARS)

### Invitación por enlace

- RF-1: CUANDO el Propietario crea una invitación indicando un rol (Lector o Editor) y un número máximo de usos, EL SISTEMA generará un enlace único para unirse a ese calendario y lo mostrará.
- RF-2: CUANDO se muestra un enlace de invitación, EL SISTEMA ofrecerá un botón "Copiar enlace".
- RF-3: SI el número máximo de usos de una invitación no está entre 1 y 20, ENTONCES EL SISTEMA no creará la invitación y mostrará el error junto al campo.
- RF-4: EL SISTEMA hará que cada invitación caduque a los 7 días de crearse.
- RF-5: CUANDO una persona con sesión abre un enlace de invitación válido, EL SISTEMA le mostrará el nombre del calendario, el nombre del propietario y el rol que recibirá, sin añadirla todavía.
- RF-6: CUANDO esa persona pulsa "Unirme", EL SISTEMA la añadirá como miembro con el rol de la invitación, consumirá un uso de la invitación y le mostrará el calendario.
- RF-7: MIENTRAS no haya sesión iniciada, EL SISTEMA llevará a quien abra un enlace de invitación a iniciar sesión o registrarse y, al terminar, la devolverá a la pantalla de esa invitación.
- RF-8: SI el enlace está caducado, revocado, agotado o no existe, ENTONCES EL SISTEMA mostrará "Esta invitación ya no es válida." sin indicar cuál es el motivo.
- RF-9: SI la persona que usa un enlace ya es miembro del calendario (también si es su propietario), ENTONCES EL SISTEMA no cambiará su rol, no consumirá ningún uso y la llevará al calendario.
- RF-10: CUANDO una invitación consume su último uso permitido, EL SISTEMA dejará de aceptarla.
- RF-11: EL SISTEMA mostrará al Propietario las invitaciones vigentes de cada uno de sus calendarios con su rol, los usos que quedan y su fecha de caducidad.
- RF-12: CUANDO el Propietario revoca una invitación, EL SISTEMA dejará de aceptarla de inmediato sin afectar a quienes ya se unieron con ella.
- RF-13: SI dos personas intentan usar a la vez el último uso de una invitación, ENTONCES EL SISTEMA añadirá solo a una y mostrará a la otra "Esta invitación ya no es válida.".

### Invitación por ID de calendario y PIN

- RF-14: CUANDO el Propietario activa el acceso por ID y PIN de un calendario eligiendo un rol (Lector o Editor) y un PIN, EL SISTEMA asignará al calendario un ID de 8 caracteres legibles, guardará el PIN elegido y mostrará el ID.
- RF-15: SI el PIN elegido no tiene entre 6 y 10 dígitos, ENTONCES EL SISTEMA no lo establecerá y mostrará el error junto al campo.
- RF-16: EL SISTEMA no mostrará el PIN después de establecerlo; el Propietario solo verá el ID.
- RF-17: CUANDO el Propietario cambia el PIN, EL SISTEMA invalidará el anterior de inmediato.
- RF-18: CUANDO el Propietario desactiva el acceso por ID y PIN, EL SISTEMA dejará de aceptar ese ID y ese PIN; para reactivarlo tendrá que elegir un PIN nuevo.
- RF-19: CUANDO una persona con sesión introduce un ID y un PIN correctos en "Unirme con código", EL SISTEMA la añadirá como miembro con el rol del código y le mostrará el calendario.
- RF-20: SI el ID o el PIN no son correctos (se ignoran las mayúsculas del ID y los espacios exteriores de ambos), ENTONCES EL SISTEMA mostrará "ID o PIN incorrectos." sin indicar cuál de los dos falla.
- RF-21: SI una persona acumula 5 intentos fallidos en 15 minutos, ENTONCES EL SISTEMA rechazará sus intentos durante 15 minutos con el mensaje "Demasiados intentos. Espera 15 minutos y vuelve a probar.".
- RF-22: SI un mismo ID acumula 20 intentos fallidos en 15 minutos entre todas las cuentas, ENTONCES EL SISTEMA rechazará cualquier intento sobre ese ID durante 15 minutos con el mensaje de RF-21.
- RF-23: SI la persona que usa un ID y un PIN correctos ya es miembro del calendario, ENTONCES EL SISTEMA no cambiará su rol y la llevará al calendario.

### Gestión de miembros

- RF-24: CUANDO un miembro abre la lista de miembros de un calendario, EL SISTEMA le mostrará el nombre visible y el rol de todos los miembros, incluido el propietario, y ningún dato de cuenta como el email.
- RF-25: CUANDO el Propietario cambia el rol de un miembro entre Lector y Editor, EL SISTEMA aplicará los nuevos permisos de inmediato y esa persona los verá en su siguiente carga de pantalla sin cerrar sesión.
- RF-26: CUANDO el Propietario expulsa a un miembro, EL SISTEMA le retirará de inmediato el acceso al calendario, a sus eventos y a sus categorías.
- RF-27: CUANDO un Editor o un Lector confirma que abandona un calendario, EL SISTEMA le retirará el acceso a ese calendario.
- RF-28: SI el Propietario intenta abandonar su calendario, expulsarse o cambiarse el rol, ENTONCES EL SISTEMA lo rechazará e indicará que, para dejar de ser propietario, el calendario se borra.
- RF-29: SI un Editor o un Lector intenta crear, ver o revocar invitaciones, gestionar el ID y el PIN, cambiar roles o expulsar, ENTONCES EL SISTEMA lo rechazará.
- RF-30: CUANDO una persona deja de ser miembro de un calendario, EL SISTEMA conservará los eventos y las categorías que creó en él.
- RF-31: CUANDO una persona deja de ser miembro de un calendario, EL SISTEMA lo quitará de su panel y de sus filtros y descartará sus preferencias de visibilidad y orden sobre ese calendario.

### Efectos en el panel y las vistas

- RF-32: CUANDO una persona se une a un calendario, EL SISTEMA lo mostrará en su panel y en sus vistas bajo el nombre de su propietario, visible y al final de la lista de calendarios de esa persona.
- RF-33: MIENTRAS el usuario sea Propietario de un calendario, EL SISTEMA mostrará en el panel un acceso a "Compartir y miembros" de ese calendario.
- RF-34: MIENTRAS el usuario sea Editor o Lector de un calendario, EL SISTEMA mostrará en el panel un acceso a la lista de miembros y a "Salir" de ese calendario.
- RF-35: EL SISTEMA mostrará en el panel un acceso a "Unirme con código" a cualquier usuario con sesión.

### Juntar calendarios que tienen miembros (pendiente de la spec 002)

- RF-36: ANTES de juntar calendarios, SI alguno de los elegidos tiene otros miembros además del Propietario, ENTONCES EL SISTEMA mostrará en la confirmación el nombre de quienes perderán el acceso porque su calendario desaparece.
- RF-37: ANTES de juntar calendarios, SI el calendario resultante ya tiene otros miembros, ENTONCES EL SISTEMA mostrará en la confirmación el nombre de quienes pasarán a ver eventos de los demás calendarios.
- RF-38: CUANDO se juntan calendarios, EL SISTEMA retirará el acceso a los miembros de los calendarios que desaparecen y conservará los miembros del calendario resultante.

## Requisitos no funcionales

- Privacidad (constitución P3): quien no es miembro de un calendario no ve su existencia, sus eventos, sus categorías ni sus miembros; se verifica con tests sobre la capa de datos, ampliando la matriz de permisos.
- Secretos: el enlace de invitación no se puede deducir de otros enlaces ni del calendario, y nadie que no sea el Propietario puede leer invitaciones ni el ID; el PIN no lo puede leer nadie, tampoco el Propietario.
- Fuerza bruta: con registro abierto, un atacante puede crear cuentas para adivinar un PIN; por eso hay un límite por persona (RF-21) y otro por ID (RF-22).
- Coste cero (P2): no se envía ningún correo ni mensaje; el Propietario comparte el enlace o el ID y el PIN por su cuenta.
- Mobile-first (P5): todas las pantallas nuevas se usan sin scroll horizontal entre 360 y 1920 px.
- Accesibilidad: los criterios de las specs 001 y 002 (etiquetas visibles, errores anunciados, botones de al menos 44 px, uso completo con teclado, contraste mínimo 4,5:1).
- Idioma: todo texto visible en español.

## Casos límite

- Dos personas usan a la vez el último uso de un enlace: solo una entra (RF-13).
- Un PIN fácil de adivinar, como 123456, es válido: lo elige el Propietario y las únicas defensas son los límites de RF-21 y RF-22.
- Un enlace se abre desde una previsualización automática de una aplicación de mensajería: no añade a nadie ni gasta usos, porque unirse exige pulsar "Unirme" (RF-5, RF-6).
- El Propietario abre su propio enlace: lo trata como miembro existente (RF-9).
- Un miembro expulsado vuelve a unirse con un enlace aún vigente: puede, y gasta un uso; para evitarlo el Propietario revoca el enlace.
- Un miembro abandona el calendario y vuelve con el mismo enlace vigente: puede, y gasta un uso.
- El calendario se borra mientras hay invitaciones vigentes: dejan de ser válidas.
- Varias personas se equivocan a la vez con un mismo ID y bloquean a quien lo usa bien: queda bloqueado 15 minutos (RF-22); el Propietario puede cambiar el PIN.
- Un Editor pasa a Lector mientras edita un evento: al guardar recibe el mensaje de permisos de la spec 002.
- Se cambia el rol de alguien o se le expulsa mientras tiene el calendario abierto: su siguiente acción falla con un mensaje claro y la siguiente carga refleja el cambio.
- Un ID con letras en minúscula o con espacios exteriores se acepta; un PIN con espacios exteriores se acepta; un PIN con caracteres que no son dígitos o con una longitud fuera de 6 a 10 se trata como incorrecto al unirse.
- Una persona con sesión abre un enlace que no es para ella: sigue pudiendo rechazarlo simplemente no pulsando "Unirme".
- Una persona está bloqueada por intentos fallidos y abre un enlace de invitación: el bloqueo solo afecta a ID y PIN, no a los enlaces.
- Un calendario con muchos miembros: la lista de miembros se muestra completa y sin scroll horizontal.

## Fuera de alcance

- Transferir la propiedad de un calendario a otra persona.
- Enviar invitaciones por correo, SMS o notificaciones, y avisos cuando alguien se une, sale o cambia de rol.
- Enlaces públicos que den acceso sin cuenta, incluso de solo lectura.
- Aprobación del Propietario antes de que alguien entre, y solicitudes de acceso.
- Más roles que Propietario, Editor y Lector, y permisos por evento o por categoría.
- Que un Editor invite o gestione miembros.
- Historial o auditoría de quién entró, salió o cambió de rol y cuándo.
- Bloquear a una persona para que no vuelva a unirse (se logra revocando el enlace o cambiando el PIN).
- Un PIN distinto por rol, o varios IDs por calendario.
- Rechazar PIN débiles con una lista de contraseñas prohibidas.
- Compartir suscripciones `.ics` (spec 004).
- Cambiar el nombre visible, el email o la contraseña, y borrar la cuenta (spec 005): los miembros se ven con el nombre con el que se registraron.
- Recuperar el PIN (hay que elegir uno nuevo) o ver un enlace ya creado si no se ha copiado (hay que generar uno nuevo).
- Uso sin conexión con datos, tema oscuro e internacionalización.

## Criterios de finalización

- Todos los RF tienen test en verde (unitario, de componente o de base de datos según corresponda) y el checklist de verificación obligatoria pasa completo.
- La matriz de permisos de `npm run test:db` cubre a Propietario, Editor, Lector, invitado y ajeno para invitaciones, ID y PIN y miembros.
- Demo manual en producción con dos cuentas, en móvil (≤ 768 px) y escritorio: compartir por enlace y por ID y PIN, unirse, ver la lista de miembros, cambiar un rol, expulsar, abandonar, revocar y juntar calendarios con miembros.
- Las migraciones están aplicadas en dev y en prod.
- El usuario aprueba el cierre de la spec.

## Dudas abiertas

- Ninguna pendiente. Quedan aprobadas junto con la spec estas decisiones: la caducidad de las invitaciones es fija, de 7 días, y el número de usos va de 1 a 20 (RF-3, RF-4); el enlace de una invitación solo se muestra al crearla (si se pierde, se crea otro y se revoca el anterior); y el PIN lo elige el Propietario, de 6 a 10 dígitos, y nadie puede volver a verlo (RF-14 a RF-16).
