"use client";

import { useEffect, useState } from "react";

import { getPythPriceHistory } from "@/action/priceHistoryActions";
import type { PythPriceHistoryPoint } from "@/lib/pyth-price-history";

export type { PythPriceHistoryPoint } from "@/lib/pyth-price-history";

export function usePythPriceHistory() {
  const [history, setHistory] = useState<PythPriceHistoryPoint[]>([]);
  const [isRateLimited, setIsRateLimited] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function fetchHistory() {
      try {
        setIsRateLimited(false);
        const points = await getPythPriceHistory();

        if (isMounted) {
          setHistory(points);
        }
      } catch (error) {
        if (isMounted) {
          setHistory([]);
          setIsRateLimited(
            error instanceof Error && error.message.includes("HTTP 429")
          );
        }
      }
    }

    fetchHistory();

    return () => {
      isMounted = false;
    };
  }, []);

  return { history, isRateLimited };
}
