/* Source du service worker, servie par app/sw.js/route.ts avec des en-têtes sans cache. */
export const SW_SOURCE = String.raw`/* Every1.ate OS — service worker (V1, cache limité).
 * - Met en cache uniquement les ressources statiques publiques (JS/CSS/polices/icônes).
 * - Ne met JAMAIS en cache les pages ni les réponses de l'API : aucune donnée privée
 *   ou financière n'est stockée sur l'appareil.
 * - Hors ligne, une navigation affiche la page « hors-ligne.html ».
 * - Message { type: "purge" } : vide tous les caches (déconnexion, changement d'utilisateur).
 * - Notifications push (V1.2) : affiche { title, body, href, tag } ; un clic ouvre l'app sur href.
 */
const VERSION = "e1-static-v1";
const OFFLINE_URL = "/hors-ligne.html";
const STATIC = /^\/(_next\/static\/|icons\/|brand\/|icon\.png|apple-icon\.png|hors-ligne\.html)/;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      .then((cache) => cache.addAll([OFFLINE_URL, "/icons/icon-192.png"]))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "purge") {
    event.waitUntil(
      caches
        .keys()
        .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
        .then(() => event.source && event.source.postMessage({ type: "purged" })),
    );
  }
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    // Réseau uniquement ; page hors ligne générique en cas d'échec (aucune page privée en cache).
    event.respondWith(fetch(request).catch(() => caches.match(OFFLINE_URL)));
    return;
  }

  if (STATIC.test(url.pathname)) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ||
          fetch(request).then((response) => {
            if (response.ok && response.type === "basic") {
              const copy = response.clone();
              caches.open(VERSION).then((cache) => cache.put(request, copy));
            }
            return response;
          }),
      ),
    );
  }
  // Tout le reste (API, données, flux RSC) : réseau direct, jamais mis en cache.
});

// ── Notifications push ─────────────────────────────────────────────────────────
const APP_ICON = "/icons/icon-192.png";

/** Seuls les chemins internes sont suivis (jamais une adresse externe reçue dans un message). */
function safeHref(value) {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//") ? value : "/";
}

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (error) {
    data = { body: event.data ? event.data.text() : "" };
  }
  const title = typeof data.title === "string" && data.title ? data.title : "Every1.ate OS";
  const options = {
    body: typeof data.body === "string" ? data.body : "",
    icon: APP_ICON,
    data: { href: safeHref(data.href) },
  };
  if (typeof data.tag === "string" && data.tag) options.tag = data.tag;
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const href = safeHref(event.notification.data && event.notification.data.href);
  const target = new URL(href, self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      const open = windows.find((client) => new URL(client.url).origin === self.location.origin);
      if (!open) return self.clients.openWindow(target);
      return open.focus().then((client) => {
        const win = client || open;
        if (win.url === target) return undefined;
        // navigate() échoue sur un onglet non contrôlé : l'app navigue alors elle-même.
        return win.navigate(target).catch(() => win.postMessage({ type: "navigate", href }));
      });
    }),
  );
});
`;
