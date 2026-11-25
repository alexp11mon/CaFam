// Spec 049, RF-12, RF-13: names of the files inside the export and its
// LEEME.txt. Pure.

const FORBIDDEN = /[<>:"/\\|?*\u0000-\u001f]/g;

/** A name every system accepts as a file name (Windows is the strictest). */
export function safeName(name: string, fallback = "sin nombre"): string {
  const clean = name
    .replace(FORBIDDEN, "_")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\.+|[. ]+$/g, "")
    .slice(0, 80)
    .trim();
  // Names Windows keeps for devices.
  return !clean || /^(con|prn|aux|nul|com\d|lpt\d)$/i.test(clean)
    ? fallback
    : clean;
}

/** Hands out names, adding " (2)", " (3)"… when two would be the same. */
export function uniqueNames() {
  const used = new Set<string>();
  return (name: string, extension = ""): string => {
    let candidate = name;
    for (let n = 2; used.has(`${candidate}${extension}`.toLowerCase()); n++) {
      candidate = `${name} (${n})`;
    }
    used.add(`${candidate}${extension}`.toLowerCase());
    return `${candidate}${extension}`;
  };
}

/** cafam-2026-11-25.zip */
export function exportFileName(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `cafam-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}.zip`;
}

export function readme(date: Date, withImages: boolean): string {
  return [
    "Tus datos de CaFam",
    `Descargados el ${date.toLocaleDateString("es-ES", { dateStyle: "long" })}.`,
    "",
    "perfil.json        Tu nombre, email, zona horaria y ajustes.",
    "calendarios.json   Los calendarios de los que eres miembro: tu rol, sus categorías y sus miembros (solo por nombre).",
    "calendarios/       Un archivo .ics por calendario con sus eventos. Se abre con Google Calendar, Apple Calendar u Outlook.",
    "comentarios.json   Los comentarios que has escrito, con su evento.",
    "notas.json         Tus notas personales y las compartidas que creaste, con sus elementos.",
    withImages
      ? "imagenes/          Las imágenes que subiste, en una carpeta por evento."
      : "imagenes/          No incluidas: elegiste descargar sin imágenes.",
    "",
    "No contiene emails de otras personas, contraseñas ni claves de las cuentas conectadas.",
    "",
  ].join("\r\n");
}
