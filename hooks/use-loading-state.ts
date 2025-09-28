"use client";

import { useState, useEffect } from "react";

export function useLoadingState() {
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Listen for loading state changes from the layout
    const handleLoadingChange = (event: CustomEvent) => {
      setIsLoading(event.detail.isLoading);
    };

    window.addEventListener(
      "loadingStateChange",
      handleLoadingChange as EventListener
    );

    return () => {
      window.removeEventListener(
        "loadingStateChange",
        handleLoadingChange as EventListener
      );
    };
  }, []);

  return isLoading;
}
