"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatPythAmount } from "@/lib/sells/format";

type TimeWindow = "7d" | "30d" | "all";

const COLORS = {
  shrimp: "#6366f1",
  dolphin: "#f59e0b",
  whale: "#ef4444",
};

const TIER_EMOJI: Record<string, string> = {
  shrimp: "🦐",
  dolphin: "🐬",
  whale: "🐋",
};

const WINDOW_OPTIONS: { value: TimeWindow; label: string }[] = [
  { value: "30d", label: "30d" },
  { value: "7d", label: "7d" },
  { value: "all", label: "All-time" },
];

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
    pct: totalEvents > 0 ? `${(d.value / totalEvents) * 100}%` : "0%",
    pctDisplay: totalEvents > 0 ? `${Math.round((d.value / totalEvents) * 100)}%` : "0%",
  }));
  const volumeDataWithPct = volumeData.map((d) => ({
    ...d,
    pct: totalVolume > 0 ? `${(d.value / totalVolume) * 100}%` : "0%",
    pctDisplay: totalVolume > 0 ? `${Math.round((d.value / totalVolume) * 100)}%` : "0%",
  }));

  return (
    <Card className="rounded-[32px] border-white/10 bg-[linear-gradient(148deg,rgba(255,255,255,0.06)_0%,rgba(255,255,255,0.02)_100%)] py-0 shadow-2xl backdrop-blur-xl ring-1 ring-white/5 overflow-hidden">
      {/* Decorative top glow */}
      <div className="pointer-events-none absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
      
      <CardHeader className="px-7 pt-7 pb-4 sm:px-8 relative z-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-lg font-bold text-white tracking-tight">
            Sell Pressure Analytics
          </CardTitle>
          <div className="flex gap-1 rounded-xl bg-black/40 p-1 ring-1 ring-white/10 backdrop-blur-md">
            {WINDOW_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setTimeWindow(opt.value)}
                aria-pressed={timeWindow === opt.value}
                className={`rounded-lg px-4 py-1.5 text-xs font-semibold transition-all duration-300 ${
                  timeWindow === opt.value
                    ? "bg-white/20 text-white shadow-[0_2px_10px_rgba(255,255,255,0.1)] ring-1 ring-white/20"
                    : "text-[#a8a1bf] hover:bg-white/10 hover:text-white"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>

      <CardContent className="px-7 pb-8 sm:px-8 relative z-10">
        {isLoading ? (
          <div className="flex flex-col gap-8 animate-pulse">
            <div className="space-y-4">
              <div className="h-4 w-1/3 rounded bg-white/10" />
              <div className="h-6 w-full rounded-full bg-white/5" />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-28 rounded-2xl bg-white/5" />
              ))}
            </div>
          </div>
        ) : !hasData ? (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white/5 text-3xl ring-1 ring-white/10">📊</div>
            <p className="text-center text-base font-medium text-white/80">
              No data yet for this window.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-10">
            {/* Visual Distribution Bars */}
            <div className="grid gap-8 lg:grid-cols-2">
              {/* Volume Distribution Bar */}
              <div className="flex flex-col gap-3">
                <div className="flex items-end justify-between px-1">
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-[#a8a1bf]">Volume Distribution</h3>
                    <p className="mt-1 flex items-baseline gap-2">
                      <span className="text-2xl font-bold tracking-tight text-white">{formatPythAmount(totalVolume)}</span>
                      <span className="text-sm text-white/50">PYTH</span>
                    </p>
                  </div>
                </div>
                <div className="flex h-6 w-full overflow-hidden rounded-full bg-black/40 p-1 ring-1 ring-white/10 shadow-inner">
                  {volumeDataWithPct.map((d) => (
                    <div
                      key={d.name}
                      style={{ width: d.pct, backgroundColor: d.color }}
                      className="group relative h-full cursor-pointer transition-all duration-500 hover:brightness-125 hover:shadow-[0_0_15px_rgba(255,255,255,0.3)] first:rounded-l-full last:rounded-r-full"
                    >
                      <div className="absolute inset-x-0 -top-9 hidden justify-center group-hover:flex z-10">
                        <div className="whitespace-nowrap rounded-md bg-black/80 px-2.5 py-1 text-[11px] font-medium text-white shadow-xl ring-1 ring-white/20 backdrop-blur-md">
                          {d.pctDisplay}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Event Distribution Bar */}
              <div className="flex flex-col gap-3">
                <div className="flex items-end justify-between px-1">
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-[#a8a1bf]">Event Distribution</h3>
                    <p className="mt-1 flex items-baseline gap-2">
                      <span className="text-2xl font-bold tracking-tight text-white">{totalEvents}</span>
                      <span className="text-sm text-white/50">Trades</span>
                    </p>
                  </div>
                </div>
                <div className="flex h-6 w-full overflow-hidden rounded-full bg-black/40 p-1 ring-1 ring-white/10 shadow-inner">
                  {eventDataWithPct.map((d) => (
                    <div
                      key={d.name}
                      style={{ width: d.pct, backgroundColor: d.color }}
                      className="group relative h-full cursor-pointer transition-all duration-500 hover:brightness-125 hover:shadow-[0_0_15px_rgba(255,255,255,0.3)] first:rounded-l-full last:rounded-r-full"
                    >
                      <div className="absolute inset-x-0 -top-9 hidden justify-center group-hover:flex z-10">
                        <div className="whitespace-nowrap rounded-md bg-black/80 px-2.5 py-1 text-[11px] font-medium text-white shadow-xl ring-1 ring-white/20 backdrop-blur-md">
                          {d.pctDisplay}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Tier Stats Cards */}
            <div className="grid gap-4 sm:grid-cols-3">
              {(["shrimp", "dolphin", "whale"] as const).map((tier) => {
                const vol = data ? data.pythVolume[tier] : 0;
                const ev = data ? data.eventCount[tier] : 0;
                const volPct = volumeDataWithPct.find((d) => d.name === tier)?.pctDisplay || "0%";
                const evPct = eventDataWithPct.find((d) => d.name === tier)?.pctDisplay || "0%";
                
                return (
                  <div key={tier} className="group relative flex flex-col gap-4 overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.04] to-black/20 p-5 transition-all duration-300 hover:-translate-y-1 hover:border-white/20 hover:shadow-[0_10px_40px_-10px_rgba(0,0,0,0.5)]">
                    {/* Background Glow */}
                    <div 
                      className="absolute -right-10 -top-10 h-32 w-32 rounded-full opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-20"
                      style={{ backgroundColor: COLORS[tier] }}
                    />
                    
                    <div className="relative flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div 
                          className="flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-sm ring-1 ring-white/10 shadow-inner"
                          style={{ boxShadow: `inset 0 0 15px ${COLORS[tier]}30` }}
                        >
                          {TIER_EMOJI[tier]}
                        </div>
                        <span className="text-base font-bold capitalize tracking-tight text-white">{tier}</span>
                      </div>
                      <div 
                        className="h-2.5 w-2.5 rounded-full shadow-[0_0_10px_rgba(255,255,255,0.3)] transition-transform duration-300 group-hover:scale-125" 
                        style={{ backgroundColor: COLORS[tier] }} 
                      />
                    </div>
                    
                    <div className="relative grid grid-cols-2 gap-4 rounded-xl bg-black/30 p-3 ring-1 ring-white/5 backdrop-blur-sm">
                      <div className="flex flex-col">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-[#a8a1bf]">Volume</p>
                        <p className="mt-1 flex items-baseline gap-1.5">
                          <span className="text-[15px] font-bold text-white shadow-white/10 drop-shadow-sm">{formatPythAmount(vol)}</span>
                          <span className="text-[10px] text-white/50">{volPct}</span>
                        </p>
                      </div>
                      <div className="flex flex-col border-l border-white/10 pl-4">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-[#a8a1bf]">Events</p>
                        <p className="mt-1 flex items-baseline gap-1.5">
                          <span className="text-[15px] font-bold text-white shadow-white/10 drop-shadow-sm">{ev}</span>
                          <span className="text-[10px] text-white/50">{evPct}</span>
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
