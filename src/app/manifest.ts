import type { MetadataRoute } from "next";
import { NEUTRALS } from "@/lib/theme/accents";

/** Installable PWA manifest (RF-21, RNF-9); stone and the new icons from spec 005 (RF-52, RF-53). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "CalenderFam",
    short_name: "CaFam",
    description: "Calendario compartido para familia y amigos.",
    lang: "es",
    start_url: "/dashboard/calendar",
    scope: "/",
    display: "standalone",
    theme_color: NEUTRALS.stone,
    background_color: NEUTRALS.stone,
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
