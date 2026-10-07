import type { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Spend — Expense Tracker",
    short_name: "Spend",
    description: "Track every expense in seconds.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    display_override: ["standalone", "minimal-ui"],
    orientation: "portrait",
    background_color: "#fdfdfe",
    theme_color: "#4338ca",
    categories: ["finance", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    // Long-press shortcuts on Android / desktop Chrome & Edge. iOS ignores this field; there,
    // Quick Add is reached via Shortcuts / Back Tap or "Open the app into Quick Add".
    shortcuts: [
      {
        name: "Quick Add expense",
        short_name: "Quick Add",
        description: "Amount, category, done",
        url: "/quick-add",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
      },
      {
        name: "History",
        url: "/expenses",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
      },
      {
        name: "Analytics",
        url: "/analytics",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
      },
    ],
  };
}
