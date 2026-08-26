"use client";

import { useState, useEffect } from "react";

const PYTH_COINGECKO_PRICE_URL =
  "https://api.coingecko.com/api/v3/simple/price?ids=pyth-network&vs_currencies=usd";

type FetchPythPriceOptions = {
  fetcher?: typeof fetch;
  timeoutMs?: number;
};

export async function fetchPythPrice({
  fetcher = fetch,
  timeoutMs = 10000,
}: FetchPythPriceOptions = {}): Promise<number | null> {

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetcher(PYTH_COINGECKO_PRICE_URL, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    const price = Number(data?.["pyth-network"]?.usd);

    if (!Number.isFinite(price)) {
      throw new Error("Invalid price data format received");
    }

    return price;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error) {
      if (error.name === "AbortError") {
        return null;
      }
      return null;
    }
    return null;
  }
}

export function usePythPrice() {
  const [pythPrice, setPythPrice] = useState<number | null>(null);

  useEffect(() => {
    async function fetchPrice() {
      const price = await fetchPythPrice();
      if (price !== null) {
        setPythPrice(price);
      }
    }

    fetchPrice();
  }, []);

  return pythPrice;
}
