/* nestegg — service worker. Offline app shell only.
   /api/* is never cached: the vault must always be live (sync correctness),
   and fx/price already have client-side fallbacks when the network is gone. */
const CACHE = "nestegg-v1.2.19";
const SHELL = [
  "/dashboard.html",
  "/css/base.css", "/css/app.css",
  // ES-module graph: main.js imports domain/ + io/ + ui/. All must be cached for offline.
  "/js/main.js",
  "/js/domain/ids.js", "/js/domain/dates.js", "/js/domain/constants.js", "/js/domain/store.js",
  "/js/domain/money.js", "/js/domain/schema.js", "/js/domain/loan.js", "/js/domain/asset-value.js",
  "/js/domain/model.js", "/js/domain/forecast.js", "/js/domain/retirement.js", "/js/domain/merge.js",
  "/js/io/crypto.js", "/js/io/storage.js",
  "/js/ui/dom.js", "/js/ui/chart-kit.js", "/js/ui/charts.js", "/js/ui/networth.js",
  "/js/ui/assets.js", "/js/ui/salary.js", "/js/ui/gate.js",
  "/assets/favicon.svg", "/assets/favicon-32.png",
  "/assets/icon-192.png", "/assets/icon-512.png", "/assets/apple-touch-icon.png",
  "/site.webmanifest",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  // Navigations: network first so deploys land on next load; cached shell offline.
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then((hit) => hit || caches.match("/dashboard.html")))
    );
    return;
  }

  // Static assets: stale-while-revalidate. One load may pair fresh HTML with a
  // just-stale script; acceptable here, everything refreshes by the next load.
  e.respondWith(
    caches.match(req).then((hit) => {
      const refresh = fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => hit);
      return hit || refresh;
    })
  );
});