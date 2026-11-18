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
  syncedRejected: "Sin conexión no se puede escribir en Google ni en iCloud",
  readOnly: (provider: "google" | "icloud") =>
    `Sin conexión no se puede escribir en ${provider === "icloud" ? "iCloud" : "Google"}`,
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
  changedByOther: "Otra persona lo ha cambiado mientras no tenías conexión.",
} as const;
