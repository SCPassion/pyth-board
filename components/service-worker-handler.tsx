"use client";

import { useEffect } from "react";

export function ServiceWorkerHandler() {
  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      // Check for service worker updates
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        // Service worker has changed, reload the page
        window.location.reload();
      });

      // Handle service worker messages
      navigator.serviceWorker.addEventListener("message", (event) => {
        if (event.data && event.data.type === "CACHE_UPDATED") {
          // Cache has been updated, reload the page
          window.location.reload();
        }
        if (event.data && event.data.type === "CACHE_CLEARED") {
          // Cache has been cleared, reload the page
          window.location.reload();
        }
      });

      // Check if there's a waiting service worker
      navigator.serviceWorker.ready.then((registration) => {
        if (registration.waiting) {
          // There's a waiting service worker, skip waiting
          registration.waiting.postMessage({ type: "SKIP_WAITING" });
        }
      });
    }
  }, []);

  return null;
}
