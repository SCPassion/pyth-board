import type { Trade } from "./types";
export type Totals = {
  buyRaw: string;
  sellRaw: string;
  buyUsd: number;
  sellUsd: number;
  buyCount: number;
  sellCount: number;
  valuedCount: number;
  unresolvedCount: number;
};
export const emptyTotals = (): Totals => ({
  buyRaw: "0",
  sellRaw: "0",
  buyUsd: 0,
  sellUsd: 0,
  buyCount: 0,
  sellCount: 0,
  valuedCount: 0,
  unresolvedCount: 0,
});
export function addTotals(a: Totals, b: Totals, factor = 1): Totals {
  return {
    buyRaw: (BigInt(a.buyRaw) + BigInt(b.buyRaw) * BigInt(factor)).toString(),
    sellRaw: (
      BigInt(a.sellRaw) +
      BigInt(b.sellRaw) * BigInt(factor)
    ).toString(),
    buyUsd: a.buyUsd + b.buyUsd * factor,
    sellUsd: a.sellUsd + b.sellUsd * factor,
    buyCount: a.buyCount + b.buyCount * factor,
    sellCount: a.sellCount + b.sellCount * factor,
    valuedCount: a.valuedCount + b.valuedCount * factor,
    unresolvedCount: a.unresolvedCount + b.unresolvedCount * factor,
  };
}
export function contribution(t: Trade): Totals {
  return {
    ...emptyTotals(),
    buyRaw: t.side === "BUY" ? t.pythAmountRaw : "0",
    sellRaw: t.side === "SELL" ? t.pythAmountRaw : "0",
    buyUsd: t.side === "BUY" ? (t.usdValue ?? 0) : 0,
    sellUsd: t.side === "SELL" ? (t.usdValue ?? 0) : 0,
    buyCount: t.side === "BUY" ? 1 : 0,
    sellCount: t.side === "SELL" ? 1 : 0,
    valuedCount: t.usdValue === null ? 0 : 1,
    unresolvedCount: eligibleOwner(t) ? 0 : 1,
  };
}
export function eligibleOwner(t: Pick<Trade, "owner" | "ownerConfidence">) {
  return !!t.owner && ["HIGH", "MEDIUM"].includes(t.ownerConfidence);
}
export function units(raw: string, decimals = 6) {
  return Number(raw) / 10 ** decimals;
}
export const HOUR = 3600000;
export function bucketStart(time: number) {
  return Math.floor(time / HOUR) * HOUR;
}
export function retryDelay(attempt: number) {
  return Math.min(30000 * 2 ** Math.max(0, attempt - 1), 3600000);
}
