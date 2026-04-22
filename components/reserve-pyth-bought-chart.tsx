"use client";

import { useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { formatPythAmount, formatUsd, formatUsdPerPyth } from "@/lib/buyback/format";

const DAY_MS = 24 * 60 * 60 * 1000;

export function ReservePythBoughtChart() {
  const rawHistory = useQuery(api.pythBuybackSnapshots.getPythBuybackHistory, {});

  const {
    chartData,
    latestPythBought,
    pythBoughtSinceTracking,
    firstTrackedTimestampMs,
  } = useMemo(
    () =>
      buildBuybackHistoryChartModel(
        (rawHistory ?? []) as BuybackHistorySnapshot[]
      ),
    [rawHistory]
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
      Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), 1)
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
    <div className="space-y-5">
      <div className="grid min-h-0 grid-cols-1 lg:grid-cols-[320px_1fr] lg:min-h-[calc(100vh-360px)] lg:h-[calc(100vh-360px)] lg:overflow-hidden">
        <div className="space-y-6 border-b border-white/8 p-6 lg:border-b-0 lg:border-r">
          <div>
            <p className="mb-2 text-sm text-[#a8a1bf]">Total PYTH Bought</p>
            <p className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              {latestPythBought !== null
                ? formatPythAmount(latestPythBought)
                : "-"}
            </p>
          </div>

          <div>
            <p className="mb-2 text-sm text-[#a8a1bf]">
              PYTH Bought Since Tracking
            </p>
            <p className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              {pythBoughtSinceTracking !== null
                ? formatPythAmount(pythBoughtSinceTracking)
                : "-"}
            </p>
            <p className="mt-2 text-xs text-[#8f88a9]">
              Since tracking started: {formattedTrackingStart}
            </p>
          </div>

          <div>
            <p className="mb-2 text-sm text-[#a8a1bf]">Total USDC Spent</p>
            <p className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              {latestPoint ? formatUsd(latestPoint.totalUsdcSpent) : "-"}
            </p>
          </div>

          <div>
            <p className="mb-2 text-sm text-[#a8a1bf]">Average Buy Price</p>
            <p className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              {latestPoint && latestPoint.avgBuyPriceUsd > 0
                ? formatUsdPerPyth(latestPoint.avgBuyPriceUsd)
                : "-"}
            </p>
          </div>
        </div>

        <div className="flex min-w-0 flex-col p-6 lg:min-h-0">
          <CardHeader className="flex-row items-start justify-between space-y-0 px-0 pb-4 pt-0">
            <div>
              <CardTitle className="text-2xl text-white sm:text-3xl">
                Total PYTH Bought over time
              </CardTitle>
              <CardDescription className="mt-1 text-[#a8a1bf]">
                {lastUpdated
                  ? `Updated ${new Date(lastUpdated).toLocaleString()}`
                  : "Waiting for first snapshot"}
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent className="mt-2 min-w-0 px-0 pb-0 lg:mt-0 lg:flex lg:min-h-0 lg:flex-1 lg:flex-col">
            {!rawHistory ? (
              <div className="flex h-[260px] items-center justify-center text-[#a8a1bf] sm:h-[320px] lg:h-full">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Loading history...
              </div>
            ) : chartData.length === 0 ? (
              <div className="flex h-[260px] items-center justify-center text-sm text-[#a8a1bf] sm:h-[320px] lg:h-full">
                No buyback snapshots yet. Wait for the buyback cron to populate
                data.
              </div>
            ) : (
              <div className="h-[260px] w-full min-w-0 sm:h-[320px] lg:h-full">
                <ChartContainer
                  className="!block h-full w-full min-w-0 aspect-auto"
                  config={{
                    totalPythBought: {
                      label: "PYTH Bought",
                      color: "#22d3ee",
                    },
                  }}
                >
                  <AreaChart
                    data={chartData}
                    margin={{ left: 0, right: 10, top: 10, bottom: 6 }}
                  >
                    <defs>
                      <linearGradient
                        id="pythBoughtFill"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
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
                      tick={{ fill: "#94a3b8", fontSize: 12 }}
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
                      width={96}
                      domain={[firstValue ?? "dataMin", "dataMax"]}
                      tick={{ fill: "#94a3b8", fontSize: 12 }}
                      tickFormatter={(value) => Number(value).toLocaleString()}
                    />
                    <ChartTooltip
                      content={
                        <ChartTooltipContent
                          formatter={(value) =>
                            `${Number(value).toLocaleString()} PYTH`
                          }
                          labelFormatter={(_, payload) => {
                            const timestampMs =
                              payload?.[0]?.payload?.timestampMs;
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
                      fill="url(#pythBoughtFill)"
                      strokeWidth={4}
                      dot={false}
                      activeDot={{ r: 4, fill: "var(--color-totalPythBought)" }}
                    />
                  </AreaChart>
                </ChartContainer>
              </div>
            )}
          </CardContent>
        </div>
      </div>
    </div>
  );
}
