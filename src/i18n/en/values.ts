// Texts with values filled in where they are shown (spec 053 T4).
export const values: Record<string, string> = {
  "Se ha actualizado hace poco. Podrás volver a actualizar dentro de 1 minuto.":
    "It was updated a moment ago. You can update again in 1 minute.",
  "Se ha actualizado hace poco. Podrás volver a actualizar dentro de {minutes} minutos.":
    "It was updated a moment ago. You can update again in {minutes} minutes.",
  "Actualizado: {summary}": "Updated: {summary}",
  "1 calendario no se ha podido actualizar.":
    "1 calendar could not be updated.",
  "{failed} calendarios no se han podido actualizar.":
    "{failed} calendars could not be updated.",
  "{person} ha eliminado su cuenta. El calendario «{name}» se queda sin propietario: decide si lo conservas o sales de él.":
    "{person} deleted their account. The calendar “{name}” has no owner now: decide whether to keep it or leave it.",
  "Ya tienes tu copia de «{name}» en tu lista.":
    "Your copy of “{name}” is now in your list.",
  "El calendario «{name}» se ha eliminado porque nadie decidió conservarlo.":
    "The calendar “{name}” was deleted because nobody chose to keep it.",
  "iCloud ya no acepta la contraseña de la cuenta {name}. Pasa al cambiar la contraseña del Apple ID o al revocar la contraseña específica de app. Sus calendarios se conservan, pero no se actualizan: vuelve a conectarla con una contraseña nueva.":
    "iCloud no longer accepts the password of the account {name}. This happens when the Apple ID password changes or the app-specific password is revoked. Its calendars are kept but not updated: connect it again with a new password.",
  "Google ha retirado el permiso de CaFam en la cuenta {name}. Sus calendarios se conservan, pero no se actualizan.":
    "Google removed CaFam's access to the account {name}. Its calendars are kept but not updated.",
  "La actualización de «{name}» ha fallado 3 veces seguidas. Se seguirá intentando.":
    "Updating “{name}” failed 3 times in a row. It will keep trying.",
  "No se pudo actualizar «{name}» desde su enlace.":
    "“{name}” could not be updated from its link.",
  "{person} te ha traspasado «{name}». Ahora es tuyo: puedes editarlo, compartirlo y decidir quién entra.":
    "{person} transferred “{name}” to you. It is yours now: you can edit it, share it and decide who joins.",
  "Calendario actualizado a las {time}": "Calendar updated at {time}",
  "No se ha podido leer la lista de calendarios de iCloud. Inténtalo más tarde.":
    "The iCloud calendar list could not be read. Try again later.",
  "No se ha podido leer la lista de calendarios de Google. Inténtalo más tarde.":
    "The Google calendar list could not be read. Try again later.",
  "1 evento": "1 event",
  "{count} eventos": "{count} events",
  "Se moverá 1 evento a «{name}».": "1 event will be moved to “{name}”.",
  "Se moverán {count} eventos a «{name}».":
    "{count} events will be moved to “{name}”.",
  "Añadido «{text}»": "Added “{text}”",
  "Hecho: «{text}»": "Done: “{text}”",
  "Pendiente otra vez: «{text}»": "Pending again: “{text}”",
  "Fecha de «{text}»: {due}": "Date of “{text}”: {due}",
  "Sin fecha: «{text}»": "No date: “{text}”",
  "Movido a la posición {place} de {total}":
    "Moved to position {place} of {total}",
  "Nota personal": "Personal note",
  "Se borrará para todos los miembros de «{name}». No se puede deshacer.":
    "It will be deleted for every member of “{name}”. This cannot be undone.",
  "Caduca en 1 día": "Expires in 1 day",
  "Caduca en {days} días": "Expires in {days} days",
  "una cuenta borrada": "a deleted account",
  "Borrado por {who} hoy": "Deleted by {who} today",
  "Borrado por {who} ayer": "Deleted by {who} yesterday",
  "Borrado por {who} hace {days} días": "Deleted by {who} {days} days ago",
  "Quedan {days} días": "{days} days left",
  serie: "series",
  "serie, {count} repeticiones": "series, {count} occurrences",
  "{verb} «{title}»": "{verb} “{title}”",
  "Venció el {day}": "Was due on {day}",
  "Para el {day}": "Due on {day}",
  "Copia antigua: ya no se actualiza desde {name}":
    "Old copy: no longer updated from {name}",
  "La cuenta de {name} solo puede ver este calendario, así que este evento solo se puede cambiar en {name}.":
    "The {name} account can only view this calendar, so this event can only be changed in {name}.",
  "Este evento viene de {name}. Para cambiarlo desde CaFam, el propietario tiene que volver a conectar la cuenta.":
    "This event comes from {name}. To change it from CaFam, the owner has to connect the account again.",
  "La cuenta de {name} solo puede ver este calendario, así que no se puede pegar en él.":
    "The {name} account can only view this calendar, so nothing can be pasted into it.",
  "Para pegar en este calendario, el propietario tiene que volver a conectar la cuenta de {name}.":
    "To paste into this calendar, the owner has to connect the {name} account again.",
  // Undo verbs, looked up through a map (undo-stack.ts, stack-cards.ts).
  mover: "move",
  "cambiar la duración": "change the duration of",
  "cambiar el color": "change the color of",
  borrar: "delete",
  pegar: "paste",
  crear: "create",
  duplicar: "duplicate",
  cambiar: "change",
  Nota: "Note",
  "Serie creada": "Series created",
};
