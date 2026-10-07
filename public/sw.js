/*
 * Spend service worker — a deliberately small PWA foundation.
 *  - Navigations: network-first, falling back to the last cached copy, then /offline.
 *  - Hashed build assets (/_next/static) and icons: cache-first (they're immutable).
 *  - Everything else (Firebase, APIs) is left alone; Firestore has its own offline cache.
 */
const VERSION = "v3";
const PAGE_CACHE = `ledger-pages-${VERSION}`;
const ASSET_CACHE = `ledger-assets-${VERSION}`;
const OFFLINE_URL = "/offline";
const QUICK_ADD_PATH = "/quick-add";
const QUICK_TIMEOUT_MS = 800;
// The app's screens are static shells that load data client-side (Firestore's offline cache
// supplies it), so pre-caching them lets an installed app open fully offline.
const PRECACHE = [
  OFFLINE_URL,
  "/dashboard",
  "/quick-add",
  "/expenses",
  "/plan",
  "/settings",
  "/analytics",
  "/login",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(PAGE_CACHE)
      // Individually, so one failed route doesn't abort installation.
      .then((cache) => Promise.all(PRECACHE.map((url) => cache.add(url).catch(() => undefined))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("ledger-") && ![PAGE_CACHE, ASSET_CACHE].includes(key))
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Quick Add is launched from Shortcuts / Back Tap where every ~100 ms counts: answer from
  // the cached shell if the network hasn't replied within QUICK_TIMEOUT_MS (the response
  // still refreshes the cache). Deep-link query strings share the one cached shell.
  if (request.mode === "navigate" && url.pathname === QUICK_ADD_PATH) {
    const network = fetch(request).then((response) => {
      if (response.ok) {
        const copy = response.clone();
        event.waitUntil(caches.open(PAGE_CACHE).then((cache) => cache.put(QUICK_ADD_PATH, copy)));
      }
      return response;
    });
    event.respondWith(
      caches.match(QUICK_ADD_PATH).then((cached) => {
        if (!cached) return network.catch(async () => (await caches.match(OFFLINE_URL)) ?? Response.error());
        const fallback = new Promise((resolve) => setTimeout(() => resolve(cached), QUICK_TIMEOUT_MS));
        return Promise.race([network.catch(() => cached), fallback]);
      }),
    );
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(PAGE_CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(async () => (await caches.match(request)) ?? (await caches.match(OFFLINE_URL))),
    );
    return;
  }

  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ??
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(ASSET_CACHE).then((cache) => cache.put(request, copy));
            }
            return response;
          }),
      ),
    );
  }
});

// Reminder notifications: open (or focus) the relevant screen when tapped.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "/dashboard", self.location.origin);
  // Only ever navigate within the app.
  const url = target.origin === self.location.origin ? target.href : new URL("/dashboard", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((c) => c.url.startsWith(self.location.origin));
      if (existing) {
        existing.navigate(url);
        return existing.focus();
      }
      return self.clients.openWindow(url);
    }),
  );
});
