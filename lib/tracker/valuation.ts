import { record } from "./helius-format";
import { units } from "./analytics";
import type { Trade } from "./types";
/** Missing, stale, or low-confidence prices never remove a valid execution. */
export function applyHistoricalValuation(
  trades: Trade[],
  payload: unknown,
): Trade[] {
  const price = record(record(record(payload).coins)["coingecko:pyth-network"]);
  if (
    typeof price.price !== "number" ||
    !Number.isFinite(price.price) ||
    price.price <= 0 ||
    typeof price.timestamp !== "number" ||
    !Number.isFinite(price.timestamp) ||
    typeof price.confidence !== "number" ||
    price.confidence < 0.9
  )
    return trades;
  const usdPrice = price.price,
    timestamp = price.timestamp * 1000;
  return trades.map((t) => {
    const usdValue = units(t.pythAmountRaw) * usdPrice;
    if (
      Math.abs(timestamp - t.blockTime) > 900000 ||
      !Number.isFinite(usdValue)
    )
      return t;
    return {
      ...t,
      usdValue,
      priceUsd: usdPrice,
      priceTimestamp: timestamp,
      priceSource: "DefiLlama historical PYTH",
    };
  });
}
