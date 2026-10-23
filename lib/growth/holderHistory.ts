import type { HolderPeriod } from "./holderRankings";

export type HolderHistory = {
  owner: string;
  days: HolderPeriod;
  date: string;
  collectedAt: number;
  points: { date: string; amount: string | null; collectedAt: number | null }[];
};

const integer = new Intl.NumberFormat("en-US");

export function formatHolderTokens(value: string, signed = false) {
  const raw = BigInt(value), absolute = raw < 0n ? -raw : raw;
  const fraction = (absolute % 1_000_000n).toString().padStart(6, "0").replace(/0+$/, "");
  return (raw < 0n ? "−" : signed && raw > 0n ? "+" : "") + integer.format(absolute / 1_000_000n) + (fraction ? `.${fraction}` : "");
}

export function holderHistoryChart(points: HolderHistory["points"]) {
  return points.map(point => ({
    ...point,
    time: Date.parse(`${point.date}T00:00:00Z`),
    // Only chart geometry uses floating point. Tooltips retain the exact raw amount.
    balance: point.amount === null ? null : Number(point.amount) / 1_000_000,
  }));
}

export function holderHistoryDomain([min, max]: [number, number]): [number, number] {
  const padding = Math.max((max - min) * 0.15, max * 0.0025, 0.000001);
  return [Math.max(0, min - padding), max + padding];
}
