// Spec 053: English for the messages of lib/* and the server actions
// (errors, schemas, labels), plus the titles passed to translating props.
export const modules = {
  // Auth pages
  "Recuperar contraseña": "Recover password",
  "¿Te acordaste?": "Remembered it?",
  "Inicia sesión": "Sign in",
  "¿No tienes cuenta?": "No account?",
  "Crea una": "Create one",
  "¿El enlace ha caducado?": "Has the link expired?",
  "Revisa tu correo": "Check your email",
  "¿Ya lo confirmaste?": "Already confirmed it?",
  "¿Ya tienes cuenta?": "Already have an account?",
  // Page titles and back links
  "Todavía no tienes calendarios": "You have no calendars yet",
  "¿Borrar «{name}»?": "Delete “{name}”?",
  "Se borrarán también todos sus eventos y sus categorías. No se puede deshacer.":
    "All its events and categories will be deleted too. This cannot be undone.",
  "Compartir calendario": "Share calendar",
  "Subir a una cuenta conectada": "Upload to a connected account",
  "Volver a Mis calendarios": "Back to My calendars",
  "Volver a Cuentas conectadas": "Back to Connected accounts",
  "Cuenta conectada": "Connected account",
  "Volver al calendario": "Back to the calendar",
  Evento: "Event",
  "Volver a Notas": "Back to Notes",
  "Formas de entrar": "Ways to sign in",
  Perfil: "Profile",
  Asistente: "Assistant",
  Email: "Email",
  "Tus datos": "Your data",
  Notificaciones: "Notifications",
  "CaFam, inicio": "CaFam, home",
  "Más formas de añadir calendarios": "More ways to add calendars",
  "Conectar una cuenta": "Connect an account",
  Invitación: "Invitation",
  "Invitación a un calendario": "Invitation to a calendar",
  "Página no encontrada": "Page not found",
  "No encontramos esta página": "We cannot find this page",
  "Puede que el enlace esté mal, que ya no exista o que no tengas acceso.":
    "The link may be wrong, no longer exist, or you may not have access.",
  "Eventos citados": "Cited events",
  "Cargando calendario…": "Loading calendar…",
  "Cargando comentarios…": "Loading comments…",
  "Sin categoría": "No category",
  // Privacy section titles
  "Entrar con Google": "Sign in with Google",
  "Qué datos de Google lee CaFam": "What Google data CaFam reads",
  "Qué escribe CaFam en Google": "What CaFam writes in Google",
  "Para qué se usan": "What they are used for",
  "Dónde se guardan": "Where they are stored",
  "Con quién se comparten": "Who they are shared with",
  "Cómo retirar el permiso y borrar los datos":
    "How to withdraw the permission and delete the data",
  "Calendarios de iCloud": "iCloud calendars",
  "Disponibilidad en el calendario": "Availability in the calendar",
  "Asistente de chat": "Chat assistant",
  "Voz en el asistente": "Voice in the assistant",
  "Imágenes en el asistente": "Images in the assistant",
  "Datos guardados en este dispositivo": "Data stored on this device",
  "Exportar y suscripción (.ics)": "Export and subscription (.ics)",
  Contacto: "Contact",
  // Confirmations
  Desconectar: "Disconnect",
  "¿Desconectar la cuenta de {provider}?": "Disconnect the {provider} account?",
  "Sí, desconectar": "Yes, disconnect",
  "La cuenta {email} no trae ningún calendario a CaFam. CaFam dejará de tener permiso en tu cuenta de {provider}.":
    "The account {email} brings no calendar to CaFam. CaFam will no longer have permission in your {provider} account.",
  "La cuenta {email} trae 1 calendario a CaFam. CaFam dejará de tener permiso en tu cuenta de {provider}.":
    "The account {email} brings 1 calendar to CaFam. CaFam will no longer have permission in your {provider} account.",
  "La cuenta {email} trae {count} calendarios a CaFam. CaFam dejará de tener permiso en tu cuenta de {provider}.":
    "The account {email} brings {count} calendars to CaFam. CaFam will no longer have permission in your {provider} account.",
  "«{name}», con 1 persona": "“{name}”, with 1 person",
  "«{name}», con {count} personas": "“{name}”, with {count} people",
  "Borrar imagen": "Delete image",
  Revocar: "Revoke",
  "Revocar invitación de {role}": "Revoke {role} invitation",
  "¿Revocar esta invitación?": "Revoke this invitation?",
  "El enlace dejará de funcionar de inmediato. Quienes ya se unieron con él mantienen su acceso.":
    "The link will stop working right away. Those who already joined with it keep their access.",
  "Sí, revocar": "Yes, revoke",
  // Server actions
  "Petición no válida.": "Invalid request.",
  "No tienes ningún calendario en el que puedas crear eventos.":
    "You have no calendar where you can create events.",
  "No sé crear esa repetición: no da ninguna fecha o no es una regla que CaFam pueda guardar. Dímela de otra forma.":
    "I cannot create that repeat: it gives no date or it is not a rule CaFam can save. Tell me another way.",
  "Este cambio ya no es válido. Pídemelo otra vez.":
    "This change is no longer valid. Ask me again.",
  "La propuesta no es válida. Empieza una nueva.":
    "The proposal is not valid. Start a new one.",
  "Esa cuenta ya tiene 20 calendarios traídos, el máximo.":
    "That account already brings 20 calendars, the maximum.",
  "Elige una de tus cuentas de Google que puedan escribir.":
    "Pick one of your Google accounts that can write.",
  "Calendario actualizado desde su enlace.": "Calendar updated from its link.",
  "No se ha podido actualizar desde el enlace.":
    "Could not update from the link.",
  "Se acaba de actualizar: espera unos minutos.":
    "It has just been updated: wait a few minutes.",
  "No se ha podido dejar de actualizar.": "Could not stop updating.",
  "Ya no se actualiza desde el enlace. Los eventos se quedan.":
    "It no longer updates from the link. The events stay.",
  "Este calendario ya no está disponible.":
    "This calendar is no longer available.",
  "Esta cuenta ya no existe o no es tuya.":
    "This account no longer exists or is not yours.",
  "Puedes traer como máximo 20 calendarios por cuenta.":
    "You can bring at most 20 calendars per account.",
  "Elige si conservas o borras los calendarios que dejas de traer.":
    "Choose whether to keep or delete the calendars you stop bringing.",
  "Elige si conservas o borras los calendarios de esta cuenta.":
    "Choose whether to keep or delete the calendars of this account.",
  "Esta imagen ya no existe.": "This image no longer exists.",
  "No se han podido guardar los avisos. Inténtalo de nuevo.":
    "The reminders could not be saved. Try again.",
  "No se ha podido enviar este cambio: no es válido.":
    "This change could not be sent: it is not valid.",
  "La repetición no es válida.": "The repeat is not valid.",
  "No se ha podido guardar el perfil. Inténtalo de nuevo.":
    "The profile could not be saved. Try again.",
  "No se ha podido guardar el color. Inténtalo de nuevo.":
    "The colour could not be saved. Try again.",
  "No se ha podido guardar el tema. Inténtalo de nuevo.":
    "The theme could not be saved. Try again.",
  "No se ha podido guardar el permiso. Inténtalo de nuevo.":
    "The permission could not be saved. Try again.",
  "Así se verán tus avisos.": "This is how your notifications will look.",
  "No se ha podido enviar el aviso. Vuelve a activarlos en este dispositivo.":
    "The notification could not be sent. Turn them on again on this device.",
  "Calendario compartido para familia y amigos.":
    "Shared calendar for family and friends.",
  // Components
  "No se han podido preparar tus datos. Inténtalo de nuevo.":
    "Your data could not be prepared. Try again.",
  "Listo: revisa tus descargas.": "Done: check your downloads.",
  "Si la dirección existe, te hemos enviado un correo con el enlace.":
    "If the address exists, we have sent you an email with the link.",
  "El enlace no es válido o ha caducado. Pide uno nuevo.":
    "The link is not valid or has expired. Ask for a new one.",
  "Una persona": "Someone",
  "Su propietario": "Its owner",
  "Queda 1 día para decidir.": "1 day left to decide.",
  "El plazo termina hoy.": "The deadline ends today.",
  "No aplicado": "Not applied",
  "Solo este evento de la serie.": "Only this event of the series.",
  "Este y los siguientes de la serie.":
    "This and the following ones of the series.",
  "Todos los eventos de la serie.": "All the events of the series.",
  "Solo este.": "Only this one.",
  "Este y los siguientes.": "This and the following ones.",
  "Toda la serie.": "The whole series.",
  "No borrado": "Not deleted",
  "No creada": "Not created",
  "Añadido a la nota": "Added to the note",
  "Hecho: lo he borrado.": "Done: I have deleted it.",
  "Hecho: he creado la serie.": "Done: I have created the series.",
  "Hecho: he aplicado los cambios.": "Done: I have applied the changes.",
  "Hecho: he aplicado el cambio.": "Done: I have applied the change.",
  "Para pasar la voz a texto, algunos navegadores la envían a un servicio de su fabricante (Google en Chrome, Apple en Safari). CaFam no recibe el audio.":
    "To turn voice into text, some browsers send it to a service of their maker (Google in Chrome, Apple in Safari). CaFam does not receive the audio.",
  "Ya existe un evento a esta hora": "There is already an event at this time",
  "Se ha creado 1 evento.": "1 event was created.",
  "Creando 1 evento…": "Creating 1 event…",
  "Te hemos enviado otro enlace.": "We have sent you another link.",
  "Ya te hemos enviado varios enlaces. Espera un poco antes de pedir otro.":
    "We have already sent you several links. Wait a little before asking for another.",
  "Has cancelado el inicio de sesión con Google.":
    "You cancelled signing in with Google.",
  "No se ha podido entrar con Google.": "Could not sign in with Google.",
  "1 categoría oculta": "1 hidden category",
  Día: "Day",
  "Día anterior": "Previous day",
  "Día siguiente": "Next day",
  Año: "Year",
  "Año anterior": "Previous year",
  "Año siguiente": "Next year",
  "4 días": "4 days",
  "4 días anteriores": "Previous 4 days",
  "4 días siguientes": "Next 4 days",
  "14 días anteriores": "Previous 14 days",
  "14 días siguientes": "Next 14 days",
  imágenes: "images",
  "No hay nada que deshacer.": "There is nothing to undo.",
  "No hay nada que rehacer.": "There is nothing to redo.",
  "Hay que volver a conectarla": "It needs to be connected again",
  "Todavía no se ha actualizado correctamente.":
    "It has not updated correctly yet.",
  "Visible en el calendario": "Visible in the calendar",
  "Parcialmente visible: algunos calendarios están ocultos":
    "Partly visible: some calendars are hidden",
  "Preparando…": "Preparing…",
  "En espera": "Waiting",
  "Se ha añadido 1 evento": "1 event was added",
  "Lista sin título": "Untitled list",
  "Nota sin título": "Untitled note",
  "Lista de tareas": "To-do list",
  "Elementos con casilla para ir tachando.":
    "Items with a checkbox to tick off.",
  "Nota de texto": "Text note",
  día: "day",
  días: "days",
  año: "year",
  años: "years",
  "Solo este evento": "Only this event",
  "Este y los siguientes": "This and the following ones",
  "Todos los eventos": "All the events",
  perderán: "will be lost",
  perderá: "will be lost",
  "Alguien se une a un calendario mío": "Someone joins a calendar of mine",
  "Me dan acceso a un calendario o me cambian el rol":
    "I get access to a calendar or my role changes",
  "Comentan en un evento que he creado o en el que he comentado":
    "Someone comments on an event I created or commented on",
  "Cambian o borran un evento que he creado":
    "Someone changes or deletes an event I created",
  "Cualquiera con este enlace verá todos los eventos del calendario. No se puede limitar a una persona.":
    "Anyone with this link will see all the events of the calendar. It cannot be limited to one person.",
  "Cambiar a tema claro": "Switch to light theme",
  "Cambiar a tema oscuro": "Switch to dark theme",
  // lib/account
  "La contraseña actual no es correcta.":
    "The current password is not correct.",
  "La contraseña nueva no puede ser igual a la actual.":
    "The new password cannot be the same as the current one.",
  "Esa dirección ya la usa otra cuenta.":
    "That address is already used by another account.",
  "Esa ya es tu dirección actual.": "That is already your current address.",
  "El email o la contraseña no coinciden.":
    "The email or the password do not match.",
  "Crea una contraseña antes de desconectar Google.":
    "Create a password before disconnecting Google.",
  "Tu cuenta ya tiene contraseña: cámbiala en «Contraseña».":
    "Your account already has a password: change it in “Password”.",
  "Contraseña creada.": "Password created.",
  "Elige una zona horaria válida.": "Pick a valid time zone.",
  "Escribe tu contraseña actual.": "Type your current password.",
  "Escribe tu contraseña.": "Type your password.",
  // lib/assistant
  "Cambio pendiente de confirmar": "Change waiting for confirmation",
  "Borrado pendiente de confirmar": "Deletion waiting for confirmation",
  "Serie pendiente de confirmar": "Series waiting for confirmation",
  "Evento creado y deshecho": "Event created and undone",
  "Cambio aplicado y deshecho": "Change applied and undone",
  "Evento borrado y restaurado": "Event deleted and restored",
  "Serie creada y deshecha": "Series created and undone",
  "Evento no creado": "Event not created",
  "Cambio no aplicado": "Change not applied",
  "Evento no borrado": "Event not deleted",
  "Serie no creada": "Series not created",
  "Esta conversación ya no está guardada.":
    "This conversation is no longer saved.",
  "El asistente no está disponible ahora mismo":
    "The assistant is not available right now",
  "No hay conexión. Comprueba tu conexión a internet e inténtalo de nuevo.":
    "No connection. Check your internet connection and try again.",
  "La conversación no es válida. Empieza una nueva.":
    "The conversation is not valid. Start a new one.",
  "Tu sesión ha caducado. Vuelve a entrar.":
    "Your session has expired. Sign in again.",
  "Escribe una pregunta.": "Type a question.",
  "Escribe un título.": "Type a title.",
  "Indica la hora de inicio y la de fin.": "Give the start and end times.",
  "El fin tiene que ser posterior al inicio.":
    "The end must be after the start.",
  "No he encontrado ningún horario ni evento en la imagen. Prueba con una foto más nítida o una captura.":
    "I found no schedule or event in the image. Try a sharper photo or a screenshot.",
  "El cuadrante tiene demasiadas personas para leer bien tu fila. Recorta la foto para que solo se vean la fila de las fechas y la tuya, y envíamela.":
    "The rota has too many people to read your row well. Crop the photo so only the row of dates and yours show, and send it to me.",
  "He leído 1 evento. Revísalo y pulsa «Crear».":
    "I read 1 event. Check it and press “Create”.",
  "Pensando…": "Thinking…",
  "Mirando tu calendario…": "Looking at your calendar…",
  "Calculando huecos libres…": "Working out free slots…",
  "Leyendo los comentarios…": "Reading the comments…",
  "Escribiendo la respuesta…": "Writing the answer…",
  "Leyendo la imagen…": "Reading the image…",
  "Revisando la propuesta…": "Checking the proposal…",
  "Creando el evento…": "Creating the event…",
  "Preparando el cambio…": "Preparing the change…",
  "Buscando en tus eventos…": "Searching your events…",
  "Preparando el borrado…": "Preparing the deletion…",
  "Preparando la serie…": "Preparing the series…",
  "Mirando tus notas…": "Looking at your notes…",
  "Apuntando en tus notas…": "Writing in your notes…",
  "¿Qué tengo hoy?": "What do I have today?",
  "¿Qué tengo esta semana?": "What do I have this week?",
  "¿Cuándo estamos todos libres?": "When are we all free?",
  "Crear un evento": "Create an event",
  "Crea un evento ": "Create an event ",
  "Buscar un evento": "Find an event",
  "Busca el evento ": "Find the event ",
  "Crear eventos desde una foto": "Create events from a photo",
  "¿Qué se ha comentado últimamente?": "What has been commented lately?",
  "¿Y mañana?": "And tomorrow?",
  "¿Qué tardes tengo libres esta semana?":
    "Which afternoons am I free this week?",
  "Solo los turnos de…": "Only the shifts of…",
  "Solo los turnos de ": "Only the shifts of ",
  "Es el horario de la semana que viene": "It is next week's schedule",
  // lib/auth
  "Ya existe una cuenta con este email.":
    "There is already an account with this email.",
  "Email o contraseña incorrectos.": "Wrong email or password.",
  "La contraseña debe tener al menos 8 caracteres.":
    "The password must have at least 8 characters.",
  "Demasiados intentos. Espera unos minutos y vuelve a probar.":
    "Too many attempts. Wait a few minutes and try again.",
  "Confirma tu email antes de entrar.": "Confirm your email before signing in.",
  "Introduce un email válido.": "Enter a valid email.",
  "Introduce tu nombre.": "Enter your name.",
  "El nombre no puede superar los 50 caracteres.":
    "The name cannot be longer than 50 characters.",
  "La contraseña no puede superar los 72 caracteres.":
    "The password cannot be longer than 72 characters.",
  // lib/calendar
  "Ya existe una categoría con ese nombre.":
    "There is already a category with that name.",
  "Ya tienes un grupo con ese nombre.":
    "You already have a group with that name.",
  "Ese grupo ya no existe.": "That group no longer exists.",
  "No tienes permiso para hacer esto.":
    "You do not have permission to do this.",
  "Solo puedes juntar calendarios de los que eres propietario.":
    "You can only merge calendars you own.",
  "Esa categoría no existe en el calendario elegido.":
    "That category does not exist in the chosen calendar.",
  "Este elemento ya no existe.": "This item no longer exists.",
  "Revisa los datos e inténtalo de nuevo.": "Check the data and try again.",
  mié: "Wed",
  sáb: "Sat",
  Melocotón: "Peach",
  Limón: "Lemon",
  Orquídea: "Orchid",
  Salmón: "Salmon",
  "Elige uno de los colores de la paleta.":
    "Pick one of the colours of the palette.",
  "La descripción no puede superar los 500 caracteres.":
    "The description cannot be longer than 500 characters.",
  "Escribe un título de 1 a 100 caracteres.":
    "Type a title of 1 to 100 characters.",
  "Elige un calendario.": "Pick a calendar.",
  "La descripción no puede superar los 2000 caracteres.":
    "The description cannot be longer than 2000 characters.",
  "El lugar no puede superar los 200 caracteres.":
    "The location cannot be longer than 200 characters.",
  "Elige una categoría válida.": "Pick a valid category.",
  "El fin no puede ser anterior al inicio.":
    "The end cannot be before the start.",
  "Introduce una fecha de inicio válida.": "Enter a valid start date.",
  "Introduce una fecha de fin válida.": "Enter a valid end date.",
  "Introduce una hora de inicio válida.": "Enter a valid start time.",
  "Introduce una hora de fin válida.": "Enter a valid end time.",
  "El resultado debe ser uno de los calendarios elegidos.":
    "The result must be one of the chosen calendars.",
  "N o C": "N or C",
  "Ir a hoy": "Go to today",
  "Vista día": "Day view",
  "Vista año": "Year view",
  "Vista 4 días": "4-day view",
  "Ver los atajos": "Show the shortcuts",
  "Mover el evento 15 minutos": "Move the event 15 minutes",
  "Mover el evento un día": "Move the event one day",
  "Borrar el evento": "Delete the event",
  "Copiar el evento": "Copy the event",
  "Pegar el evento copiado": "Paste the copied event",
  "Deshacer la última acción": "Undo the last action",
  "Ctrl + Mayús + Z": "Ctrl + Shift + Z",
  "Rehacer lo deshecho (también Ctrl + Y)":
    "Redo what was undone (also Ctrl + Y)",
  "Menú o Mayús + F10": "Menu or Shift + F10",
  "Abrir el menú del evento": "Open the event menu",
  "Editar el evento con su detalle abierto":
    "Edit the event with its detail open",
  "Ya no está en la papelera.": "It is no longer in the trash.",
  "Queda menos de 1 día": "Less than 1 day left",
  "repetición de una serie": "repetition of a series",
  "serie, 1 repetición": "series, 1 repetition",
  "cambiar la duración": "change the length",
  "Duración cambiada": "Length changed",
  "Ya no se puede deshacer.": "It can no longer be undone.",
  "Elige una duración de la lista.": "Pick a length from the list.",
  // lib/comments
  "Escribe un comentario.": "Type a comment.",
  "Este evento ya no existe o ya no tienes acceso.":
    "This event no longer exists or you no longer have access.",
  "Este comentario ya no existe.": "This comment no longer exists.",
  "Ya no tienes acceso a este calendario.":
    "You no longer have access to this calendar.",
  // lib/ics
  "No se ha podido leer el enlace. Comprueba que es público y vuelve a intentarlo.":
    "The link could not be read. Check that it is public and try again.",
  "El calendario no tiene eventos que se puedan importar.":
    "The calendar has no events that can be imported.",
  "No se ha podido crear el calendario. No se ha guardado nada.":
    "The calendar could not be created. Nothing was saved.",
  "El enlace ya no existe: el servidor dice que no lo encuentra.":
    "The link no longer exists: the server says it cannot find it.",
  "No puedes añadir eventos a ese calendario. No se ha guardado nada.":
    "You cannot add events to that calendar. Nothing was saved.",
  "El calendario pasaría de 10.000 eventos importados. No se ha guardado nada.":
    "The calendar would go over 10,000 imported events. Nothing was saved.",
  "No se han podido guardar los cambios del enlace.":
    "The changes from the link could not be saved.",
  "Elige el calendario.": "Pick the calendar.",
  "Indica un enlace o sube un archivo, no los dos.":
    "Give a link or upload a file, not both.",
  "Escribe un nombre de 1 a 50 caracteres.":
    "Type a name of 1 to 50 characters.",
  "Solo se puede mantener actualizado desde un enlace, no desde un archivo.":
    "It can only be kept up to date from a link, not from a file.",
  // lib/images
  "Este evento ya tiene 10 imágenes.": "This event already has 10 images.",
  "Has llegado al límite de 300 imágenes. Borra alguna para subir más.":
    "You have reached the limit of 300 images. Delete some to upload more.",
  "CaFam se ha quedado sin espacio para imágenes. Las que ya hay siguen guardadas.":
    "CaFam has run out of space for images. The ones already there stay saved.",
  "Solo se admiten imágenes JPEG, PNG, WebP o HEIC.":
    "Only JPEG, PNG, WebP or HEIC images are accepted.",
  "La imagen pesa más de 20 MB.": "The image is larger than 20 MB.",
  "Este navegador no puede leer esta imagen.":
    "This browser cannot read this image.",
  "La imagen tiene demasiado detalle para el asistente. Prueba con una captura más pequeña.":
    "The image has too much detail for the assistant. Try a smaller screenshot.",
  "No se ha podido subir la imagen.": "The image could not be uploaded.",
  "Solo cabe 1 imagen más": "Only 1 more image fits",
  // lib/notes
  mañana: "tomorrow",
  "No se ha podido conectar. Comprueba tu conexión e inténtalo de nuevo.":
    "Could not connect. Check your connection and try again.",
  "Esta nota ya no existe o no tienes permiso para cambiarla.":
    "This note no longer exists or you are not allowed to change it.",
  "No tienes permiso para hacer esto en esta nota.":
    "You are not allowed to do this in this note.",
  "No se ha podido guardar: revisa lo que has escrito.":
    "Could not save: check what you wrote.",
  "Sin elementos": "No items",
  "Para hoy": "For today",
  "Identificador no válido.": "Invalid identifier.",
  "Escribe algo para añadirlo.": "Type something to add it.",
  "Elige lista o texto.": "Pick list or text.",
  "Elige un color de la lista.": "Pick a colour from the list.",
  "Elige una fecha válida.": "Pick a valid date.",
  "Nada que cambiar.": "Nothing to change.",
  "Fecha no válida.": "Invalid date.",
  "Hora no válida.": "Invalid time.",
  "Una hora necesita su fecha.": "A time needs its date.",
  // lib/offline
  "Orden de la lista": "Order of the list",
  Sí: "Yes",
  "Necesita conexión": "Needs a connection",
  "Disponible con conexión": "Available with a connection",
  "Estas fechas no están disponibles sin conexión":
    "These dates are not available offline",
  "Descripción disponible con conexión":
    "Description available with a connection",
  "Esta pantalla necesita conexión. Vuelve cuando tengas red o sigue con el calendario y las notas.":
    "This screen needs a connection. Come back when you have a network or carry on with the calendar and notes.",
  "Pendiente de enviar": "Waiting to be sent",
  "Cambios no enviados": "Unsent changes",
  "Cambios por revisar": "Changes to review",
  "Este dispositivo aún no tiene una copia de tus datos. Conéctate una vez para usar CaFam sin conexión.":
    "This device has no copy of your data yet. Connect once to use CaFam offline.",
  "Conexión recuperada": "Connection back",
  "Cerrar sesión igualmente": "Sign out anyway",
  "Para cerrar sesión necesitas conexión.":
    "You need a connection to sign out.",
  "Conservar la mía": "Keep mine",
  "Conservar la suya": "Keep theirs",
  "Volver a crearlo": "Create it again",
  "Descartar mi cambio": "Discard my change",
  "Conservar el suyo": "Keep theirs",
  "Tu versión": "Your version",
  "La versión de la otra persona": "The other person's version",
  "Otra persona lo ha borrado.": "Someone else has deleted it.",
  "Sin conexión puedes dejar como mucho 20 imágenes pendientes de enviar.":
    "Offline you can leave at most 20 images waiting to be sent.",
  "La imagen completa necesita conexión": "The full image needs a connection",
  "Este dispositivo no tiene espacio para guardar más imágenes sin conexión.":
    "This device has no space to keep more images offline.",
  "imágenes guardadas": "images kept",
  "La cuenta de este calendario necesita volver a conectarse. Tus cambios esperan y se enviarán al conectarla.":
    "The account of this calendar needs to be connected again. Your changes wait and will be sent when it is connected.",
  "Otra persona lo ha cambiado mientras no tenías conexión.":
    "Someone else changed it while you were offline.",
  "Buscando solo en los datos de este dispositivo (de hoy −1 mes a +3 meses)":
    "Searching only the data on this device (from today −1 month to +3 months)",
  // lib/push
  "Al empezar": "When it starts",
  "1 día antes": "1 day before",
  "2 días antes": "2 days before",
  "El mismo día a las 9:00": "The same day at 9:00",
  "El día anterior a las 9:00": "The day before at 9:00",
  "Una semana antes a las 9:00": "A week before at 9:00",
  // lib/recurrence
  "Elige una repetición válida.": "Pick a valid repeat.",
  "Con este final la serie no tiene ninguna repetición.":
    "With this end the series has no repetition.",
  "Los calendarios traídos de Google o iCloud no admiten repeticiones en CaFam.":
    "Calendars brought from Google or iCloud do not accept repeats in CaFam.",
  "Este calendario ya tiene 500 series. Borra alguna para crear otra.":
    "This calendar already has 500 series. Delete one to create another.",
  "Esta serie ya tiene 100 cambios sueltos. Usa «Este y los siguientes».":
    "This series already has 100 single changes. Use “This and the following ones”.",
  "Para cambiar de calendario, elige «Todos los eventos» o «Este y los siguientes».":
    "To change the calendar, pick “All the events” or “This and the following ones”.",
  "Para cambiar la repetición, elige «Todos los eventos» o «Este y los siguientes».":
    "To change the repeat, pick “All the events” or “This and the following ones”.",
  "Esta repetición ya no existe.": "This repetition no longer exists.",
  "Elige a qué eventos se aplica.": "Pick which events it applies to.",
  "No se repite": "Does not repeat",
  "Cada día": "Every day",
  "Todos los días laborables (lunes a viernes)":
    "Every weekday (Monday to Friday)",
  último: "last",
  miércoles: "Wednesday",
  sábado: "Saturday",
  // lib/sharing
  "Esta invitación ya no es válida.": "This invitation is no longer valid.",
  "ID o PIN incorrectos.": "Wrong ID or PIN.",
  "Demasiados intentos. Espera 15 minutos y vuelve a probar.":
    "Too many attempts. Wait 15 minutes and try again.",
  "El propietario no puede salir de su calendario ni ser expulsado. Para dejar de serlo, borra el calendario.":
    "The owner cannot leave their calendar or be removed. To stop being the owner, delete the calendar.",
  "Elige un rol.": "Pick a role.",
  "Elige entre 1 y 20 usos.": "Pick between 1 and 20 uses.",
  "El PIN debe tener entre 6 y 10 dígitos.":
    "The PIN must have between 6 and 10 digits.",
  "Escribe el ID del calendario.": "Type the calendar ID.",
  "Escribe el PIN.": "Type the PIN.",
  "Elige a un miembro del calendario.": "Pick a member of the calendar.",
  "Escribe el nombre del calendario tal cual para confirmar.":
    "Type the calendar name exactly to confirm.",
  "Un calendario traído de Google o iCloud no se puede traspasar: la cuenta conectada es tuya. Primero deja de traerlo y consérvalo.":
    "A calendar brought from Google or iCloud cannot be transferred: the connected account is yours. First stop bringing it and keep it.",
  // lib/speech
  "No hay permiso para usar el micrófono. Puedes darlo en los ajustes del navegador.":
    "There is no permission to use the microphone. You can give it in the browser settings.",
  "No se ha podido escuchar. Inténtalo de nuevo.":
    "Could not listen. Try again.",
  // lib/sync
  "No se ha conectado la cuenta: se canceló la autorización en Google. Si no la cancelaste tú, puede que la aplicación no tenga plazas disponibles para usuarios nuevos.":
    "The account was not connected: the authorisation was cancelled in Google. If you did not cancel it, the app may have no places left for new users.",
  "No se ha podido conectar con Google. Inténtalo de nuevo dentro de un momento.":
    "Could not connect to Google. Try again in a moment.",
  "Ya tienes 5 cuentas conectadas, el máximo. Desconecta una para conectar otra.":
    "You already have 5 connected accounts, the maximum. Disconnect one to connect another.",
  "iCloud no ha aceptado el Apple ID o la contraseña. Hace falta una contraseña específica de app creada en account.apple.com, no la contraseña normal del Apple ID.":
    "iCloud did not accept the Apple ID or the password. You need an app-specific password created at account.apple.com, not the usual Apple ID password.",
  "Escribe tu Apple ID, el correo con el que entras en iCloud.":
    "Type your Apple ID, the email you sign in to iCloud with.",
  "Escribe la contraseña específica de app que creaste en account.apple.com: 16 letras, como abcd-efgh-ijkl-mnop.":
    "Type the app-specific password you created at account.apple.com: 16 letters, like abcd-efgh-ijkl-mnop.",
  "La última actualización falló. Se volverá a intentar en la siguiente.":
    "The last update failed. It will be tried again on the next one.",
  "Google ha retirado el permiso de CaFam. Vuelve a conectar la cuenta para seguir actualizando.":
    "Google has withdrawn CaFam's permission. Connect the account again to keep updating.",
  "Este calendario ya no existe en la cuenta de Google.":
    "This calendar no longer exists in the Google account.",
  "iCloud ya no acepta la contraseña de esta cuenta. Pasa al cambiar la contraseña del Apple ID o al revocarla: vuelve a conectarla con una contraseña específica de app nueva.":
    "iCloud no longer accepts the password of this account. It happens when the Apple ID password changes or it is revoked: connect it again with a new app-specific password.",
  "Google ya no deja a CaFam usar esta cuenta. Vuelve a conectarla para guardar cambios.":
    "Google no longer lets CaFam use this account. Connect it again to save changes.",
  "Google no ha permitido el cambio, así que no se ha guardado.":
    "Google did not allow the change, so it was not saved.",
  "Este evento se había borrado en Google y se ha quitado de CaFam.":
    "This event had been deleted in Google and has been removed from CaFam.",
  "iCloud ya no acepta la contraseña de esta cuenta. Vuelve a conectarla con una contraseña específica de app nueva.":
    "iCloud no longer accepts the password of this account. Connect it again with a new app-specific password.",
  "iCloud no ha permitido el cambio, así que no se ha guardado.":
    "iCloud did not allow the change, so it was not saved.",
  "Este evento se había borrado en iCloud y se ha quitado de CaFam.":
    "This event had been deleted in iCloud and has been removed from CaFam.",
  // lib/theme
  Ámbar: "Amber",
  "Elige uno de los temas disponibles.": "Pick one of the available themes.",
  "Elige uno de los colores disponibles.": "Pick one of the available colours.",
  "Como el sistema": "Like the system",
  // Texts with values (spec 053 T4)
  "Imágenes: {n} de {total}": "Images: {n} of {total}",
  "Quedan {days} días para decidir.": "{days} days left to decide.",
  "Hemos puesto tu zona en {saved}. ¿Es correcta?":
    "We set your time zone to {saved}. Is it right?",
  "No he podido aplicar el cambio: {failed}":
    "I could not apply the change: {failed}",
  "Se han creado {n} eventos.": "{n} events were created.",
  "Creando {n} eventos…": "Creating {n} events…",
  "Te hemos enviado un enlace a {email}. Ábrelo para entrar.":
    "We have sent a link to {email}. Open it to sign in.",
  "Ocupado de {hours}": "Busy from {hours}",
  " a ": " to ",
  "Completada «{text}»": "Done: “{text}”",
  "{count} categorías ocultas": "{count} hidden categories",
  "Más vistas: {label}": "More views: {label}",
  "¿Juntar en «{name}»?": "Merge into “{name}”?",
  "Nuevo comentario de {author}": "New comment from {author}",
  "Última actualización correcta: {when}.": "Last successful update: {when}.",
  "{series} series se subirán": "{series} series will be uploaded",
  "Traído de {provider}, actualizado el {when}.":
    "Brought from {provider}, updated on {when}.",
  "Traído de {provider}, todavía no se ha actualizado.":
    "Brought from {provider}, not updated yet.",
  "1 imagen compartida espera un evento":
    "1 shared image is waiting for an event",
  "{n} imágenes compartidas esperan un evento":
    "{n} shared images are waiting for an event",
  "Actualizado desde un enlace · {when}": "Updated from a link · {when}",
  "Último fallo: {error}": "Last failure: {error}",
  "Se han añadido {created} eventos": "{created} events were added",
  "El código {code} está desactivado. Para activarlo de nuevo elige un PIN nuevo (de 6 a 10 dígitos).":
    "The code {code} is turned off. To turn it on again pick a new PIN (6 to 10 digits).",
  "«{title}» restaurado": "“{title}” restored",
  "«{title}» borrado para siempre": "“{title}” deleted for ever",
  "¿En qué calendario creo los eventos? Puedes elegir: {options}.":
    "Which calendar should I create the events in? You can choose: {options}.",
  "¿En cuál de estos calendarios? {options}.":
    "In which of these calendars? {options}.",
  "No puedes crear eventos en «{name}». Puedes crear eventos en: {options}.":
    "You cannot create events in “{name}”. You can create events in: {options}.",
  "No encuentro el calendario «{name}». Puedes crear eventos en: {options}.":
    "I cannot find the calendar “{name}”. You can create events in: {options}.",
  "He leído {count} eventos. Revísalos y pulsa «Crear».":
    "I read {count} events. Check them and press “Create”.",
  "He dejado fuera 1 evento: como mucho propongo {max}.":
    "I left out 1 event: I propose {max} at most.",
  "He dejado fuera {count} eventos: como mucho propongo {max}.":
    "I left out {count} events: I propose {max} at most.",
  "No he podido leer: {what}.": "I could not read: {what}.",
  "Buscando «{query}»…": "Searching for “{query}”…",
  "Creando «{title}»…": "Creating “{title}”…",
  "Sin conexión · datos del {date} a las {time}":
    "Offline · data from {date} at {time}",
  "Sin conexión · datos de las {time}": "Offline · data from {time}",
  "1 cambio sincronizado": "1 change synced",
  "{n} cambios sincronizados": "{n} changes synced",
  "1 cambio pendiente": "1 pending change",
  "{n} cambios pendientes": "{n} pending changes",
  "Tienes 1 cambio sin enviar. Si cierras sesión, se perderá.":
    "You have 1 unsent change. If you sign out, it will be lost.",
  "Tienes {n} cambios sin enviar. Si cierras sesión, se perderán.":
    "You have {n} unsent changes. If you sign out, they will be lost.",
  "1 imagen guardada para enviar con conexión":
    "1 image kept to send when online",
  "{n} imágenes guardadas para enviar con conexión":
    "{n} images kept to send when online",
  "Ahora se repite: {summary}": "Now it repeats: {summary}",
  "{added}, {changed} y {removed}.": "{added}, {changed} and {removed}.",
  "1 añadido": "1 added",
  "{count} añadidos": "{count} added",
  "1 cambiado": "1 changed",
  "{count} cambiados": "{count} changed",
  "1 quitado": "1 removed",
  "{count} quitados": "{count} removed",
  "1 omitido por no ser válido.": "1 skipped for not being valid.",
  "{count} omitidos por no ser válidos.":
    "{count} skipped for not being valid.",
  "{count} más lejanos no se han traído por el límite de 2.000 eventos.":
    "{count} further away were not brought because of the 2,000-event limit.",
  "Este calendario ya no existe en la cuenta de {provider}.":
    "This calendar no longer exists in the {provider} account.",
  "Custom…": "Custom…",
};
