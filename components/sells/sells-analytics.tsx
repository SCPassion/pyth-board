"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatPythAmount } from "@/lib/sells/format";

type TimeWindow = "7d" | "30d" | "all";

const COLORS = {
  shrimp: "#6366f1",
  dolphin: "#f59e0b",
  whale: "#ef4444",
};

const WINDOW_OPTIONS: { value: TimeWindow; label: string }[] = [
  { value: "30d", label: "30d" },
  { value: "7d", label: "7d" },
  { value: "all", label: "All-time" },
];

function CustomTooltip({
  active,
  payload,
  formatter,
}: {
  active?: boolean;
  payload?: { name: string; value: number; payload: { pct: string } }[];
  formatter: (value: number) => string;
}) {
  if (!active || !payload?.length) return null;
  const { name, value, payload: p } = payload[0];
  return (
    <div className="rounded-xl border border-white/10 bg-[#1e1830] px-3 py-2 text-xs">
      <p className="font-semibold capitalize text-white">{name}</p>
      <p className="text-[#a8a1bf]">
        {formatter(value)} ({p.pct})
      </p>
    </div>
  );
}

export function SellsAnalytics() {
  const [timeWindow, setTimeWindow] = useState<TimeWindow>("30d");
  const data = useQuery(api.sells.getSellsAnalytics, { window: timeWindow });

  const isLoading = data === undefined;
  const hasData =
    data &&
    (data.eventCount.shrimp + data.eventCount.dolphin + data.eventCount.whale > 0);

  const eventData = data
    ? [
        { name: "shrimp", value: data.eventCount.shrimp, color: COLORS.shrimp },
        { name: "dolphin", value: data.eventCount.dolphin, color: COLORS.dolphin },
        { name: "whale", value: data.eventCount.whale, color: COLORS.whale },
      ].filter((d) => d.value > 0)
    : [];

  const volumeData = data
    ? [
        { name: "shrimp", value: data.pythVolume.shrimp, color: COLORS.shrimp },
        { name: "dolphin", value: data.pythVolume.dolphin, color: COLORS.dolphin },
        { name: "whale", value: data.pythVolume.whale, color: COLORS.whale },
      ].filter((d) => d.value > 0)
    : [];

  const totalEvents = eventData.reduce((s, d) => s + d.value, 0);
  const totalVolume = volumeData.reduce((s, d) => s + d.value, 0);

  const eventDataWithPct = eventData.map((d) => ({
    ...d,
    pct: totalEvents > 0 ? `${Math.round((d.value / totalEvents) * 100)}%` : "0%",
  }));
  const volumeDataWithPct = volumeData.map((d) => ({
    ...d,
    pct: totalVolume > 0 ? `${Math.round((d.value / totalVolume) * 100)}%` : "0%",
  }));

  return (
    <Card className="rounded-[28px] border-white/10 bg-[linear-gradient(148deg,rgba(255,255,255,0.06)_0%,rgba(255,255,255,0.02)_100%)] py-0 shadow-[0_20px_55px_rgba(8,5,18,0.2)]">
      <CardHeader className="px-7 pt-7 pb-3 sm:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-base font-semibold text-white">
            Sell Pressure Analytics
          </CardTitle>
          <div className="flex gap-1.5">
            {WINDOW_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setTimeWindow(opt.value)}
                aria-pressed={timeWindow === opt.value}
                className={`rounded-xl px-3 py-1 text-xs font-medium transition-colors ${
                  timeWindow === opt.value
                    ? "bg-white/15 text-white"
                    : "text-[#a8a1bf] hover:bg-white/8 hover:text-white"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-3 pt-1">
          {[
            { emoji: "🦐", label: "Shrimp", range: "< 10K PYTH", color: COLORS.shrimp },
            { emoji: "🐬", label: "Dolphin", range: "10K – 50K PYTH", color: COLORS.dolphin },
            { emoji: "🐋", label: "Whale", range: "> 50K PYTH", color: COLORS.whale },
          ].map(({ emoji, label, range, color }) => (
            <div key={label} className="flex items-center gap-1.5 text-xs text-[#a8a1bf]">
              <div className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
              <span>{emoji} <span className="font-medium text-white/80">{label}</span> {range}</span>
            </div>
          ))}
        </div>
      </CardHeader>

      <CardContent className="px-7 pb-7 sm:px-8 sm:pb-8">
        {isLoading ? (
          <div className="grid gap-6 sm:grid-cols-2">
            {[0, 1].map((i) => (
              <div key={i} className="flex flex-col items-center gap-4">
                <div className="h-[180px] w-[180px] animate-pulse rounded-full bg-white/5" />
                <div className="h-4 w-32 animate-pulse rounded bg-white/5" />
              </div>
            ))}
          </div>
        ) : !hasData ? (
          <p className="py-8 text-center text-sm text-[#a8a1bf]">
            No data yet for this window.
          </p>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2">
            {/* Left: Event Count */}
            <div className="flex flex-col items-center gap-2">
              <p className="text-xs font-medium text-[#8f88a9]">Sell Events</p>
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie
                    data={eventDataWithPct}
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={105}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {eventDataWithPct.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    content={
                      <CustomTooltip formatter={(v) => `${v} events`} />
                    }
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap justify-center gap-3 text-xs">
                {eventDataWithPct.map((d) => (
                  <div key={d.name} className="flex items-center gap-1.5">
                    <div
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: d.color }}
                    />
                    <span className="capitalize text-[#a8a1bf]">
                      {d.name} ({d.value} events · {d.pct})
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: PYTH Volume — all tiers (shrimp, dolphin, whale) */}
            <div className="flex flex-col items-center gap-2">
              <p className="text-xs font-medium text-[#8f88a9]">PYTH Volume</p>
              {volumeDataWithPct.length === 0 ? (
                <div className="flex h-[240px] flex-col items-center justify-center gap-2 text-center">
                  <p className="text-sm text-[#a8a1bf]">No sell volume yet</p>
                  <p className="text-xs text-[#6b6484]">Volume will appear once sells are tracked</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie
                      data={volumeDataWithPct}
                      cx="50%"
                      cy="50%"
                      innerRadius={70}
                      outerRadius={105}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {volumeDataWithPct.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      content={
                        <CustomTooltip
                          formatter={(v) => `${formatPythAmount(v)} PYTH`}
                        />
                      }
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
              <div className="flex flex-wrap justify-center gap-3 text-xs">
                {volumeDataWithPct.map((d) => (
                  <div key={d.name} className="flex items-center gap-1.5">
                    <div
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: d.color }}
                    />
                    <span className="capitalize text-[#a8a1bf]">
                      {d.name} ({formatPythAmount(d.value)} PYTH · {d.pct})
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
