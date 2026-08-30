import { describe, expect, it } from "vitest";
import {
  getJupiterRetryDelayMs,
  reconcileBuybackSourceTotals,
  shouldFetchNextRecurringPage,
} from "@/convex/buybackMetrics";

describe("reconcileBuybackSourceTotals", () => {
  it("keeps cumulative buyback source totals from moving backward", () => {
    const reconciled = reconcileBuybackSourceTotals({
      previous: {
        totalUsdcSpentDca: 666_453.96,
        totalPythBoughtDca: 14_175_548.595715003,
        totalUsdcSpentLimitOrders: 127_573.137483,
        totalPythBoughtLimitOrders: 2_123_966.8726230003,
      },
      next: {
        totalUsdcSpentDca: 566_705.53,
        totalPythBoughtDca: 12_510_477.129249003,
        totalUsdcSpentLimitOrders: 127_573.137483,
        totalPythBoughtLimitOrders: 2_123_966.8726230003,
      },
    });

    expect(reconciled).toEqual({
      totalUsdcSpentDca: 666_453.96,
      totalPythBoughtDca: 14_175_548.595715003,
      totalUsdcSpentLimitOrders: 127_573.137483,
      totalPythBoughtLimitOrders: 2_123_966.8726230003,
    });
  });
});

describe("shouldFetchNextRecurringPage", () => {
  it("continues when Jupiter reports more total pages without hasMoreData", () => {
    expect(
      shouldFetchNextRecurringPage({
        currentPage: 1,
        returnedOrderCount: 7,
        hasMoreData: undefined,
        totalPages: 2,
      })
    ).toBe(true);
  });
});

describe("getJupiterRetryDelayMs", () => {
  it("retries rate-limited Jupiter requests with bounded backoff", () => {
    expect(
      getJupiterRetryDelayMs({
        attempt: 0,
        status: 429,
        retryAfterHeader: null,
      })
    ).toBe(1_000);
  });
});
