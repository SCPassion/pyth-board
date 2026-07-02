"use client";

import { useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Loader2 } from "lucide-react";

const DAY_MS = 24 * 60 * 60 * 1000;

type HoldingHistoryPoint = {
  timestampMs: number;
  minuteBucketMs: number;
  totalPythHeld: number;
};

export function ReservePythHoldingChart() {
  const rawHistory = useQuery(api.reserveSnapshots.getPythHoldingHistory, {});

  const chartData = useMemo(() => {
    if (!rawHistory) return [];
    return (rawHistory as HoldingHistoryPoint[]).map((point) => ({
      timestampMs: point.timestampMs,
      minuteBucketMs: point.minuteBucketMs,
      totalPythHeld: Number(point.totalPythHeld.toFixed(2)),
    }));
  }, [rawHistory]);

  const latestValue = chartData.at(-1)?.totalPythHeld ?? null;
  const firstValue = chartData.at(0)?.totalPythHeld ?? null;
  const firstTrackedTimestampMs = chartData.at(0)?.timestampMs ?? null;
  const changeSinceTracking =
    latestValue !== null && firstValue !== null
      ? Number((latestValue - firstValue).toFixed(2))
      : null;
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
    <div className="flex h-full flex-col gap-6">
      <div>
        <p
          className={`font-data text-[11px] uppercase tracking-[0.25em] text-fuchsia-300/60`}
        >
          DAO Treasury &rarr; PYTH
        </p>
        <h3
          className={`font-display mt-1 text-xl text-white sm:text-2xl`}
        >
          DAO PYTH Holdings over time
        </h3>
        <p
          className={`font-data mt-1 text-[11px] text-[#8f88a9]`}
        >
          {lastUpdated
            ? `UPDATED ${new Date(lastUpdated).toLocaleString()}`
            : "WAITING FOR FIRST SNAPSHOT"}
        </p>
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-5 border-t border-white/8 pt-5">
        <div>
          <dt className="text-[11px] text-[#a8a1bf] sm:text-xs">
            Current Reserve Size
          </dt>
          <dd
            className={`font-data mt-1 text-lg font-medium tabular-nums text-white sm:text-xl`}
          >
            {latestValue !== null ? latestValue.toLocaleString() : "-"}
          </dd>
        </div>

        <div>
          <dt className="text-[11px] text-[#a8a1bf] sm:text-xs">
            Since Tracking
          </dt>
          <dd
            className={`font-data mt-1 text-lg font-medium tabular-nums text-white sm:text-xl`}
          >
            {changeSinceTracking !== null
              ? `${changeSinceTracking >= 0 ? "+" : ""}${changeSinceTracking.toLocaleString()}`
              : "-"}
          </dd>
          <dd className={`font-data mt-0.5 text-[10px] text-[#7d7593]`}>
            since {formattedTrackingStart}
          </dd>
        </div>
      </dl>

      <div className="min-h-0 flex-1">
        {!rawHistory ? (
          <div className="flex aspect-[16/10] max-h-[320px] min-h-[220px] items-center justify-center text-[#a8a1bf]">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Loading history...
          </div>
        ) : chartData.length === 0 ? (
          <div className="flex aspect-[16/10] max-h-[320px] min-h-[220px] items-center justify-center text-sm text-[#a8a1bf]">
            No holding snapshots yet. Wait for the reserve cron to populate
            data.
          </div>
        ) : (
          <div className="aspect-[16/10] max-h-[320px] min-h-[220px] w-full">
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
                  width={80}
                  domain={[firstValue ?? "dataMin", "dataMax"]}
                  tick={{ fill: "#94a3b8", fontSize: 11 }}
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
                  type="monotone"
                  stroke="var(--color-totalPythHeld)"
                  fill="url(#pythHoldingsFill)"
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ r: 4, fill: "var(--color-totalPythHeld)" }}
                />
              </AreaChart>
            </ChartContainer>
          </div>
        )}
      </div>
    </div>
  );
}
