"use client";

import { useEffect, useState } from "react";

const PYTH_PRICE_ID =
  "0bbf28e9a841a1cc788f6a361b17ca072d0ea3098a1e5df1c3922d06719579ff";
const HERMES_BASE_URL = "https://hermes.pyth.network";
const HISTORY_HOURS = 24;
const SAMPLE_INTERVAL_SECONDS = 60 * 60;

export type PythPriceHistoryPoint = {
  label: string;
  price: number;
  timestamp: number;
  tooltipLabel: string;
};

function formatPrice(rawPrice: string | number, expo: number) {
  return Number(rawPrice) * 10 ** expo;
}

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

async function fetchPythPriceAtTimestamp(
  timestamp: number,
  signal: AbortSignal
): Promise<PythPriceHistoryPoint | null> {
  const params = new URLSearchParams();
  params.append("ids[]", PYTH_PRICE_ID);
  params.append("parsed", "true");

  const response = await fetch(
    `${HERMES_BASE_URL}/v2/updates/price/${timestamp}?${params.toString()}`,
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
  const parsedPrice = data.parsed?.[0]?.price;

  if (!parsedPrice) {
    throw new Error("Invalid historical price payload");
  }

  const publishTime = Number(parsedPrice.publish_time ?? timestamp);

  return {
    label: formatTimeLabel(publishTime),
    price: formatPrice(parsedPrice.price, Number(parsedPrice.expo ?? -8)),
    timestamp: publishTime,
    tooltipLabel: formatTooltipLabel(publishTime),
  };
}

export function usePythPriceHistory() {
  const [history, setHistory] = useState<PythPriceHistoryPoint[]>([]);

  useEffect(() => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    async function fetchHistory() {
      const now = Math.floor(Date.now() / 1000);
      const timestamps = Array.from(
        { length: HISTORY_HOURS + 1 },
        (_, index) => now - (HISTORY_HOURS - index) * SAMPLE_INTERVAL_SECONDS
      );

      try {
        const points = await Promise.all(
          timestamps.map((timestamp) =>
            fetchPythPriceAtTimestamp(timestamp, controller.signal).catch(
              () => null
            )
          )
        );

        const validPoints = points
          .filter(
            (point): point is PythPriceHistoryPoint =>
              point !== null && Number.isFinite(point.price)
          )
          .sort((a, b) => a.timestamp - b.timestamp);

        setHistory(validPoints);
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

  return history;
}
