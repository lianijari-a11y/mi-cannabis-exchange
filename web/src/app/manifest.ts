import type { MetadataRoute } from "next";

// Next.js auto-detects this file and serves it at /manifest.webmanifest,
// linking it into every page's <head> automatically — no manual <link
// rel="manifest"> tag needed. This makes the app installable ("Add to Home
// Screen" on iOS/Android, "Install app" in Chrome/Edge on desktop) — see
// CLAUDE.md's PWA section for what this does and doesn't cover (no offline
// support / service worker was added, on purpose, given how much of this
// app's data — deal state, negotiation rounds, notifications — needs to
// stay live rather than served from a stale cache).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MI Cannabis Exchange — Wholesale Marketplace",
    short_name: "MI Cannabis Exchange",
    description:
      "A blind wholesale marketplace connecting Michigan-licensed Growers, Processors, and Retailers, brokered by a neutral intermediary.",
    start_url: "/",
    display: "standalone",
    background_color: "#f9fafb",
    theme_color: "#15803d",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
