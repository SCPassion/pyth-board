import { describe, expect, it } from "vitest";

import type { ParsedDouroReport } from "@/lib/pyth-pro/forum";
import {
  buildRevenueSummary,
  percentChange,
  toShareOfTotalPoints,
} from "@/lib/pyth-pro/summary";

function report(
  createdAtMs: number,
  overrides: Partial<ParsedDouroReport>
): ParsedDouroReport {
  return {
    topicId: createdAtMs,
    title: `Report ${createdAtMs}`,
    slug: `report-${createdAtMs}`,
    url: `https://forum.pyth.network/t/${createdAtMs}`,
    authorUsername: "zenyas",
    createdAtMs,
    lastPostedAtMs: createdAtMs,
    highestPostNumber: 1,
    monthlyRevenueRows: [],
    cumulativeRevenueRows: [],
    legacySummaryRows: [],
    ...overrides,
  };
}

describe("percentChange", () => {
  it("returns null when a side is missing or the base is zero", () => {
    expect(percentChange(10, undefined)).toBeNull();
    expect(percentChange(null, 10)).toBeNull();
    expect(percentChange(10, 0)).toBeNull();
  });

  it("computes signed percent change", () => {
    expect(percentChange(150, 100)).toBe(50);
    expect(percentChange(50, 100)).toBe(-50);
  });
});

describe("buildRevenueSummary", () => {
  it("compares the latest month with the closest earlier report that has a value", () => {
    const summary = buildRevenueSummary([
      report(1000, {
        monthlyGrossRevenueUsd: 400_000,
        distribution: { tokenSymbol: "USDC", usdValue: 200_000 },
      }),
      report(2000, {
        distribution: {
          tokenSymbol: "PYTH",
          usdValue: 250_000,
          tokenAmount: 5_000_000,
        },
      }),
      report(3000, {
        monthlyGrossRevenueUsd: 500_000,
        cumulativeGrossRevenueUsd: 2_500_000,
        cumulativeDaoShareUsd: 1_500_000,
        distribution: {
          tokenSymbol: "PYTH",
          usdValue: 300_000,
          tokenAmount: 6_000_000,
        },
      }),
    ]);

    expect(summary).toEqual({
      latestGrossRevenueUsd: 500_000,
      grossRevenueChangePct: 25,
      latestDistributionUsd: 300_000,
      distributionChangePct: 20,
      cumulativeGrossRevenueUsd: 2_500_000,
      cumulativeDaoShareUsd: 1_500_000,
      totalPythDistributed: 11_000_000,
    });
  });

  it("does not report a stale value when the latest report lacks it", () => {
    const summary = buildRevenueSummary([
      report(1000, { monthlyGrossRevenueUsd: 400_000 }),
      report(2000, {}),
    ]);
    expect(summary.latestGrossRevenueUsd).toBeNull();
    expect(summary.grossRevenueChangePct).toBeNull();
  });
});

describe("toShareOfTotalPoints", () => {
  it("converts product values to percent of the month's total", () => {
    expect(
      toShareOfTotalPoints(
        [
          { label: "Jan", A: 75, B: 25 },
          { label: "Feb", A: null, B: null },
        ],
        ["A", "B"]
      )
    ).toEqual([
      { label: "Jan", A: 75, B: 25 },
      { label: "Feb", A: null, B: null },
    ]);
  });
});
