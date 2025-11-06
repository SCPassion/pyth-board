const CACHE_NAME = "pyth-dashboard-v6";
const STATIC_CACHE_NAME = "pyth-dashboard-static-v6";
const urlsToCache = [
  "/",
  "/wallets",
  "/manifest.json",
  "/pyth.png",
  "/pyth-96.png",
  "/pyth-192.png",
  "/pyth-512.png",
  "/favicon.ico",
];
// Note: /pythenians is excluded from cache due to no-cache headers

// Install event - cache resources
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME).then((cache) => {
      console.log("Opened static cache");
      return cache.addAll(urlsToCache);
    })
  );
  // Force the waiting service worker to become the active service worker
  self.skipWaiting();
});

// Fetch event - handle Next.js chunks properly
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Don't cache POST, PUT, DELETE, or PATCH requests
  if (request.method !== "GET") {
    event.respondWith(fetch(request));
    return;
  }

  // Don't cache server actions or API routes
  if (
    url.pathname.startsWith("/_next/") ||
    url.pathname.startsWith("/api/") ||
    url.pathname.includes("server-action") ||
    url.searchParams.has("_rsc")
  ) {
    event.respondWith(fetch(request));
    return;
  }

  // Handle Next.js static chunks - network first, no caching for chunks
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Don't cache Next.js chunks as they have unique hashes
          return response;
        })
        .catch(() => {
          // If network fails, don't fallback to cache for chunks
          // This prevents serving stale chunks
          return new Response("Chunk not found", { status: 404 });
        })
    );
    return;
  }

  // Handle /pythenians with network-first strategy (no cache)
  if (request.url.includes("/pythenians")) {
    event.respondWith(
      fetch(request).catch(() => {
        return new Response("Network error", { status: 503 });
      })
    );
    return;
  }

  // Handle other GET requests with cache-first strategy
  event.respondWith(
    caches.match(request).then((response) => {
      if (response) {
        return response;
      }
      return fetch(request).then((fetchResponse) => {
        // Only cache successful GET responses
        if (fetchResponse.ok && request.method === "GET") {
          const responseClone = fetchResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone).catch((error) => {
              // Silently fail if caching fails (e.g., quota exceeded)
              console.warn("Failed to cache response:", error);
            });
          });
        }
        return fetchResponse;
      });
    })
  );
});

// Activate event - clean up old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME && cacheName !== STATIC_CACHE_NAME) {
              console.log("Deleting old cache:", cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        // Take control of all clients immediately
        return self.clients.claim();
      })
  );
});

// Handle messages from the main thread
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }

  if (event.data && event.data.type === "CLEAR_CACHE") {
    // Clear all caches when chunk loading errors occur
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            console.log("Clearing cache due to chunk error:", cacheName);
            return caches.delete(cacheName);
          })
        );
      })
      .then(() => {
        // Notify all clients to reload
        self.clients.matchAll().then((clients) => {
          clients.forEach((client) => {
            client.postMessage({ type: "CACHE_CLEARED" });
          });
        });
      });
  }
});
