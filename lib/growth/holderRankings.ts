import { isPooledCustody } from "./holderEntities";
export const HOLDER_PERIODS = [1, 7, 30] as const;
export type HolderPeriod = typeof HOLDER_PERIODS[number];
export type HolderBalance = { owner: string; amount: string };
export type HolderDay = { date: string; collectedAt: number; entries: HolderBalance[] };
export type ComparisonStatus = "ready" | "collecting" | "missing";

export function daysBefore(date: string, days: number) {
  return new Date(Date.parse(`${date}T00:00:00Z`) - days * 86_400_000).toISOString().slice(0, 10);
}

/** Integer arithmetic keeps raw amounts and rounded percentage changes exact. */
function percentage(delta: bigint, previous: bigint) {
  const negative = delta < 0n;
  const basisPoints = ((negative ? -delta : delta) * 10_000n + previous / 2n) / previous;
  return `${negative && basisPoints > 0n ? "-" : ""}${basisPoints / 100n}.${(basisPoints % 100n).toString().padStart(2, "0")}`;
}

export function compareHolderRankings(today: HolderDay, firstDate: string, previous: Partial<Record<HolderPeriod, HolderDay | null>>) {
  const periods = HOLDER_PERIODS.map(days => {
    const targetDate = daysBefore(today.date, days);
    const historical = previous[days];
    const status: ComparisonStatus = historical ? "ready" : targetDate < firstDate ? "collecting" : "missing";
    const filteredRanks = new Map(historical?.entries.filter(entry => !isPooledCustody(entry.owner)).map((entry, i) => [entry.owner, i + 1]) ?? []);
    const owners = new Map(historical?.entries.map((entry, i) => [entry.owner, { ...entry, rank: i + 1 }]) ?? []);
    return { days, date: targetDate, collectedAt: historical?.collectedAt ?? null, status, owners, filteredRanks };
  });
  const todayFilteredRanks = new Map(today.entries.filter(entry => !isPooledCustody(entry.owner)).map((entry, i) => [entry.owner, i + 1]));
  return {
    periods: periods.map(({ owners: _owners, filteredRanks: _filteredRanks, ...period }) => period),
    entries: today.entries.map((entry, i) => ({ ...entry, rank: i + 1,
      changes: periods.map(period => {
        const earlier = period.owners.get(entry.owner);
        if (!earlier) return { days: period.days, amountDelta: null, percentageDelta: null, rankDelta: null, filteredRankDelta: null };
        const delta = BigInt(entry.amount) - BigInt(earlier.amount);
        return { days: period.days, amountDelta: delta.toString(), percentageDelta: percentage(delta, BigInt(earlier.amount)), rankDelta: earlier.rank - (i + 1),
          filteredRankDelta: todayFilteredRanks.has(entry.owner) && period.filteredRanks.has(entry.owner)
            ? period.filteredRanks.get(entry.owner)! - todayFilteredRanks.get(entry.owner)! : null };
      }),
    })),
  };
}
