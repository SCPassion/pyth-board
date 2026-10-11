"use client";

import Link from "next/link";
import { useEffect, useId, useMemo, useState } from "react";
import { usePaginatedQuery, useQuery } from "convex/react";
import { ArrowUpRight, Check } from "lucide-react";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { ChartContainer, ChartTooltip } from "@/components/ui/chart";
import {
  buildPriceFeedChart, PRICE_FEED_DAY_MS, PRICE_FEED_STATUSES, totalPriceFeeds,
  type PriceFeedSnapshot, type PriceFeedStatus,
} from "@/lib/growth/priceFeeds";

const number = new Intl.NumberFormat("en-US");
const periods = { "30D": 30, "90D": 90, "1Y": 365, ALL: null } as const;
const series = {
  stable: { label: "Stable", color: "#67e8f9", description: "Live feeds" },
  comingSoon: { label: "Coming soon", color: "#fbbf24", description: "Announced feeds" },
  inactive: { label: "Inactive", color: "#c4b5fd", description: "Inactive feeds" },
  total: { label: "Total listed", color: "#67e8f9" },
};
const utcDate = (time: number) => new Date(time).toLocaleDateString("en-GB", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" });

export function PriceFeedsPanel({ compact = false }: { compact?: boolean }) {
  const titleId = useId();
  const [period, setPeriod] = useState<keyof typeof periods>("30D");
  const [visible, setVisible] = useState<PriceFeedStatus[]>([...PRICE_FEED_STATUSES]);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);
  const days = periods[period];
  const since = days === null ? "0000-01-01" : new Date(now - (days - 1) * PRICE_FEED_DAY_MS).toISOString().slice(0, 10);
  const latest = useQuery(api.pythPriceFeeds.latest, {});
  const { results, status, loadMore } = usePaginatedQuery(api.pythPriceFeeds.history, { since }, { initialNumItems: 366 });
  useEffect(() => { if (status === "CanLoadMore") loadMore(366); }, [status, loadMore]);
  const ready = status === "Exhausted";
  const chart = useMemo(() => buildPriceFeedChart(results), [results]);
  const first = results[0];
  const last = results.at(-1);
  const displayedCount = (row: PriceFeedSnapshot) => compact ? totalPriceFeeds(row) : visible.reduce((sum, key) => sum + row[key], 0);
  const change = ready && first && last && results.length >= 2 && (compact || visible.length > 0)
    ? displayedCount(last) - displayedCount(first) : null;
  const stale = latest && now - latest.collectedAt > 36 * 60 * 60_000;
  const chartKeys = compact ? (["total"] as const) : visible;

  return (
    <section className="min-w-0 rounded-2xl border border-white/15 bg-white/[0.025] p-5 sm:p-6" aria-labelledby={titleId}>
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div>
          <h2 id={titleId} className="text-sm font-medium text-white/85">{compact ? "Total listed price feeds" : "Price feed growth"}</h2>
          <p className="mt-1 text-xs text-white/65">Pyth Explore · Daily at 04:15 UTC</p>
          <div className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <p className="text-4xl font-medium tracking-tight tabular-nums text-white sm:text-5xl">{latest ? number.format(totalPriceFeeds(latest)) : "—"}</p>
            <span className="text-sm text-white/65">{compact ? "across all three statuses" : "total listed feeds"}</span>
          </div>
          {compact && latest && <p className="mt-2 text-sm text-cyan-200">{number.format(latest.stable)} stable · {number.format(latest.comingSoon)} coming soon · {number.format(latest.inactive)} inactive</p>}
        </div>
        <div className="flex flex-wrap gap-1 rounded-xl border border-white/20 p-1" role="group" aria-label="Price feed history period">
          {(Object.keys(periods) as (keyof typeof periods)[]).map(value => (
            <Button key={value} size="sm" variant="ghost" aria-pressed={period === value} onClick={() => setPeriod(value)}
              className={`h-8 rounded-lg px-3 text-xs focus-visible:ring-cyan-300 ${period === value ? "bg-white/15 text-white" : "text-white/70 hover:bg-white/10 hover:text-white"}`}>
              {value}
            </Button>
          ))}
        </div>
      </div>

      {!compact && (
        <div className="mt-6 grid grid-cols-1 gap-2 sm:grid-cols-3" role="group" aria-label="Price feed status series">
          {PRICE_FEED_STATUSES.map(key => {
            const selected = visible.includes(key);
            return (
              <Button key={key} variant="ghost" aria-pressed={selected}
                aria-label={`${series[key].label}: ${latest ? number.format(latest[key]) : "unavailable"}. ${selected ? "Hide" : "Show"} series`}
                onClick={() => setVisible(current => current.includes(key) ? current.filter(value => value !== key) : [...current, key])}
                className={`h-auto min-w-0 justify-between rounded-xl border px-4 py-3 text-left focus-visible:ring-cyan-300 ${selected ? "border-white/25 bg-white/[0.05] hover:bg-white/10" : "border-white/15 bg-transparent hover:bg-white/5"}`}>
                <span className="flex min-w-0 items-center gap-3">
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-md border" style={{ borderColor: series[key].color, color: series[key].color }}>
                    {selected && <Check className="size-3.5" aria-hidden="true" />}
                  </span>
                  <span><span className="block text-sm" style={{ color: series[key].color }}>{series[key].label}</span><span className="mt-1 block text-xs font-normal text-white/65">{series[key].description}</span></span>
                </span>
                <span className="text-xl font-medium tabular-nums text-white">{latest ? number.format(latest[key]) : "—"}</span>
              </Button>
            );
          })}
        </div>
      )}

      <div className="mt-5 flex min-h-10 flex-wrap items-center justify-between gap-x-4 gap-y-2 text-xs leading-relaxed text-white/70" aria-live="polite">
        <p>{change !== null && first && last ? <>
          <span className={change >= 0 ? "text-cyan-200" : "text-rose-300"}>{change > 0 ? "+" : ""}{number.format(change)} {compact || visible.length === 3 ? "listed" : "selected"} feeds</span>
          {" · "}{utcDate(Date.parse(`${first.date}T00:00:00Z`))} – {utcDate(Date.parse(`${last.date}T00:00:00Z`))}
        </> : ready ? "Trend changes appear after two daily snapshots." : "Loading history…"}</p>
        {compact && <Link href="/growth" className="inline-flex items-center gap-1 text-cyan-200 hover:text-white focus-visible:outline-2 focus-visible:outline-cyan-300">Explore feed growth <ArrowUpRight className="size-3.5" aria-hidden="true" /></Link>}
      </div>

      {!ready ? (
        <div className="mt-4 flex h-60 items-center justify-center rounded-xl bg-white/[0.02] text-sm text-white/70" role="status">Loading daily snapshots…</div>
      ) : chart.length === 0 || chartKeys.length === 0 ? (
        <div className="mt-4 flex h-60 items-center justify-center text-center text-sm leading-relaxed text-white/70">
          {chartKeys.length === 0 ? "Enable a status above to show its history." : latest ? "No snapshots in this period." : "History begins with the first successful daily collection."}
        </div>
      ) : (
        <ChartContainer config={series} className={`mt-4 w-full aspect-auto ${compact ? "h-60" : "h-72"}`} aria-label={compact ? "Total listed price feeds by UTC date" : "Daily price-feed counts for enabled statuses"}>
          <LineChart accessibilityLayer data={chart} margin={{ left: 0, right: 12, top: 12, bottom: 8 }}>
            <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.12)" />
            <XAxis dataKey="time" type="number" domain={["dataMin", "dataMax"]} scale="time" tick={{ fill: "#cbd5e1", fontSize: 12 }} tickFormatter={time => new Date(time).toLocaleDateString("en-GB", { timeZone: "UTC", day: "numeric", month: "short" })} tickLine={false} axisLine={false} minTickGap={35} />
            <YAxis domain={[0, "auto"]} allowDecimals={false} tick={{ fill: "#cbd5e1", fontSize: 12 }} tickFormatter={value => number.format(value)} tickLine={false} axisLine={false} width={60} />
            <ChartTooltip content={({ active, payload, label }) => active && payload?.some(item => item.value != null) ? (
              <div className="rounded-xl border border-white/25 bg-[#241b35] p-3 text-xs text-white shadow-lg">
                <p className="mb-2 text-white/75">{utcDate(Number(label))} · UTC</p>
                {payload.filter(item => item.value != null).map(item => <p key={String(item.dataKey)} className="mt-1 flex justify-between gap-6" style={{ color: item.color }}><span>{item.name}</span><span className="font-medium tabular-nums">{number.format(Number(item.value))}</span></p>)}
              </div>
            ) : null} />
            {chartKeys.map(key => <Line key={key} type="linear" dataKey={key} name={series[key].label} stroke={series[key].color} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} connectNulls={false} isAnimationActive={false} />)}
          </LineChart>
        </ChartContainer>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-white/15 pt-4 text-xs leading-relaxed text-white/65">
        <p>{latest === undefined ? "Loading collection status…" : latest ? `Last collected ${new Date(latest.collectedAt).toLocaleString("en-GB", { timeZone: "UTC" })} UTC` : "Awaiting the first collection"}</p>
        <a href="https://app.pyth.com/explore/all" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-white/80 hover:text-cyan-200 focus-visible:outline-2 focus-visible:outline-cyan-300">Source: Pyth Explore <ArrowUpRight className="size-3" aria-hidden="true" /></a>
      </div>
      {stale && <p role="status" className="mt-2 text-sm text-amber-300">Collection is overdue. Showing the last successful snapshot.</p>}
      {!compact && <p className="mt-3 text-xs leading-relaxed text-white/65">Total listed = stable + coming soon + inactive. Statuses follow Pyth Explore; stable means live. Counts are daily observations, with gaps for missed collections and no earlier history backfilled.</p>}
    </section>
  );
}
