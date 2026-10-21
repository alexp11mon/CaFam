import type { MetadataRoute } from "next";

/** Installable PWA manifest (RF-21, RNF-9). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "CalenderFam",
    short_name: "CaFam",
    description: "Calendario compartido para familia y amigos.",
    lang: "es",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    theme_color: "#2563EB",
    background_color: "#FFFFFF",
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
