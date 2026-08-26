export type CurrentMarketPrices = {
  solPrice: number;
  pythPrice: number;
};

const LLAMA_PRICE_IDS = "coingecko:solana,coingecko:pyth-network";

export function getDefiLlamaCurrentPriceUrl(): string {
  return `https://coins.llama.fi/prices/current/${LLAMA_PRICE_IDS}`;
}

export function getDefiLlamaHistoricalPriceUrl(timestamp: number): string {
  return `https://coins.llama.fi/prices/historical/${timestamp}/${LLAMA_PRICE_IDS}`;
}

export function parseDefiLlamaCurrentPrices(data: unknown): CurrentMarketPrices {
  const coins = (data as {
    coins?: Record<string, { price?: unknown }>;
  })?.coins;
  const solPrice = Number(coins?.["coingecko:solana"]?.price);
  const pythPrice = Number(coins?.["coingecko:pyth-network"]?.price);

  if (!Number.isFinite(solPrice) || !Number.isFinite(pythPrice)) {
    throw new Error("Invalid price data format received");
  }

  return {
    solPrice,
    pythPrice,
  };
}

export async function getCurrentMarketPrices(): Promise<CurrentMarketPrices> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(getDefiLlamaCurrentPriceUrl(), {
      method: "GET",
      cache: "no-store",
      headers: {
        Accept: "application/json",
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return parseDefiLlamaCurrentPrices(await response.json());
  } catch {
    clearTimeout(timeoutId);
    return {
      solPrice: 0,
      pythPrice: 0,
    };
  }
}
