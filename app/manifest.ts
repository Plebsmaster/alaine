import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "PA Studie",
    short_name: "PA Studie",
    description: "Dagelijks herhalen voor de master Physician Assistant",
    lang: "nl",
    start_url: "/vandaag",
    scope: "/",
    display: "standalone",
    background_color: "#f7f7f5",
    theme_color: "#2f6f62",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
