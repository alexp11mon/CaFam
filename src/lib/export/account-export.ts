import { readme, safeName, uniqueNames } from "./account-files";
import type { ZipEntry } from "./zip-store";

// Spec 049, T5: the files of "Descargar mis datos" (RF-13, RF-15). Pure.

export interface AccountExport {
  profile: Record<string, unknown> & { name: string; email: string };
  calendars: {
    id: string;
    name: string;
    description: string | null;
    color: string;
    role: string;
    categories: string[];
    members: { name: string; role: string }[];
  }[];
  comments: unknown[];
  notes: unknown[];
  images: { objectId: string; eventId: string; eventTitle: string }[];
}

/** RF-15: past these, the user decides whether to include the images. */
export const IMAGE_LIMITS = { count: 300, bytes: 500 * 1024 * 1024 } as const;

/** Each full image weighs at most this much (2048 px JPEG, spec 012). */
const IMAGE_ESTIMATE = 1.8 * 1024 * 1024;

export function asksAboutImages(data: AccountExport): boolean {
  return (
    data.images.length > IMAGE_LIMITS.count ||
    data.images.length * IMAGE_ESTIMATE > IMAGE_LIMITS.bytes
  );
}

const json = (value: unknown) =>
  new TextEncoder().encode(`${JSON.stringify(value, null, 2)}\n`);

/** Folder and file of each image: imagenes/<evento>/<n>.jpg (RF-13). */
export function imagePaths(images: AccountExport["images"]): string[] {
  const folder = uniqueNames();
  const folders = new Map<string, string>();
  const counts = new Map<string, number>();
  return images.map((image) => {
    let name = folders.get(image.eventId);
    if (!name) {
      name = folder(safeName(image.eventTitle, "evento"));
      folders.set(image.eventId, name);
    }
    const n = (counts.get(image.eventId) ?? 0) + 1;
    counts.set(image.eventId, n);
    return `imagenes/${name}/${n}.jpg`;
  });
}

export function exportEntries(
  data: AccountExport,
  ics: Map<string, string>,
  images: { path: string; data: Uint8Array }[],
  withImages: boolean,
  now: Date,
): ZipEntry[] {
  const file = uniqueNames();
  const encoder = new TextEncoder();
  return [
    { name: "LEEME.txt", data: encoder.encode(readme(now, withImages)) },
    { name: "perfil.json", data: json(data.profile) },
    {
      name: "calendarios.json",
      data: json(
        data.calendars.map(
          ({ name, description, color, role, categories, members }) => ({
            name,
            description,
            color,
            role,
            categories,
            members,
          }),
        ),
      ),
    },
    ...data.calendars.flatMap((calendar) => {
      const text = ics.get(calendar.id);
      return text === undefined
        ? []
        : [
            {
              name: `calendarios/${file(safeName(calendar.name, "calendario"), ".ics")}`,
              data: encoder.encode(text),
            },
          ];
    }),
    { name: "comentarios.json", data: json(data.comments) },
    { name: "notas.json", data: json(data.notes) },
    ...images.map((image) => ({ name: image.path, data: image.data })),
  ];
}
