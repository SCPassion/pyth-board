"use client";

import { useState } from "react";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { ChartLegend } from "@/components/chart-legend";
import {
  getDefaultRevenueTrendKeys,
  toggleVisibleSeries,
} from "@/lib/pyth-pro/chart-visibility";
import type { DouroRevenuePoint } from "@/lib/pyth-pro/history";
import { formatCompactUsd as compactUsd } from "@/lib/buyback/format";

export function RevenueTrendChart({
  data,
  compact = false,
  isLoading = false,
}: {
  data: DouroRevenuePoint[];
  compact?: boolean;
  isLoading?: boolean;
}) {
  const [visibleKeys, setVisibleKeys] = useState(getDefaultRevenueTrendKeys);
  const latest = data.at(-1);
  const isVisible = (key: string) =>
    compact ? key === "cumulativeGrossRevenueUsd" : visibleKeys.includes(key);
  const hasMonthlyAxis =
    isVisible("monthlyGrossRevenueUsd") || isVisible("monthlyDaoShareUsd");
  const hasCumulativeAxis = isVisible("cumulativeGrossRevenueUsd");
  const toggleSeries = (key: string) => {
    setVisibleKeys((currentKeys) => toggleVisibleSeries(currentKeys, key));
  };
  const legendItems = [
    {
      key: "monthlyGrossRevenueUsd",
      label: "Monthly gross",
      color: "#67e8f9",
      note: "left axis",
      active: isVisible("monthlyGrossRevenueUsd"),
      onToggle: () => toggleSeries("monthlyGrossRevenueUsd"),
    },
    {
      key: "monthlyDaoShareUsd",
      label: "Monthly DAO share",
      color: "#c084fc",
      note: "left axis",
      active: isVisible("monthlyDaoShareUsd"),
      onToggle: () => toggleSeries("monthlyDaoShareUsd"),
    },
    {
      key: "cumulativeGrossRevenueUsd",
      label: "Cumulative gross",
      color: "#86efac",
      note: "right axis",
      active: isVisible("cumulativeGrossRevenueUsd"),
      onToggle: () => toggleSeries("cumulativeGrossRevenueUsd"),
    },
  ];

  return (
    <div className={`flex flex-col gap-5 ${compact ? "" : "h-full"}`}>
      <div>
        <p className="font-data text-[11px] uppercase tracking-[0.25em] text-cyan-300/60">
          {compact ? "Douro Labs reports" : "Monthly & cumulative"}
        </p>
        <h3 className="font-display mt-1 text-xl text-white sm:text-2xl">
          {compact ? "Revenue" : "Revenue trend"}
        </h3>
      </div>
      {compact ? (
        <div className="min-h-[108px] border-t border-white/8 pt-4">
          <p className="text-xs text-[#a8a1bf]">Cumulative gross revenue</p>
          <p className="font-data mt-1 text-3xl font-medium tabular-nums text-white">
            {compactUsd(latest?.cumulativeGrossRevenueUsd)}
          </p>
          <p className="mt-2 text-xs text-[#a8a1bf]">
            {latest
              ? `Latest report: ${latest.label}`
              : isLoading
                ? "Loading revenue reports…"
                : "Awaiting revenue reports"}
          </p>
        </div>
      ) : (
        <ChartLegend items={legendItems} />
      )}
      <div
        className={
          compact ? "h-[180px] min-h-[180px] w-full shrink-0" : "aspect-[16/10] min-h-[260px] w-full"
        }
      >
        {compact &&
        (isLoading ||
          !data.some((point) => point.cumulativeGrossRevenueUsd !== null)) ? (
          <div
            className="flex h-full items-center justify-center text-center text-sm text-[#a8a1bf]"
            role="status"
          >
            {isLoading
              ? "Loading revenue history…"
              : "No cumulative revenue data available yet."}
          </div>
        ) : (
          <ChartContainer
            className="!block h-full w-full min-w-0 aspect-auto"
            aria-label={
              compact
                ? "Cumulative gross revenue by report month in USD"
                : "Monthly and cumulative revenue in USD"
            }
            config={{
              monthlyGrossRevenueUsd: {
                label: "Monthly Gross",
                color: "#67e8f9",
              },
              monthlyDaoShareUsd: { label: "DAO Share", color: "#c084fc" },
              cumulativeGrossRevenueUsd: {
                label: "Cumulative Gross",
                color: "#86efac",
              },
            }}
          >
            <LineChart
              accessibilityLayer
              data={data}
              margin={{ left: 0, right: 0, top: 14, bottom: 6 }}
            >
              <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tick={{ fill: "#8f88a9", fontSize: 11 }}
                minTickGap={24}
              />
              {hasMonthlyAxis ? (
                <YAxis
                  yAxisId="monthly"
                  width={58}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "#8f88a9", fontSize: 11 }}
                  tickFormatter={(value) => compactUsd(Number(value))}
                />
              ) : null}
              {hasCumulativeAxis ? (
                <YAxis
                  yAxisId="cumulative"
                  orientation={compact ? "left" : "right"}
                  width={58}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "#8f88a9", fontSize: 11 }}
                  tickFormatter={(value) => compactUsd(Number(value))}
                />
              ) : null}
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    className="border-white/10 bg-[#241b35] text-white"
                    formatter={(value, name) => (
                      <div className="flex w-full items-center justify-between gap-5">
                        <span className="text-[#b4aec8]">{String(name)}</span>
                        <span className="font-data tabular-nums text-white">
                          {compactUsd(Number(value))}
                        </span>
                      </div>
                    )}
                  />
                }
              />
              {isVisible("monthlyGrossRevenueUsd") ? (
                <Line
                  yAxisId="monthly"
                  type="monotone"
                  dataKey="monthlyGrossRevenueUsd"
                  name="Monthly Gross"
                  stroke="var(--color-monthlyGrossRevenueUsd)"
                  strokeWidth={2.5}
                  dot={{ r: 3 }}
                  connectNulls={false}
                />
              ) : null}
              {isVisible("monthlyDaoShareUsd") ? (
                <Line
                  yAxisId="monthly"
                  type="monotone"
                  dataKey="monthlyDaoShareUsd"
                  name="DAO Share"
                  stroke="var(--color-monthlyDaoShareUsd)"
                  strokeWidth={2.5}
                  dot={{ r: 3 }}
                  connectNulls={false}
                />
              ) : null}
              {isVisible("cumulativeGrossRevenueUsd") ? (
                <Line
                  yAxisId="cumulative"
                  type="monotone"
                  dataKey="cumulativeGrossRevenueUsd"
                  name="Cumulative Gross"
                  stroke="var(--color-cumulativeGrossRevenueUsd)"
                  strokeWidth={2.5}
                  dot={compact ? false : { r: 3 }}
                  connectNulls={false}
                />
              ) : null}
            </LineChart>
          </ChartContainer>
        )}
      </div>
    </div>
  );
}
