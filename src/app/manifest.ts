import type { MetadataRoute } from "next";

// PWA baseline (P0). Installable, standalone, dark theme matching the app shell.
// A service worker (offline shell + Web Push) comes in a later phase.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Collect Your Cards",
    short_name: "CYC",
    description:
      "Search, organize, and track your sports card collection — every card, every set, every checklist.",
    start_url: "/",
    display: "standalone",
    background_color: "#0f172a",
    theme_color: "#1e293b",
    icons: [
      {
        src: "/web-app-manifest-192x192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/web-app-manifest-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      { src: "/favicon.svg", sizes: "any", type: "image/svg+xml" },
    ],
  };
}
