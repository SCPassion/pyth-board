import { describe, expect, it } from "vitest";

import { buildRevenueBreakdownSections } from "@/lib/pyth-pro/breakdown";
import type { RevenueRow } from "@/lib/pyth-pro/forum";

const totalRow: RevenueRow = {
  product: "Total",
  grossRevenueUsd: 562_557,
  daoShareUsd: 340_384,
  douroLabsUsd: 222_173,
  isTotal: true,
};

describe("buildRevenueBreakdownSections", () => {
  it("labels monthly and cumulative revenue tables distinctly", () => {
    const sections = buildRevenueBreakdownSections({
      monthlyRows: [totalRow],
      cumulativeRows: [
        {
          ...totalRow,
          grossRevenueUsd: 2_502_246,
        },
      ],
      reportPeriodLabel: "July 2026",
    });

    expect(sections).toEqual([
      {
        key: "monthly",
        title: "Monthly revenue breakdown",
        description: "July 2026 reporting period",
        rows: [totalRow],
      },
      {
        key: "cumulative",
        title: "Cumulative revenue breakdown",
        description: "Accumulated since Sept 2025",
        rows: [
          {
            ...totalRow,
            grossRevenueUsd: 2_502_246,
          },
        ],
      },
    ]);
  });
});
