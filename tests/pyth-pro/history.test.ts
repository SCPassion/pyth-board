import { describe, expect, it } from "vitest";

import type { ParsedDouroReport } from "@/lib/pyth-pro/forum";
import {
  buildDouroDistributionSeries,
  buildDouroRevenueSeries,
  buildProductRevenueSeries,
} from "@/lib/pyth-pro/history";

function report(
  title: string,
  createdAtMs: number,
  overrides: Partial<ParsedDouroReport>
): ParsedDouroReport {
  return {
    topicId: createdAtMs,
    title,
    slug: title.toLowerCase().replaceAll(" ", "-"),
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

describe("buildDouroRevenueSeries", () => {
  it("orders reports chronologically and keeps missing monthly values null", () => {
    const series = buildDouroRevenueSeries([
      report("Pyth Pro: Douro Labs Report - July 2026", 3000, {
        monthlyGrossRevenueUsd: 562_557,
        monthlyDaoShareUsd: 340_384,
        cumulativeGrossRevenueUsd: 2_502_246,
        cumulativeDaoShareUsd: 1_519_197,
      }),
      report("Pyth Pro: Douro Labs Report - January 2026", 1000, {
        cumulativeGrossRevenueUsd: 475_312,
        cumulativeDaoShareUsd: 285_187,
      }),
      report("Pyth Pro: Douro Labs Report - February 2026", 2000, {
        cumulativeGrossRevenueUsd: 655_145,
        cumulativeDaoShareUsd: 393_087,
      }),
    ]);

    expect(series).toEqual([
      {
        label: "Jan 2026",
        reportTitle: "Pyth Pro: Douro Labs Report - January 2026",
        reportUrl: "https://forum.pyth.network/t/1000",
        timestampMs: 1000,
        monthlyGrossRevenueUsd: null,
        monthlyDaoShareUsd: null,
        monthlyDouroLabsUsd: null,
        cumulativeGrossRevenueUsd: 475_312,
        cumulativeDaoShareUsd: 285_187,
        cumulativeDouroLabsUsd: null,
        distributionUsd: null,
      },
      {
        label: "Feb 2026",
        reportTitle: "Pyth Pro: Douro Labs Report - February 2026",
        reportUrl: "https://forum.pyth.network/t/2000",
        timestampMs: 2000,
        monthlyGrossRevenueUsd: null,
        monthlyDaoShareUsd: null,
        monthlyDouroLabsUsd: null,
        cumulativeGrossRevenueUsd: 655_145,
        cumulativeDaoShareUsd: 393_087,
        cumulativeDouroLabsUsd: null,
        distributionUsd: null,
      },
      {
        label: "Jul 2026",
        reportTitle: "Pyth Pro: Douro Labs Report - July 2026",
        reportUrl: "https://forum.pyth.network/t/3000",
        timestampMs: 3000,
        monthlyGrossRevenueUsd: 562_557,
        monthlyDaoShareUsd: 340_384,
        monthlyDouroLabsUsd: null,
        cumulativeGrossRevenueUsd: 2_502_246,
        cumulativeDaoShareUsd: 1_519_197,
        cumulativeDouroLabsUsd: null,
        distributionUsd: null,
      },
    ]);
  });
});

describe("buildDouroDistributionSeries", () => {
  it("orders reports chronologically and keeps PYTH payment details", () => {
    const series = buildDouroDistributionSeries([
      report("Pyth Pro: Douro Labs Report - April 2026", 3000, {
        distribution: {
          tokenAmount: 5_059_107,
          usdValue: 229_132,
          tokenSymbol: "PYTH",
          twapUsd: 0.045291,
          pythPerUsd: 22.08,
        },
      }),
      report("Pyth Pro: Douro Labs Report - March 2026", 2000, {}),
      report("Pyth Pro: Douro Labs Report - January 2026", 1000, {
        distribution: {
          tokenSymbol: "USDC",
          tokenAmount: 73_700,
          usdValue: 73_700,
        },
      }),
    ]);

    expect(series).toEqual([
      {
        label: "Jan 2026",
        reportTitle: "Pyth Pro: Douro Labs Report - January 2026",
        reportUrl: "https://forum.pyth.network/t/1000",
        timestampMs: 1000,
        tokenSymbol: "USDC",
        tokenAmount: null,
        usdValue: 73_700,
        twapUsd: null,
      },
      {
        label: "Apr 2026",
        reportTitle: "Pyth Pro: Douro Labs Report - April 2026",
        reportUrl: "https://forum.pyth.network/t/3000",
        timestampMs: 3000,
        tokenSymbol: "PYTH",
        tokenAmount: 5_059_107,
        usdValue: 229_132,
        twapUsd: 0.045291,
      },
    ]);
  });
});

describe("buildProductRevenueSeries", () => {
  it("uses null for products that are absent from a report", () => {
    const series = buildProductRevenueSeries([
      report("Pyth Pro: Douro Labs Report - April 2026", 1000, {
        monthlyRevenueRows: [
          { product: "Pyth Pro", grossRevenueUsd: 320_387, isTotal: false },
          { product: "LaaS", grossRevenueUsd: 41_000, isTotal: false },
          { product: "Total", grossRevenueUsd: 361_387, isTotal: true },
        ],
      }),
      report("Pyth Pro: Douro Labs Report - July 2026", 2000, {
        monthlyRevenueRows: [
          { product: "Pyth Pro", grossRevenueUsd: 538_391, isTotal: false },
          { product: "LaaS", grossRevenueUsd: 9_500, isTotal: false },
          { product: "Indices", grossRevenueUsd: 14_667, isTotal: false },
          { product: "Total", grossRevenueUsd: 562_557, isTotal: true },
        ],
      }),
    ]);

    expect(series.products).toEqual(["Pyth Pro", "LaaS", "Indices"]);
    expect(series.primaryProduct).toBe("Pyth Pro");
    expect(series.secondaryProducts).toEqual(["LaaS", "Indices"]);
    expect(series.points).toEqual([
      {
        label: "Apr 2026",
        timestampMs: 1000,
        "Pyth Pro": 320_387,
        LaaS: 41_000,
        Indices: null,
      },
      {
        label: "Jul 2026",
        timestampMs: 2000,
        "Pyth Pro": 538_391,
        LaaS: 9_500,
        Indices: 14_667,
      },
    ]);
  });
});
