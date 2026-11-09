import type { ParsedDouroReport } from "./forum";

export type RevenueSummary = {
  latestGrossRevenueUsd: number | null;
  grossRevenueChangePct: number | null;
  latestDistributionUsd: number | null;
  distributionChangePct: number | null;
  cumulativeGrossRevenueUsd: number | null;
  cumulativeDaoShareUsd: number | null;
  totalPythDistributed: number;
};

/** Percent change from `previous` to `current`, or null when either side is unusable. */
export function percentChange(
  current: number | null | undefined,
  previous: number | null | undefined
): number | null {
  if (current === null || current === undefined) return null;
  if (previous === null || previous === undefined || previous === 0) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

/**
 * Latest value of `pick` and its change against the closest earlier report
 * that also reports a value. Reports must be sorted oldest first.
 */
function latestWithChange(
  reports: ParsedDouroReport[],
  pick: (report: ParsedDouroReport) => number | undefined
): { value: number | null; changePct: number | null } {
  const values = reports
    .map(pick)
    .filter((value): value is number => value !== undefined);
  const latestReportValue = reports.length > 0 ? pick(reports[reports.length - 1]) : undefined;
  if (latestReportValue === undefined) {
    return { value: null, changePct: null };
  }
  return {
    value: latestReportValue,
    changePct: percentChange(values.at(-1), values.at(-2)),
  };
}

export function buildRevenueSummary(
  sortedReports: ParsedDouroReport[]
): RevenueSummary {
  const latest = sortedReports.at(-1);
  const gross = latestWithChange(
    sortedReports,
    (report) => report.monthlyGrossRevenueUsd
  );
  const distribution = latestWithChange(
    sortedReports,
    (report) => report.distribution?.usdValue
  );
  const totalPythDistributed = sortedReports.reduce(
    (sum, report) =>
      report.distribution?.tokenSymbol === "PYTH"
        ? sum + (report.distribution.tokenAmount ?? 0)
        : sum,
    0
  );

  return {
    latestGrossRevenueUsd: gross.value,
    grossRevenueChangePct: gross.changePct,
    latestDistributionUsd: distribution.value,
    distributionChangePct: distribution.changePct,
    cumulativeGrossRevenueUsd: latest?.cumulativeGrossRevenueUsd ?? null,
    cumulativeDaoShareUsd: latest?.cumulativeDaoShareUsd ?? null,
    totalPythDistributed,
  };
}

/**
 * Converts product revenue points into each product's share of that month's
 * product total (0–100). Months with no product revenue stay null.
 */
export function toShareOfTotalPoints(
  points: Array<Record<string, number | string | null>>,
  products: string[]
): Array<Record<string, number | string | null>> {
  return points.map((point) => {
    const total = products.reduce((sum, product) => {
      const value = point[product];
      return typeof value === "number" ? sum + value : sum;
    }, 0);
    const sharePoint: Record<string, number | string | null> = { ...point };
    for (const product of products) {
      const value = point[product];
      sharePoint[product] =
        total > 0 && typeof value === "number" ? (value / total) * 100 : null;
    }
    return sharePoint;
  });
}
