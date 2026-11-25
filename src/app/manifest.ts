import type { MetadataRoute } from "next";
import { NEUTRALS } from "@/lib/theme/accents";

/** Installable PWA manifest (RF-21, RNF-9), with the mist and the icons of the Orilla identity (spec 025 RF-7). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "CaFam",
    short_name: "CaFam",
    description: "Calendario compartido para familia y amigos.",
    lang: "es",
    start_url: "/dashboard/calendar",
    scope: "/",
    display: "standalone",
    theme_color: NEUTRALS.stone,
    background_color: NEUTRALS.stone,
    // Android hands what is shared to sw.js, never to the server (spec 047
    // RF-5, RF-10); iOS does not support it.
    share_target: {
      action: "/share-target",
      method: "POST",
      enctype: "multipart/form-data",
      params: {
        title: "title",
        text: "text",
        url: "url",
        files: [
          { name: "files", accept: ["text/calendar", ".ics", "image/*"] },
        ],
      },
    },
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
