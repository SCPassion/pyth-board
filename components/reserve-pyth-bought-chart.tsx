"use client";

import { useId, useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Loader2 } from "lucide-react";
import {
  buildBuybackHistoryChartModel,
  type BuybackHistorySnapshot,
} from "@/lib/buyback/history";
import {
  formatPythAmount,
  formatUsd,
  formatUsdPerPyth,
} from "@/lib/buyback/format";

const DAY_MS = 24 * 60 * 60 * 1000;

export function ReservePythBoughtChart({
  compact = false,
}: {
  compact?: boolean;
}) {
  const gradientId = useId().replace(/:/g, "");
  const rawHistory = useQuery(
    api.pythBuybackSnapshots.getPythBuybackHistory,
    {},
  );

  const {
    chartData,
    latestPythBought,
    pythBoughtSinceTracking,
    firstTrackedTimestampMs,
  } = useMemo(
    () =>
      buildBuybackHistoryChartModel(
        (rawHistory ?? []) as BuybackHistorySnapshot[],
      ),
    [rawHistory],
  );

  const latestPoint = chartData.at(-1) ?? null;
  const firstValue = chartData.at(0)?.totalPythBought ?? null;
  const lastUpdated = latestPoint?.timestampMs;
  const spanMs =
    chartData.length > 1
      ? chartData[chartData.length - 1].minuteBucketMs -
        chartData[0].minuteBucketMs
      : 0;
  const spanDays = spanMs / DAY_MS;

  const axisMode: "daily" | "weekly" | "monthly" =
    spanDays <= 60 ? "daily" : spanDays <= 365 ? "weekly" : "monthly";

  const axisTicks = useMemo(() => {
    if (chartData.length === 0) return [];

    const start = chartData[0].minuteBucketMs;
    const end = chartData[chartData.length - 1].minuteBucketMs;

    if (axisMode === "daily") {
      return chartData.map((point) => point.minuteBucketMs);
    }

    if (axisMode === "weekly") {
      const ticks: number[] = [];
      const firstDay = Math.floor(start / DAY_MS) * DAY_MS;
      for (let t = firstDay; t <= end; t += 7 * DAY_MS) {
        ticks.push(t);
      }
      if (ticks[ticks.length - 1] !== end) {
        ticks.push(end);
      }
      return ticks;
    }

    const ticks: number[] = [];
    const startDate = new Date(start);
    const endDate = new Date(end);
    const cursor = new Date(
      Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), 1),
    );

    while (cursor.getTime() <= endDate.getTime()) {
      ticks.push(cursor.getTime());
      cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    }

    if (ticks[ticks.length - 1] !== end) {
      ticks.push(end);
    }

    return ticks;
  }, [axisMode, chartData]);

  const formattedTrackingStart =
    typeof firstTrackedTimestampMs === "number"
      ? new Date(firstTrackedTimestampMs).toLocaleDateString()
      : "-";

  return (
    <div className={`flex flex-col ${compact ? "gap-5" : "h-full gap-6"}`}>
      <div>
        <p
          className={`font-data text-[11px] uppercase tracking-[0.25em] text-cyan-300/60`}
        >
          Council Ops &rarr; USDC / PYTH
        </p>
        <h3 className={`font-display mt-1 text-xl text-white sm:text-2xl`}>
          {compact ? "On-chain buybacks" : "On-chain PYTH Buybacks over time"}
        </h3>
        {!compact && (
          <p className={`font-data mt-1 text-[11px] text-[#8f88a9]`}>
            {lastUpdated
              ? `UPDATED ${new Date(lastUpdated).toLocaleString()}`
              : "WAITING FOR FIRST SNAPSHOT"}
          </p>
        )}
      </div>

      {compact ? (
        <div className="min-h-[108px] border-t border-white/8 pt-4">
          <p className="text-xs text-[#a8a1bf]">Total PYTH bought</p>
          <p className="font-data mt-1 text-3xl font-medium tabular-nums text-white">
            {latestPythBought !== null
              ? formatPythAmount(latestPythBought)
              : "—"}
          </p>
          <p className="mt-2 text-xs text-[#a8a1bf]">
            {latestPoint
              ? `${formatUsd(latestPoint.totalUsdcSpent)} USDC spent`
              : rawHistory === undefined
                ? "Loading buyback history…"
                : "Awaiting buyback snapshots"}
          </p>
        </div>
      ) : (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-5 border-t border-white/8 pt-5 sm:grid-cols-4">
          <div className="min-w-0">
            <dt className="text-[11px] text-[#a8a1bf] sm:text-xs">
              Total Bought
            </dt>
            <dd
              className={`font-data mt-1 whitespace-nowrap text-lg font-medium tabular-nums text-white sm:text-xl`}
            >
              {latestPythBought !== null
                ? formatPythAmount(latestPythBought)
                : "-"}
            </dd>
          </div>

          <div className="min-w-0">
            <dt className="text-[11px] text-[#a8a1bf] sm:text-xs">
              Since Tracking
            </dt>
            <dd
              className={`font-data mt-1 whitespace-nowrap text-lg font-medium tabular-nums text-white sm:text-xl`}
            >
              {pythBoughtSinceTracking !== null
                ? formatPythAmount(pythBoughtSinceTracking)
                : "-"}
            </dd>
            <dd className={`font-data mt-0.5 text-[10px] text-[#7d7593]`}>
              since {formattedTrackingStart}
            </dd>
          </div>

          <div className="min-w-0">
            <dt className="text-[11px] text-[#a8a1bf] sm:text-xs">
              USDC Spent
            </dt>
            <dd
              className={`font-data mt-1 whitespace-nowrap text-lg font-medium tabular-nums text-white sm:text-xl`}
              title={
                latestPoint ? formatUsd(latestPoint.totalUsdcSpent) : undefined
              }
            >
              {latestPoint
                ? `${formatUsd(latestPoint.totalUsdcSpent / 1_000_000, 3)}M`
                : "-"}
            </dd>
          </div>

          <div className="min-w-0">
            <dt className="text-[11px] text-[#a8a1bf] sm:text-xs">
              Avg. / PYTH
            </dt>
            <dd
              className={`font-data mt-1 whitespace-nowrap text-lg font-medium tabular-nums text-white sm:text-xl`}
              title={
                latestPoint && latestPoint.avgBuyPriceUsd > 0
                  ? formatUsdPerPyth(latestPoint.avgBuyPriceUsd)
                  : undefined
              }
            >
              {latestPoint && latestPoint.avgBuyPriceUsd > 0
                ? formatUsd(latestPoint.avgBuyPriceUsd, 5)
                : "-"}
            </dd>
          </div>
        </dl>
      )}

      <div className={compact ? "min-h-[180px] shrink-0" : "min-h-0 flex-1"}>
        {!rawHistory ? (
          <div
            className={`flex items-center justify-center text-[#a8a1bf] ${compact ? "h-[180px] text-sm" : "aspect-[16/10] max-h-[320px] min-h-[220px]"}`}
            role="status"
          >
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Loading history...
          </div>
        ) : chartData.length === 0 ? (
          <div
            className={`flex items-center justify-center text-center text-sm text-[#a8a1bf] ${compact ? "h-[180px]" : "aspect-[16/10] max-h-[320px] min-h-[220px]"}`}
          >
            No buyback snapshots available yet.
          </div>
        ) : (
          <div
            className={
              compact
                ? "h-[180px] min-h-[180px] w-full"
                : "aspect-[16/10] max-h-[320px] min-h-[220px] w-full"
            }
          >
            <ChartContainer
              className="!block h-full w-full min-w-0 aspect-auto"
              aria-label="Cumulative on-chain PYTH bought over time"
              config={{
                totalPythBought: {
                  label: "PYTH Bought",
                  color: "#22d3ee",
                },
              }}
            >
              <AreaChart
                accessibilityLayer
                data={chartData}
                margin={{ left: 0, right: 10, top: 10, bottom: 6 }}
              >
                <defs>
                  <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="0%"
                      stopColor="var(--color-totalPythBought)"
                      stopOpacity={0.4}
                    />
                    <stop
                      offset="55%"
                      stopColor="var(--color-totalPythBought)"
                      stopOpacity={0.16}
                    />
                    <stop
                      offset="100%"
                      stopColor="var(--color-totalPythBought)"
                      stopOpacity={0.03}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  vertical={false}
                  strokeDasharray="3 3"
                  stroke="rgba(148, 163, 184, 0.25)"
                />
                <XAxis
                  dataKey="minuteBucketMs"
                  type="number"
                  scale="time"
                  domain={["dataMin", "dataMax"]}
                  ticks={axisTicks}
                  tickLine={false}
                  axisLine={false}
                  minTickGap={24}
                  tick={{ fill: "#94a3b8", fontSize: 11 }}
                  tickFormatter={(value) =>
                    axisMode === "monthly"
                      ? new Date(value).toLocaleDateString([], {
                          year: "2-digit",
                          month: "short",
                        })
                      : new Date(value).toLocaleDateString([], {
                          month: "short",
                          day: "2-digit",
                        })
                  }
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  width={compact ? 58 : 80}
                  domain={[firstValue ?? "dataMin", "dataMax"]}
                  tick={{ fill: "#94a3b8", fontSize: 11 }}
                  tickFormatter={(value) =>
                    compact
                      ? formatPythAmount(Number(value))
                      : Number(value).toLocaleString()
                  }
                />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      className="border-white/10 bg-[#241b35] text-white"
                      formatter={(value) =>
                        `${Number(value).toLocaleString()} PYTH`
                      }
                      labelFormatter={(_, payload) => {
                        const timestampMs = payload?.[0]?.payload?.timestampMs;
                        if (!timestampMs) return "";
                        return new Date(timestampMs).toLocaleString();
                      }}
                    />
                  }
                />
                <Area
                  dataKey="totalPythBought"
                  type="monotone"
                  stroke="var(--color-totalPythBought)"
                  fill={`url(#${gradientId})`}
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ r: 4, fill: "var(--color-totalPythBought)" }}
                />
              </AreaChart>
            </ChartContainer>
          </div>
        )}
      </div>
    </div>
  );
}
