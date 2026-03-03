"use client";

import { useEffect, useState } from "react";

const BENCHMARKS_BASE_URL = "https://benchmarks.pyth.network";
const PYTH_SYMBOL = "Crypto.PYTH/USD";
const HISTORY_HOURS = 24;
const HISTORY_SAFETY_DELAY_SECONDS = 90;

export type PythPriceHistoryPoint = {
  label: string;
  price: number;
  timestamp: number;
  tooltipLabel: string;
};

function formatTimeLabel(timestamp: number) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestamp * 1000));
}

function formatTooltipLabel(timestamp: number) {
  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestamp * 1000));
}

async function fetchPythPriceHistory(
  fromTimestamp: number,
  toTimestamp: number,
  signal: AbortSignal
): Promise<PythPriceHistoryPoint[]> {
  const params = new URLSearchParams();
  params.append("symbol", PYTH_SYMBOL);
  params.append("resolution", "60");
  params.append("from", String(fromTimestamp));
  params.append("to", String(toTimestamp));

  const response = await fetch(
    `${BENCHMARKS_BASE_URL}/v1/shims/tradingview/history?${params.toString()}`,
    {
      method: "GET",
      headers: {
        Accept: "application/json",
        "User-Agent": "PythBoard/1.0",
      },
      signal,
    }
  );

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const data = await response.json();
  const timestamps = Array.isArray(data.t) ? data.t : [];
  const closePrices = Array.isArray(data.c) ? data.c : [];

  if (data.s !== "ok" || timestamps.length === 0 || closePrices.length === 0) {
    return [];
  }

  return timestamps
    .map((timestamp: number, index: number) => {
      const price = Number(closePrices[index]);

      if (!Number.isFinite(timestamp) || !Number.isFinite(price)) {
        return null;
      }

      return {
        label: formatTimeLabel(timestamp),
        price,
        timestamp,
        tooltipLabel: formatTooltipLabel(timestamp),
      };
    })
    .filter(
      (point: PythPriceHistoryPoint | null): point is PythPriceHistoryPoint =>
        point !== null && Number.isFinite(point.price)
    );
}

export function usePythPriceHistory() {
  const [history, setHistory] = useState<PythPriceHistoryPoint[]>([]);
  const [isRateLimited, setIsRateLimited] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    async function fetchHistory() {
      const endTimestamp =
        Math.floor(Date.now() / 1000) - HISTORY_SAFETY_DELAY_SECONDS;
      const startTimestamp = endTimestamp - HISTORY_HOURS * 60 * 60;
      let sawRateLimit = false;

      try {
        setIsRateLimited(false);

        const points = await fetchPythPriceHistory(
          startTimestamp,
          endTimestamp,
          controller.signal
        ).catch((error) => {
          if (error instanceof Error && error.message.includes("HTTP 429")) {
            sawRateLimit = true;
          }

          return [];
        });

        const validPoints = points.sort((a, b) => a.timestamp - b.timestamp);

        setHistory(validPoints);
        setIsRateLimited(sawRateLimit);
      } catch (error) {
        if (!(error instanceof Error) || error.name !== "AbortError") {
          console.error("Failed to fetch Pyth 24h price history", error);
        }
      } finally {
        clearTimeout(timeoutId);
      }
    }

    fetchHistory();

    return () => {
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, []);

  return { history, isRateLimited };
}
