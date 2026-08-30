// sw.js — cache hors ligne.
//
// IMPORTANT : incrementer CACHE a chaque modification de fichier statique,
// sinon les appareils deja installes continueront de servir l'ancienne version.

const CACHE = "semaine-v5";

const ASSETS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./css/styles.css",
  "./js/app.js",
  "./js/actions.js",
  "./js/render.js",
  "./js/views.js",
  "./js/sheets.js",
  "./js/shopping.js",
  "./js/store.js",
  "./js/model.js",
  "./js/uistate.js",
  "./icons/icon-180.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-512-maskable.png"
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Cache d'abord, reseau ensuite en arriere-plan : l'application s'ouvre
// instantanement et se met a jour au chargement suivant.
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;

  e.respondWith(
    caches.match(req).then(cached => {
      const network = fetch(req)
        .then(res => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE).then(c => c.put(req, copy));
          }
          return res;
        })
        .catch(() => cached || caches.match("./index.html"));

      return cached || network;
    })
  );
});
