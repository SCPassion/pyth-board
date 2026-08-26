"use server";

import {
  parsePythPriceHistory,
  type PythPriceHistoryPoint,
} from "@/lib/pyth-price-history";

const LLAMA_CHART_URL = "https://coins.llama.fi/chart/coingecko:pyth-network";
const HISTORY_HOURS = 24;
const HISTORY_SAFETY_DELAY_SECONDS = 90;

type GetPythPriceHistoryOptions = {
  nowSeconds?: number;
  fetcher?: typeof fetch;
};

export async function getPythPriceHistory({
  nowSeconds = Math.floor(Date.now() / 1000),
  fetcher = fetch,
}: GetPythPriceHistoryOptions = {}): Promise<PythPriceHistoryPoint[]> {
  const endTimestamp = nowSeconds - HISTORY_SAFETY_DELAY_SECONDS;
  const startTimestamp = endTimestamp - HISTORY_HOURS * 60 * 60;
  const params = new URLSearchParams({
    start: String(startTimestamp),
    period: "1h",
    span: "24",
  });

  try {
    const response = await fetcher(`${LLAMA_CHART_URL}?${params.toString()}`, {
      method: "GET",
      cache: "no-store",
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      return [];
    }

    return parsePythPriceHistory(await response.json());
  } catch {
    return [];
  }
}
