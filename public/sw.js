const CACHE_VERSION = "1";
const CACHE_NAME = `my-lectures-pwa-v${CACHE_VERSION}-${new Date().toISOString().split("T")[0]}`;
const STATIC_CACHE = `my-lectures-static-v${CACHE_VERSION}`;

const ASSETS = [
  "/",
  "/offline.html",
  "/manifest.json",
  "/icons/icon-192.svg",
  "/icons/icon-512.svg",
  "/bdds.jpg",
];

self.addEventListener("install", (event) => {
  console.log("[SW] Installing service worker with cache:", CACHE_NAME);
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => {
        console.log("[SW] Caching offline assets");
        return cache.addAll(ASSETS);
      })
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  console.log("[SW] Activating service worker");
  event.waitUntil(
    caches
      .keys()
      .then((keys) => {
        return Promise.all(
          keys.map((key) => {
            // Delete caches that don't match current version
            if (!key.includes(`v${CACHE_VERSION}`)) {
              console.log("[SW] Deleting old cache:", key);
              return caches.delete(key);
            }
          }),
        );
      })
      .then(() => {
        console.log("[SW] Claiming clients");
        return self.clients.claim();
      }),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const requestUrl = new URL(event.request.url);
  const isSameOrigin = requestUrl.origin === self.location.origin;

  // Never intercept cross-origin requests (e.g. Railway backend API).
  // Let the browser handle them directly so CORS errors propagate correctly
  // instead of being swallowed and replaced with the offline HTML page.
  if (!isSameOrigin) return;

  // Next.js static assets with hash - should almost never change
  if (requestUrl.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request)
          .then((res) => {
            // Clone and cache immutable assets
            if (res.status === 200) {
              const cloned = res.clone();
              caches.open(STATIC_CACHE).then((cache) => {
                cache.put(event.request, cloned);
              });
            }
            return res;
          })
          .catch(() => caches.match("/offline.html"));
      }),
    );
    return;
  }

  // Heuristic for API/JSON requests: same-origin and path includes '/api' or accepts JSON
  const acceptsJson = event.request.headers
    .get("accept")
    ?.includes("application/json");
  const isApiRequest =
    isSameOrigin && (requestUrl.pathname.startsWith("/api") || acceptsJson);

  if (isApiRequest) {
    // Network-first for API requests: try network, update cache, fallback to cache on failure
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          // store a clone in runtime cache
          const cloned = networkResponse.clone();
          caches
            .open(CACHE_NAME)
            .then((cache) => cache.put(event.request, cloned));
          return networkResponse;
        })
        .catch(() =>
          caches.match(event.request).then(
            (cached) =>
              cached ||
              new Response(JSON.stringify({ error: "offline" }), {
                status: 503,
                headers: { "Content-Type": "application/json" },
              }),
          ),
        ),
    );
    return;
  }

  // Default: try cache first, then network, then offline fallback
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((res) => {
          // Only cache successful responses
          if (res.status !== 200) return res;

          return caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, res.clone());
            return res;
          });
        })
        .catch(() => {
          console.log(
            "[SW] Offline - serving offline page for:",
            requestUrl.pathname,
          );
          return caches.match("/offline.html");
        });
    }),
  );
});

// Handle messages from clients
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    console.log("[SW] Client requested skip waiting");
    self.skipWaiting();
  }

  if (event.data && event.data.type === "GET_STATUS") {
    event.ports[0].postMessage({
      type: "SW_STATUS",
      version: CACHE_VERSION,
      caches: { static: STATIC_CACHE, runtime: CACHE_NAME },
    });
  }
});
