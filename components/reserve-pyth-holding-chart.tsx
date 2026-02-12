"use client";

import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Loader2 } from "lucide-react";

export function ReservePythHoldingChart() {
  const [minutes, setMinutes] = useState(180);

  const rawHistory = useQuery(api.reserveSnapshots.getPythHoldingHistory, {
    minutes,
  });

  const chartData = useMemo(() => {
    if (!rawHistory) return [];
    return rawHistory.map((point) => ({
      timestampMs: point.timestampMs,
      minuteBucketMs: point.minuteBucketMs,
      totalPythHeld: Number(point.totalPythHeld.toFixed(2)),
    }));
  }, [rawHistory]);

  const latestValue = chartData.at(-1)?.totalPythHeld ?? null;
  const firstValue = chartData.at(0)?.totalPythHeld ?? null;
  const changeValue =
    latestValue !== null && firstValue !== null
      ? latestValue - firstValue
      : null;
  const changePct =
    changeValue !== null && firstValue && firstValue > 0
      ? (changeValue / firstValue) * 100
      : null;
  const averageValue =
    chartData.length > 0
      ? chartData.reduce((sum, point) => sum + point.totalPythHeld, 0) /
        chartData.length
      : null;
  const lastUpdated = chartData.at(-1)?.timestampMs;

  return (
    <div className="space-y-5 min-h-[calc(100vh-240px)]">
      <Card className="bg-[#2a2f3e] border-gray-700 min-h-[calc(100vh-360px)] h-[calc(100vh-360px)] flex flex-col overflow-hidden">
        <div className="grid h-full min-h-0 grid-cols-1 lg:grid-cols-[320px_1fr]">
          <div className="border-b lg:border-b-0 lg:border-r border-gray-700 p-6 space-y-6">
            <div>
              <p className="text-gray-400 text-sm mb-2">
                Current Reserve Size (PYTH)
              </p>
              <p className="text-white text-4xl font-semibold tracking-tight">
                {latestValue !== null ? latestValue.toLocaleString() : "-"}
              </p>
            </div>
            <div className="h-px bg-gray-700" />
            <div>
              <p className="text-gray-400 text-sm mb-2">Window Change</p>
              <p
                className={`text-3xl font-semibold ${
                  (changeValue ?? 0) >= 0 ? "text-purple-300" : "text-red-300"
                }`}
              >
                {changeValue !== null
                  ? `${changeValue >= 0 ? "+" : ""}${changeValue.toLocaleString()}`
                  : "-"}
              </p>
              <p className="text-gray-400 text-sm">
                {changePct !== null
                  ? `${changePct >= 0 ? "+" : ""}${changePct.toFixed(2)}%`
                  : "-"}
              </p>
            </div>
            <div>
              <p className="text-gray-400 text-sm mb-2">Average Holdings</p>
              <p className="text-white text-2xl font-semibold">
                {averageValue !== null ? averageValue.toLocaleString() : "-"}
              </p>
            </div>
          </div>

          <div className="min-h-0 flex flex-col p-6">
            <CardHeader className="px-0 pt-0 pb-4 flex-row items-start justify-between space-y-0">
              <div>
                <CardTitle className="text-white text-3xl">
                  Reserve Activity
                </CardTitle>
                <CardDescription className="text-gray-400 mt-1">
                  {lastUpdated
                    ? `Updated ${new Date(lastUpdated).toLocaleString()}`
                    : "Waiting for first snapshot"}
                </CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  variant={minutes === 60 ? "default" : "outline"}
                  className={
                    minutes === 60
                      ? "bg-purple-600 hover:bg-purple-700"
                      : "border-gray-600 text-gray-200 hover:bg-[#374151]"
                  }
                  onClick={() => setMinutes(60)}
                >
                  1h
                </Button>
                <Button
                  size="sm"
                  variant={minutes === 180 ? "default" : "outline"}
                  className={
                    minutes === 180
                      ? "bg-purple-600 hover:bg-purple-700"
                      : "border-gray-600 text-gray-200 hover:bg-[#374151]"
                  }
                  onClick={() => setMinutes(180)}
                >
                  3h
                </Button>
                <Button
                  size="sm"
                  variant={minutes === 1440 ? "default" : "outline"}
                  className={
                    minutes === 1440
                      ? "bg-purple-600 hover:bg-purple-700"
                      : "border-gray-600 text-gray-200 hover:bg-[#374151]"
                  }
                  onClick={() => setMinutes(1440)}
                >
                  24h
                </Button>
              </div>
            </CardHeader>

            <CardContent className="px-0 pb-0 flex-1 min-h-0 flex flex-col">
              <div className="flex items-center gap-2 mb-3">
                <Badge
                  variant="outline"
                  className="border-gray-600 text-gray-300"
                >
                  {chartData.length} snapshots
                </Badge>
                {latestValue !== null ? (
                  <Badge
                    variant="outline"
                    className="border-purple-600 text-purple-200 bg-purple-500/10"
                  >
                    Latest: {latestValue.toLocaleString()} PYTH
                  </Badge>
                ) : null}
              </div>

              {!rawHistory ? (
                <div className="flex-1 min-h-0 flex items-center justify-center text-gray-400">
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  Loading Convex history...
                </div>
              ) : chartData.length === 0 ? (
                <div className="flex-1 min-h-0 flex items-center justify-center text-gray-400 text-sm">
                  No snapshots yet. Wait for the hourly cron to populate data.
                </div>
              ) : (
                <ChartContainer
                  className="h-full w-full aspect-auto"
                  config={{
                    totalPythHeld: {
                      label: "Current Holdings (in PYTH)",
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
                      tickLine={false}
                      axisLine={false}
                      minTickGap={24}
                      tick={{ fill: "#94a3b8", fontSize: 12 }}
                      tickFormatter={(value) =>
                        new Date(value).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      }
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      width={96}
                      tick={{ fill: "#94a3b8", fontSize: 12 }}
                      tickFormatter={(value) => Number(value).toLocaleString()}
                    />
                    <ChartTooltip
                      content={
                        <ChartTooltipContent
                          formatter={(value) => [
                            `${Number(value).toLocaleString()} PYTH`,
                            "Current Holdings",
                          ]}
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
              )}
            </CardContent>
          </div>
        </div>
      </Card>
    </div>
  );
}
