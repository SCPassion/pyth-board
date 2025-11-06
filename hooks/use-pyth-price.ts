"use client";

import { useState, useEffect } from "react";

async function fetchPythPrice(): Promise<number | null> {
  const PYTH_PRICE_ID =
    "0bbf28e9a841a1cc788f6a361b17ca072d0ea3098a1e5df1c3922d06719579ff";
  const PYTH_API_URL = `https://hermes.pyth.network/v2/updates/price/latest?ids%5B%5D=${PYTH_PRICE_ID}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(PYTH_API_URL, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "User-Agent": "PythBoard/1.0",
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    if (!data.parsed || !data.parsed[0] || !data.parsed[0].price) {
      throw new Error("Invalid price data format received");
    }

    return Number(data.parsed[0].price.price) * 1e-8;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error) {
      if (error.name === "AbortError") {
        console.error(
          "Request timeout: Failed to fetch Pyth price within 10 seconds"
        );
        return null;
      }
      console.error(`Failed to fetch Pyth price: ${error.message}`);
      return null;
    }
    console.error("Failed to fetch Pyth price: Unknown error");
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
