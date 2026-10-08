import type { MetadataRoute } from "next";

// Manifest + icons + theme only. Deliberately no service worker / offline mode.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ChoreQuest — real chores, epic loot",
    short_name: "ChoreQuest",
    description: "Real chores. Epic loot. Turn a chore into a quest — your level only ever goes up.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0b0f0c",
    theme_color: "#0b0f0c",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
