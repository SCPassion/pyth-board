"use client";

import { useEffect, useState } from "react";

const LLAMA_CHART_URL = "https://coins.llama.fi/chart/coingecko:pyth-network";
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

type FetchPythPriceHistoryOptions = {
  fromTimestamp: number;
  toTimestamp: number;
  signal: AbortSignal;
  fetcher?: typeof fetch;
};

export async function fetchPythPriceHistory({
  fromTimestamp,
  toTimestamp,
  signal,
  fetcher = fetch,
}: FetchPythPriceHistoryOptions): Promise<PythPriceHistoryPoint[]> {
  const params = new URLSearchParams({
    start: String(fromTimestamp),
    period: "1h",
    span: "24",
  });

  try {
    const response = await fetcher(
      `${LLAMA_CHART_URL}?${params.toString()}`,
      {
      method: "GET",
        cache: "no-store",
      headers: {
        Accept: "application/json",
      },
      signal,
      }
    );

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    const prices = Array.isArray(data?.coins?.["coingecko:pyth-network"]?.prices)
      ? data.coins["coingecko:pyth-network"].prices
      : [];

    return (prices as unknown[])
      .map((entry: unknown) => {
        if (!entry || typeof entry !== "object") return null;
        const timestamp = Number((entry as { timestamp?: unknown }).timestamp);
        const price = Number((entry as { price?: unknown }).price);

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
      )
      .sort((a, b) => a.timestamp - b.timestamp);
  } catch {
    return [];
  }
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

        const points = await fetchPythPriceHistory({
          fromTimestamp: startTimestamp,
          toTimestamp: endTimestamp,
          signal: controller.signal,
        }).catch((error) => {
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
