export type BuybackHistorySnapshot = {
  timestampMs: number;
  minuteBucketMs: number;
  totalUsdcSpent: number;
  totalPythBought: number;
  avgBuyPriceUsd: number;
};

export type BuybackHistoryChartPoint = BuybackHistorySnapshot & {
  totalPythBought: number;
};

export function buildBuybackHistoryChartModel(
  rawHistory: BuybackHistorySnapshot[]
) {
  const chartData: BuybackHistoryChartPoint[] = rawHistory.map((point) => ({
    timestampMs: point.timestampMs,
    minuteBucketMs: point.minuteBucketMs,
    totalPythBought: Number(point.totalPythBought.toFixed(2)),
    totalUsdcSpent: point.totalUsdcSpent,
    avgBuyPriceUsd: point.avgBuyPriceUsd,
  }));

  const latestPythBought = chartData.at(-1)?.totalPythBought ?? null;
  const firstPythBought = chartData.at(0)?.totalPythBought ?? null;
  const pythBoughtSinceTracking =
    latestPythBought !== null && firstPythBought !== null
      ? Number((latestPythBought - firstPythBought).toFixed(2))
      : null;

  return {
    chartData,
    latestPythBought,
    pythBoughtSinceTracking,
    firstTrackedTimestampMs: chartData.at(0)?.timestampMs ?? null,
    latestTrackedTimestampMs: chartData.at(-1)?.timestampMs ?? null,
  };
}
