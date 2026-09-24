import type { ParseResult, Trade } from "../types";
import { ROUTER_ADAPTERS } from "./registry";

const reviewOnly = ROUTER_ADAPTERS.filter((adapter) => adapter.reviewOnly);

function deferredRouter(trade: Trade) {
  return reviewOnly.find(
    (adapter) =>
      trade.router === adapter.id ||
      adapter.programIds.includes(trade.executionProgramId),
  );
}

/** Apply after decoded and raw-state trade merging, so neither path can publish
 * a review-only router. Retain a reason alongside the transaction evidence. */
export function applyRouterScope(result: ParseResult): ParseResult {
  const trades: Trade[] = [];
  const review = [...result.review];
  for (const trade of result.trades) {
    const adapter = deferredRouter(trade);
    if (!adapter) {
      trades.push(trade);
      continue;
    }
    const reason = `${adapter.id}: held outside initial router scope at ${trade.tradeId}`;
    if (!review.includes(reason)) review.push(reason);
  }
  return { ...result, trades, review };
}
