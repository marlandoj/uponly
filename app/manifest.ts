import type { MetadataRoute } from "next";

// Manifest + icons + theme only. Deliberately no service worker / offline mode.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "UpOnly — positive-only chore game",
    short_name: "UpOnly",
    description: "Turn a real chore into a quest. Ratings only ever go up.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f0fdf4",
    theme_color: "#16a34a",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
