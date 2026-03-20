"use server";

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
 * Fetches price from Hermes API
 */
async function getPriceFromHermes(priceId: string): Promise<number> {
  const HERMES_API_URL = `https://hermes.pyth.network/v2/updates/price/latest?ids%5B%5D=${priceId}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(HERMES_API_URL, {
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
    return 0;
  }
}

/**
 * Fetches the price of an asset from Hermes at a specific Unix timestamp.
 * Returns 0 if unavailable.
 */
async function getPriceFromHermesAt(
  priceId: string,
  unixTimestamp: number
): Promise<number> {
  try {
    const response = await fetch(
      `https://hermes.pyth.network/v2/updates/price/${unixTimestamp}?ids%5B%5D=${priceId}`,
      { headers: { Accept: "application/json", "User-Agent": "PythBoard/1.0" } }
    );
    if (!response.ok) return 0;
    const data = await response.json();
    if (!data.parsed?.[0]?.price) return 0;
    return Number(data.parsed[0].price.price) * 1e-8;
  } catch {
    return 0;
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
  const SOL_PRICE_ID = "ef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d";
  const PYTH_PRICE_ID = "0bbf28e9a841a1cc788f6a361b17ca072d0ea3098a1e5df1c3922d06719579ff";

  const timestamp24hAgo = Math.floor(Date.now() / 1000) - 86400;

  const [solPrice, pythPrice, sol24hAgo, pyth24hAgo] = await Promise.all([
    getPriceFromHermes(SOL_PRICE_ID),
    getPriceFromHermes(PYTH_PRICE_ID),
    getPriceFromHermesAt(SOL_PRICE_ID, timestamp24hAgo),
    getPriceFromHermesAt(PYTH_PRICE_ID, timestamp24hAgo),
  ]);

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

