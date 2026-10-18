import type { HolderPeriod } from "./holderRankings";

export type HolderOrder = "balance" | "increase" | "reduction";
type ComparableHolder = {
  rank: number;
  changes: { days: number; amountDelta: string | null }[];
};

/** Use raw token units: a real change can round to 0.00% in the display. */
export function changedHolders<T extends ComparableHolder>(entries: T[], days: HolderPeriod, ready: boolean) {
  if (!ready) return [];
  return entries.filter(entry => {
    const delta = entry.changes.find(change => change.days === days)?.amountDelta;
    return delta != null && BigInt(delta) !== 0n;
  });
}

/** Rank exact token changes before applying the display limit. Unknown balances are never zero. */
export function orderHolderMovers<T extends ComparableHolder>(entries: T[], days: HolderPeriod, order: HolderOrder, ready: boolean) {
  if (order === "balance") return entries;
  if (!ready) return [];
  return entries.flatMap(entry => {
    const delta = entry.changes.find(change => change.days === days)?.amountDelta;
    if (delta == null) return [];
    const amount = BigInt(delta);
    return (order === "increase" ? amount > 0n : amount < 0n) ? [{ entry, amount }] : [];
  }).sort((a, b) => a.amount === b.amount ? a.entry.rank - b.entry.rank
    : order === "increase" ? (a.amount > b.amount ? -1 : 1) : (a.amount < b.amount ? -1 : 1))
    .map(({ entry }) => entry);
}
