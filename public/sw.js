const CACHE_NAME = "my-lectures-pwa-v1";
const ASSETS = [
  "/",
  "/offline.html",
  "/manifest.json",
  "/icons/icon-192.svg",
  "/icons/icon-512.svg",
  "/bdds.jpg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.map((key) => {
            if (key !== CACHE_NAME) return caches.delete(key);
          }),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const requestUrl = new URL(event.request.url);
  const isSameOrigin = requestUrl.origin === self.location.origin;

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
          return caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, res.clone());
            return res;
          });
        })
        .catch(() => caches.match("/offline.html"));
    }),
  );
});
