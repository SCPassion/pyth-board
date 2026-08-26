"use server";

import {
  getCurrentMarketPrices,
  getDefiLlamaHistoricalPriceUrl,
  parseDefiLlamaCurrentPrices,
} from "@/lib/market-prices";

/**
 * Price data with 24h change information
 */
export type PriceData = {
  symbol: string;
  price: number;
  change24h: number; // Percentage change
  change24hValue: number; // Absolute change in USD
};

/**
 * Fetches SOL and PYTH prices from DefiLlama's no-key coin price API.
 */
async function getPricesFromDefiLlama(): Promise<{
  solPrice: number;
  sol24hAgo: number;
  pythPrice: number;
  pyth24hAgo: number;
}> {
  const historicalTimestamp = Math.floor(Date.now() / 1000) - 86400;
  const historicalUrl = getDefiLlamaHistoricalPriceUrl(historicalTimestamp);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const [currentPrices, historicalResponse] = await Promise.all([
      getCurrentMarketPrices(),
      fetch(historicalUrl, {
        method: "GET",
        cache: "no-store",
        headers: {
          Accept: "application/json",
        },
        signal: controller.signal,
      }),
    ]);

    clearTimeout(timeoutId);

    const historicalData = historicalResponse.ok
      ? await historicalResponse.json()
      : null;
    const historicalPrices = historicalData
      ? parseDefiLlamaCurrentPrices(historicalData)
      : { solPrice: 0, pythPrice: 0 };
    const { solPrice, pythPrice } = currentPrices;
    const sol24hAgo = historicalPrices.solPrice;
    const pyth24hAgo = historicalPrices.pythPrice;

    if (!Number.isFinite(solPrice) || !Number.isFinite(pythPrice)) {
      throw new Error("Invalid price data format received");
    }

    return {
      solPrice,
      sol24hAgo: Number.isFinite(sol24hAgo) ? sol24hAgo : 0,
      pythPrice,
      pyth24hAgo: Number.isFinite(pyth24hAgo) ? pyth24hAgo : 0,
    };
  } catch (error) {
    clearTimeout(timeoutId);
    return {
      solPrice: 0,
      sol24hAgo: 0,
      pythPrice: 0,
      pyth24hAgo: 0,
    };
  }
}

/**
 * Computes 24h change from current and past prices.
 */
function compute24hChange(
  currentPrice: number,
  pastPrice: number
): { change24h: number; change24hValue: number } {
  if (!pastPrice) return { change24h: 0, change24hValue: 0 };
  const change24h = ((currentPrice - pastPrice) / pastPrice) * 100;
  const change24hValue = currentPrice - pastPrice;
  return { change24h, change24hValue };
}

/**
 * Gets real-time price data for SOL and PYTH with 24h change
 */
export async function getRealtimePrices(): Promise<{
  sol: PriceData;
  pyth: PriceData;
}> {
  const { solPrice, sol24hAgo, pythPrice, pyth24hAgo } =
    await getPricesFromDefiLlama();
  const solChange = compute24hChange(solPrice, sol24hAgo);
  const pythChange = compute24hChange(pythPrice, pyth24hAgo);

  return {
    sol: {
      symbol: "SOL",
      price: solPrice,
      change24h: solChange.change24h,
      change24hValue: solChange.change24hValue,
    },
    pyth: {
      symbol: "PYTH",
      price: pythPrice,
      change24h: pythChange.change24h,
      change24hValue: pythChange.change24hValue,
    },
  };
}
