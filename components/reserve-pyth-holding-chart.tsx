"use client";

import { useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  Card,
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

const DAY_MS = 24 * 60 * 60 * 1000;

interface ReservePythHoldingChartProps {
  currentPythPriceUsd: number;
}

export function ReservePythHoldingChart({
  currentPythPriceUsd,
}: ReservePythHoldingChartProps) {
  const rawHistory = useQuery(api.reserveSnapshots.getPythHoldingHistory, {});

  const chartData = useMemo(() => {
    if (!rawHistory) return [];
    return rawHistory.map((point: any) => ({
      timestampMs: point.timestampMs,
      minuteBucketMs: point.minuteBucketMs,
      totalPythHeld: Number(point.totalPythHeld.toFixed(2)),
    }));
  }, [rawHistory]);

  const latestValue = chartData.at(-1)?.totalPythHeld ?? null;
  const firstTrackedTimestampMs = chartData.at(0)?.timestampMs ?? null;
  const latestTrackedTimestampMs = chartData.at(-1)?.timestampMs ?? null;
  const earliestValue = chartData.at(0)?.totalPythHeld ?? null;
  const cumulativePurchasedSinceTracking =
    latestValue !== null && earliestValue !== null
      ? Number((latestValue - earliestValue).toFixed(2))
      : null;
  const elapsedDays =
    typeof latestTrackedTimestampMs === "number" &&
    typeof firstTrackedTimestampMs === "number" &&
    latestTrackedTimestampMs > firstTrackedTimestampMs
      ? (latestTrackedTimestampMs - firstTrackedTimestampMs) / DAY_MS
      : null;
  const averageDailyPurchased =
    cumulativePurchasedSinceTracking !== null &&
    typeof elapsedDays === "number" &&
    elapsedDays > 0
      ? Number((cumulativePurchasedSinceTracking / elapsedDays).toFixed(2))
      : null;
  const averageDailyPurchasedUsd =
    averageDailyPurchased !== null && currentPythPriceUsd > 0
      ? averageDailyPurchased * currentPythPriceUsd
      : null;
  const firstValue = chartData.at(0)?.totalPythHeld ?? null;
  const lastUpdated = chartData.at(-1)?.timestampMs;
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
    <div className="space-y-5">
      <Card className="bg-[#2a2f3e] border-gray-700 flex flex-col lg:min-h-[calc(100vh-360px)] lg:h-[calc(100vh-360px)] lg:overflow-hidden">
        <div className="grid min-h-0 grid-cols-1 lg:grid-cols-[320px_1fr] lg:h-full">
          <div className="border-b lg:border-b-0 lg:border-r border-gray-700 p-6 space-y-6">
            <div>
              <p className="text-gray-400 text-sm mb-2">
                Current Reserve Size (PYTH)
              </p>
              <p className="text-white text-3xl sm:text-4xl font-semibold tracking-tight">
                {latestValue !== null ? latestValue.toLocaleString() : "-"}
              </p>
            </div>

            <div>
              <p className="text-gray-400 text-sm mb-2">$PYTH Purchased</p>
              <p className="text-white text-2xl sm:text-3xl font-semibold tracking-tight">
                {cumulativePurchasedSinceTracking !== null
                  ? cumulativePurchasedSinceTracking.toLocaleString()
                  : "-"}
              </p>
              <p className="text-gray-500 text-xs mt-2">
                Since tracking started: {formattedTrackingStart}
              </p>
            </div>

            <div>
              <p className="text-gray-400 text-sm mb-2">
                Average Daily PYTH Purchased
              </p>
              <p className="text-white text-2xl sm:text-3xl font-semibold tracking-tight">
                {averageDailyPurchased !== null
                  ? averageDailyPurchased.toLocaleString()
                  : "-"}
              </p>
            </div>

            <div>
              <p className="text-gray-400 text-sm mb-2">
                Average Daily PYTH Purchased (USD)
              </p>
              <p className="text-white text-2xl sm:text-3xl font-semibold tracking-tight">
                {averageDailyPurchasedUsd !== null
                  ? new Intl.NumberFormat("en-US", {
                      style: "currency",
                      currency: "USD",
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    }).format(averageDailyPurchasedUsd)
                  : "-"}
              </p>
            </div>
          </div>

          <div className="flex min-w-0 flex-col p-6 lg:min-h-0">
            <CardHeader className="px-0 pt-0 pb-4 flex-row items-start justify-between space-y-0">
              <div>
                <CardTitle className="text-white text-2xl sm:text-3xl">
                  Reserve PYTH Holdings over time
                </CardTitle>
                <CardDescription className="text-gray-400 mt-1">
                  {lastUpdated
                    ? `Updated ${new Date(lastUpdated).toLocaleString()}`
                    : "Waiting for first snapshot"}
                </CardDescription>
              </div>
            </CardHeader>

            <CardContent className="mt-2 min-w-0 px-0 pb-0 lg:mt-0 lg:flex lg:min-h-0 lg:flex-1 lg:flex-col">
              {!rawHistory ? (
                <div className="h-[260px] sm:h-[320px] lg:h-full flex items-center justify-center text-gray-400">
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  Loading history...
                </div>
              ) : chartData.length === 0 ? (
                <div className="h-[260px] sm:h-[320px] lg:h-full flex items-center justify-center text-gray-400 text-sm">
                  No snapshots yet. Wait for the daily cron to populate data.
                </div>
              ) : (
                <div className="h-[260px] w-full min-w-0 sm:h-[320px] lg:h-full">
                  <ChartContainer
                    className="!block h-full w-full min-w-0 aspect-auto"
                    config={{
                      totalPythHeld: {
                        label: "PYTH",
                        color: "#a855f7",
                      },
                    }}
                  >
                    <AreaChart
                      data={chartData}
                      margin={{ left: 0, right: 10, top: 10, bottom: 6 }}
                    >
                    <defs>
                      <linearGradient
                        id="pythHoldingsFill"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="0%"
                          stopColor="var(--color-totalPythHeld)"
                          stopOpacity={0.4}
                        />
                        <stop
                          offset="55%"
                          stopColor="var(--color-totalPythHeld)"
                          stopOpacity={0.16}
                        />
                        <stop
                          offset="100%"
                          stopColor="var(--color-totalPythHeld)"
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
                        dataKey="totalPythHeld"
                        type="natural"
                        stroke="var(--color-totalPythHeld)"
                        fill="url(#pythHoldingsFill)"
                        strokeWidth={4}
                        dot={false}
                        activeDot={{ r: 4, fill: "var(--color-totalPythHeld)" }}
                      />
                    </AreaChart>
                  </ChartContainer>
                </div>
              )}
            </CardContent>
          </div>
        </div>
      </Card>
    </div>
  );
}
