// Every visible text of the offline mode (spec 034 RNF-8).

const plural = (n: number, one: string, many: string) =>
  `${n} ${n === 1 ? one : many}`;

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
  badge: (time: string, date: string | null) =>
    `Sin conexión · datos ${date ? `del ${date} a las` : "de las"} ${time}`,
  synced: (n: number) =>
    `${plural(n, "cambio sincronizado", "cambios sincronizados")}`,
  pendingCount: (n: number) =>
    plural(n, "cambio pendiente", "cambios pendientes"),
  signOutWarning: (n: number) =>
    `Tienes ${plural(n, "cambio sin enviar", "cambios sin enviar")}. Si cierras sesión, se perderán.`,
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
  imagesKept: (n: number) =>
    `${plural(n, "imagen guardada", "imágenes guardadas")} para enviar con conexión`,
  remove: "Quitar",
  changedByOther: "Otra persona lo ha cambiado mientras no tenías conexión.",
} as const;
