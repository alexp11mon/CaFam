import { spanishT, type T } from "@/lib/i18n/translate";

// Every visible text of the offline mode (spec 034 RNF-8). Strings are
// Spanish keys, translated where shown; functions take the translator (spec 053).

export const OFFLINE_MESSAGES = {
  needsNetwork: "Necesita conexión",
  onlyOnline: "Disponible con conexión",
  outOfRange: "Estas fechas no están disponibles sin conexión",
  descriptionOnline: "Descripción disponible con conexión",
  needsNetworkPage:
    "Esta pantalla necesita conexión. Vuelve cuando tengas red o sigue con el calendario y las notas.",
  pending: "Pendiente de enviar",
  unsent: "Cambios no enviados",
  conflicts: "Cambios por revisar",
  discard: "Descartar",
  noCopy:
    "Este dispositivo aún no tiene una copia de tus datos. Conéctate una vez para usar CaFam sin conexión.",
  offline: "Sin conexión",
  online: "Conexión recuperada",
  badge: (time: string, date: string | null, t: T = spanishT) =>
    date
      ? t("Sin conexión · datos del {date} a las {time}", { date, time })
      : t("Sin conexión · datos de las {time}", { time }),
  synced: (n: number, t: T = spanishT) =>
    n === 1
      ? t("1 cambio sincronizado")
      : t("{n} cambios sincronizados", { n }),
  pendingCount: (n: number, t: T = spanishT) =>
    n === 1 ? t("1 cambio pendiente") : t("{n} cambios pendientes", { n }),
  signOutWarning: (n: number, t: T = spanishT) =>
    n === 1
      ? t("Tienes 1 cambio sin enviar. Si cierras sesión, se perderá.")
      : t("Tienes {n} cambios sin enviar. Si cierras sesión, se perderán.", {
          n,
        }),
  signOutAnyway: "Cerrar sesión igualmente",
  signOutOffline: "Para cerrar sesión necesitas conexión.",
  cancel: "Cancelar",
  keepMine: "Conservar la mía",
  keepTheirs: "Conservar la suya",
  recreate: "Volver a crearlo",
  discardMine: "Descartar mi cambio",
  deleteAnyway: "Borrarlo igualmente",
  keepOthers: "Conservar el suyo",
  mine: "Tu versión",
  theirs: "La versión de la otra persona",
  goneByOther: "Otra persona lo ha borrado.",
  pendingImagesFull:
    "Sin conexión puedes dejar como mucho 20 imágenes pendientes de enviar.",
  fullImageNeedsNetwork: "La imagen completa necesita conexión",
  deviceFull:
    "Este dispositivo no tiene espacio para guardar más imágenes sin conexión.",
  imageRemoved: "Imagen quitada",
  imageDeleted: "Imagen borrada",
  imagesKept: (n: number, t: T = spanishT) =>
    n === 1
      ? t("1 imagen guardada para enviar con conexión")
      : t("{n} imágenes guardadas para enviar con conexión", { n }),
  remove: "Quitar",
  held: "La cuenta de este calendario necesita volver a conectarse. Tus cambios esperan y se enviarán al conectarla.",
  reconnect: "Volver a conectar",
  download: "Descargar",
  repeatsNow: (summary: string, t: T = spanishT) =>
    t("Ahora se repite: {summary}", { summary }),
  changedByOther: "Otra persona lo ha cambiado mientras no tenías conexión.",
} as const;
