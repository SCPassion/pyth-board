"use client";

import { useEffect } from "react";

export function ServiceWorkerScript() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Service Worker Registration
    if ("serviceWorker" in navigator) {
      window.addEventListener("load", function () {
        navigator.serviceWorker
          .register("/sw.js")
          .then(function (registration) {
            console.log("SW registered: ", registration);

            // Handle service worker updates - force immediate update
            registration.addEventListener("updatefound", () => {
              const newWorker = registration.installing;
              if (newWorker) {
                newWorker.addEventListener("statechange", () => {
                  if (newWorker.state === "installed") {
                    // Force immediate reload for cache invalidation
                    window.location.reload();
                  }
                });
              }
            });

            // Force update check on page load
            registration.update();
          })
          .catch(function (registrationError) {
            console.log("SW registration failed: ", registrationError);
          });
      });
    }

    // Handle chunk loading errors with better error handling
    const handleError = (event: ErrorEvent) => {
      if (event.error && event.error.name === "ChunkLoadError") {
        console.log(
          "Chunk load error detected, clearing cache and reloading..."
        );
        // Clear service worker cache
        if (
          "serviceWorker" in navigator &&
          navigator.serviceWorker.controller
        ) {
          navigator.serviceWorker.controller.postMessage({
            type: "CLEAR_CACHE",
          });
        }
        // Force reload with cache bypass
        window.location.reload();
      }
    };

    // Handle unhandled promise rejections (chunk loading failures)
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (event.reason && event.reason.name === "ChunkLoadError") {
        console.log(
          "Chunk load error in promise, clearing cache and reloading..."
        );
        event.preventDefault();
        // Clear service worker cache
        if (
          "serviceWorker" in navigator &&
          navigator.serviceWorker.controller
        ) {
          navigator.serviceWorker.controller.postMessage({
            type: "CLEAR_CACHE",
          });
        }
        // Force reload with cache bypass
        window.location.reload();
      }
    };

    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleUnhandledRejection);

    return () => {
      window.removeEventListener("error", handleError);
      window.removeEventListener(
        "unhandledrejection",
        handleUnhandledRejection
      );
    };
  }, []);

  return null;
}
