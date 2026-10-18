export const PRICE_FEED_COUNTS_URL = "https://app.pyth.com/api/price-feeds/facets";
export const PRICE_FEED_DAY_MS = 86_400_000;

export const PRICE_FEED_STATUSES = ["stable", "comingSoon", "inactive"] as const;
export type PriceFeedStatus = (typeof PRICE_FEED_STATUSES)[number];
export const PRICE_FEED_SERIES = [...PRICE_FEED_STATUSES, "total"] as const;
export type PriceFeedSeries = (typeof PRICE_FEED_SERIES)[number];
export type PriceFeedCounts = Record<PriceFeedStatus, number>;
export type PriceFeedSnapshot = PriceFeedCounts & { date: string; collectedAt: number };

export function validatePriceFeedCounts(counts: PriceFeedCounts): void {
  if (PRICE_FEED_STATUSES.some(status => !Number.isSafeInteger(counts[status]) || counts[status] < 0) ||
    !Number.isSafeInteger(totalPriceFeeds(counts)) || totalPriceFeeds(counts) <= 0) {
    throw new Error("Invalid price-feed counts");
  }
}

export function totalPriceFeeds(counts: PriceFeedCounts): number {
  return counts.stable + counts.comingSoon + counts.inactive;
}

export function priceFeedTotalDomain([min, max]: [number, number]): [number, number] {
  // Keep small catalog changes visible without magnifying a single feed to the
  // full chart height. Constant and single-snapshot histories still get room.
  const padding = Math.max(Math.ceil((max - min) * 0.2), Math.ceil(max * 0.0025), 1);
  const rounding = 10 ** Math.floor(Math.log10(padding));
  return [
    Math.max(0, Math.floor((min - padding) / rounding) * rounding),
    Math.ceil((max + padding) / rounding) * rounding,
  ];
}

export function priceFeedChangeDomain([min, max]: [number, number]): [number, number] {
  const lower = Math.min(0, min);
  const upper = Math.max(0, max);
  const padding = Math.max(1, Math.ceil((upper - lower) * 0.2));
  const rounding = 10 ** Math.floor(Math.log10(padding));
  return [
    Math.floor((lower - padding) / rounding) * rounding,
    Math.ceil((upper + padding) / rounding) * rounding,
  ];
}

export function priceFeedVisibleScale(
  points: readonly Record<PriceFeedSeries, number | null>[],
  keys: readonly PriceFeedSeries[],
  view: "change" | "counts",
): { domain: [number, number]; ticks: number[] } {
  let min = Infinity;
  let max = -Infinity;
  for (const point of points) {
    for (const key of keys) {
      const value = point[key];
      if (value !== null && Number.isFinite(value)) {
        min = Math.min(min, value);
        max = Math.max(max, value);
      }
    }
  }
  const [lower, upper] = !Number.isFinite(min)
    ? view === "change" ? [-1, 1] : [0, 1]
    : view === "change" ? priceFeedChangeDomain([min, max]) : priceFeedTotalDomain([min, max]);
  const targetStep = Math.max(1, (upper - lower) / 4);
  const magnitude = 10 ** Math.floor(Math.log10(targetStep));
  const step = [1, 2, 5, 10].find(value => value * magnitude >= targetStep)! * magnitude;
  const start = Math.floor(lower / step) * step;
  const end = Math.ceil(upper / step) * step;
  return {
    domain: [start, end],
    ticks: Array.from({ length: Math.round((end - start) / step) + 1 }, (_, index) => start + index * step),
  };
}

export function parsePriceFeedCounts(payload: unknown): PriceFeedCounts {
  if (!payload || typeof payload !== "object" || !("state" in payload) || !Array.isArray(payload.state)) {
    throw new Error("Price-feed response is missing its state counters");
  }
  const values = new Map<string, number>();
  for (const entry of payload.state) {
    if (!entry || typeof entry !== "object" || typeof entry.value !== "string" ||
      typeof entry.count !== "number" || !Number.isSafeInteger(entry.count) || entry.count < 0 || values.has(entry.value)) {
      throw new Error("Price-feed response contains invalid or duplicate state counters");
    }
    // A newly populated status needs an explicit counting/UI decision, not a silently incomplete total.
    if (!["stable", "coming_soon", "inactive"].includes(entry.value) && entry.count !== 0) {
      throw new Error(`Price-feed response contains an unsupported status: ${entry.value}`);
    }
    values.set(entry.value, entry.count);
  }
  if (!["stable", "coming_soon", "inactive"].every(status => values.has(status))) {
    throw new Error("Price-feed response is missing a required status");
  }
  const counts = { stable: values.get("stable")!, comingSoon: values.get("coming_soon")!, inactive: values.get("inactive")! };
  validatePriceFeedCounts(counts);
  return counts;
}

export async function fetchPriceFeedCounts(fetcher: typeof fetch = fetch): Promise<PriceFeedCounts> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetcher(PRICE_FEED_COUNTS_URL, {
      headers: { Accept: "application/json" }, signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Price-feed request failed (HTTP ${response.status})`);
    return parsePriceFeedCounts(await response.json());
  } finally {
    clearTimeout(timeout);
  }
}

export function validatePriceFeedDate(date: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(`${date}T00:00:00Z`)) ||
    new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date) {
    throw new Error("Invalid price-feed snapshot date");
  }
}

export function buildPriceFeedChart(snapshots: PriceFeedSnapshot[]) {
  return snapshots.flatMap((row, index) => {
    const time = Date.parse(`${row.date}T00:00:00Z`);
    const point = { time, stable: row.stable, comingSoon: row.comingSoon, inactive: row.inactive, total: totalPriceFeeds(row) };
    const previous = snapshots[index - 1];
    return previous && time - Date.parse(`${previous.date}T00:00:00Z`) > PRICE_FEED_DAY_MS
      ? [{ time: time - PRICE_FEED_DAY_MS, stable: null, comingSoon: null, inactive: null, total: null }, point]
      : [point];
  });
}

export function buildPriceFeedChangeChart(snapshots: PriceFeedSnapshot[]) {
  const first = snapshots[0];
  return buildPriceFeedChart(snapshots).map(point => ({
    ...point,
    counts: { stable: point.stable, comingSoon: point.comingSoon, inactive: point.inactive, total: point.total },
    stable: point.stable === null ? null : point.stable - first.stable,
    comingSoon: point.comingSoon === null ? null : point.comingSoon - first.comingSoon,
    inactive: point.inactive === null ? null : point.inactive - first.inactive,
    total: point.total === null ? null : point.total - totalPriceFeeds(first),
  }));
}
