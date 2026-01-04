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
 * Fetches 24h price change from CoinGecko API
 * This is a fallback method to get historical price data
 */
async function get24hChangeFromCoinGecko(
  coinId: string
): Promise<{ change24h: number; change24hValue: number }> {
  try {
    const response = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd&include_24hr_change=true`,
      {
        headers: {
          Accept: "application/json",
        },
        next: { revalidate: 60 }, // Cache for 60 seconds
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    const coinData = data[coinId];

    if (coinData && coinData.usd && coinData.usd_24h_change !== undefined) {
      const change24h = coinData.usd_24h_change;
      const price = coinData.usd;
      const change24hValue = (price * change24h) / 100;

      return { change24h, change24hValue };
    }

    return { change24h: 0, change24hValue: 0 };
  } catch (error) {
    console.error(`Error fetching 24h change for ${coinId}:`, error);
    return { change24h: 0, change24hValue: 0 };
  }
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

  // Fetch current prices from Hermes API
  const [solPrice, pythPrice, solChange, pythChange] = await Promise.all([
    getPriceFromHermes(SOL_PRICE_ID),
    getPriceFromHermes(PYTH_PRICE_ID),
    get24hChangeFromCoinGecko("solana"),
    get24hChangeFromCoinGecko("pyth-network"),
  ]);

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

