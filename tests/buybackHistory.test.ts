import { describe, expect, it } from "vitest";
import { buildBuybackHistoryChartModel } from "@/lib/buyback/history";

describe("buildBuybackHistoryChartModel", () => {
  it("maps Convex buyback snapshots into rounded total PYTH chart points", () => {
    const model = buildBuybackHistoryChartModel([
      {
        timestampMs: 1_710_000_123_456,
        minuteBucketMs: 1_710_000_120_000,
        totalUsdcSpent: 12_500,
        totalPythBought: 123_456.789,
        avgBuyPriceUsd: 0.10125,
      },
      {
        timestampMs: 1_710_086_523_456,
        minuteBucketMs: 1_710_086_520_000,
        totalUsdcSpent: 18_000,
        totalPythBought: 150_000.234,
        avgBuyPriceUsd: 0.12,
      },
    ]);

    expect(model.chartData).toEqual([
      {
        timestampMs: 1_710_000_123_456,
        minuteBucketMs: 1_710_000_120_000,
        totalPythBought: 123_456.79,
        totalUsdcSpent: 12_500,
        avgBuyPriceUsd: 0.10125,
      },
      {
        timestampMs: 1_710_086_523_456,
        minuteBucketMs: 1_710_086_520_000,
        totalPythBought: 150_000.23,
        totalUsdcSpent: 18_000,
        avgBuyPriceUsd: 0.12,
      },
    ]);
    expect(model.latestPythBought).toBe(150_000.23);
    expect(model.firstTrackedTimestampMs).toBe(1_710_000_123_456);
    expect(model.latestTrackedTimestampMs).toBe(1_710_086_523_456);
  });

  it("computes purchased delta from the first tracked snapshot", () => {
    const model = buildBuybackHistoryChartModel([
      {
        timestampMs: 1000,
        minuteBucketMs: 1000,
        totalUsdcSpent: 100,
        totalPythBought: 1_000,
        avgBuyPriceUsd: 0.1,
      },
      {
        timestampMs: 2000,
        minuteBucketMs: 2000,
        totalUsdcSpent: 250,
        totalPythBought: 1_600.555,
        avgBuyPriceUsd: 0.15625,
      },
    ]);

    expect(model.pythBoughtSinceTracking).toBe(600.56);
  });

  it("returns null summary values for an empty history", () => {
    const model = buildBuybackHistoryChartModel([]);

    expect(model.chartData).toEqual([]);
    expect(model.latestPythBought).toBeNull();
    expect(model.pythBoughtSinceTracking).toBeNull();
    expect(model.firstTrackedTimestampMs).toBeNull();
    expect(model.latestTrackedTimestampMs).toBeNull();
  });
});
