"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { usePaginatedQuery, useQuery } from "convex/react";
import { ArrowUpRight, Check, Info } from "lucide-react";
import { CartesianGrid, Line, LineChart, ReferenceLine, XAxis, YAxis } from "recharts";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { ChartContainer, ChartTooltip } from "@/components/ui/chart";
import { IsolatedSnapshotDot } from "@/components/isolated-snapshot-dot";
import { PriceFeedCountCharts } from "@/components/price-feed-count-charts";
import { isolatedSnapshotTimes } from "@/lib/growth/chartHistory";
import {
  buildPriceFeedChart, buildPriceFeedChangeChart, PRICE_FEED_DAY_MS, PRICE_FEED_SERIES, PRICE_FEED_STATUSES,
  priceFeedVisibleScale, totalPriceFeeds,
  type PriceFeedSnapshot, type PriceFeedSeries,
} from "@/lib/growth/priceFeeds";

const number = new Intl.NumberFormat("en-US");
const signedNumber = new Intl.NumberFormat("en-US", { signDisplay: "exceptZero" });
const periods = { "30D": 30, "90D": 90, "1Y": 365, ALL: null } as const;
const series = {
  stable: { label: "Stable", color: "#67e8f9", description: "Live feeds. Stable describes the feed's lifecycle, not whether its price fluctuates." },
  comingSoon: { label: "Coming soon", color: "#fbbf24", description: "Announced feeds that have not started publishing prices yet." },
  inactive: { label: "Inactive", color: "#c4b5fd", description: "Retired or expired feeds that remain in the catalog." },
  total: { label: "Total listed", color: "#86efac", description: "All catalog feeds: stable + coming soon + inactive. Includes every status, even when its individual line is hidden." },
};
const utcDate = (time: number) => new Date(time).toLocaleDateString("en-GB", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" });

const seriesCount = (row: PriceFeedSnapshot, key: PriceFeedSeries) => key === "total" ? totalPriceFeeds(row) : row[key];

function StatusHint({ status }: { status: PriceFeedSeries }) {
  const hintId = useId();
  const [open, setOpen] = useState(false);
  const alignment = status === "stable" ? "left-0" : status === "inactive" || status === "total" ? "right-0" : "left-1/2 -translate-x-1/2";

  return (
    <div className="pointer-events-none absolute inset-x-0 top-3 flex justify-end"
      onPointerEnter={event => { if (event.pointerType === "mouse") setOpen(true); }}
      onPointerLeave={event => { if (!event.currentTarget.contains(document.activeElement)) setOpen(false); }}>
      <button type="button" aria-label={`About ${series[status].label.toLowerCase()} feeds`}
        aria-describedby={open ? hintId : undefined}
        className="pointer-events-auto flex size-7 shrink-0 items-center justify-center rounded-full text-white/50 hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-cyan-300"
        onFocus={() => setOpen(true)} onBlur={() => setOpen(false)} onClick={() => setOpen(true)}
        onKeyDown={event => { if (event.key === "Escape") { setOpen(false); event.stopPropagation(); } }}>
        <Info className="size-3.5" aria-hidden="true" />
      </button>
      {open && <span id={hintId} role="tooltip"
        className={`pointer-events-auto absolute top-full z-20 w-64 max-w-[calc(100vw-3rem)] pt-1 ${alignment}`}>
        <span className="block rounded-xl border border-white/20 bg-[#241b35] px-3 py-2 text-xs leading-relaxed text-white/85 shadow-xl">{series[status].description}</span>
      </span>}
    </div>
  );
}

export function PriceFeedsPanel({ compact = false, samples }: { compact?: boolean; samples?: PriceFeedSnapshot[] }) {
  const titleId = useId();
  const [period, setPeriod] = useState<keyof typeof periods>(samples ? "90D" : "30D");
  const [visible, setVisible] = useState<PriceFeedSeries[]>([...PRICE_FEED_SERIES]);
  const [view, setView] = useState<"change" | "counts">("change");
  const changeView = !compact && view === "change";
  const availableSeries = changeView ? PRICE_FEED_STATUSES : PRICE_FEED_SERIES;
  const chartKeys: readonly PriceFeedSeries[] = compact ? ["total"] : visible.filter(key => availableSeries.some(option => option === key));
  const chartSeries = compact ? { ...series, total: { ...series.total, color: series.stable.color } } : series;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);
  const days = periods[period];
  const since = days === null ? "0000-01-01" : new Date(now - (days - 1) * PRICE_FEED_DAY_MS).toISOString().slice(0, 10);
  const liveLatest = useQuery(api.pythPriceFeeds.latest, samples ? "skip" : {});
  const { results: liveResults, status, loadMore } = usePaginatedQuery(api.pythPriceFeeds.history, samples ? "skip" : { since }, { initialNumItems: 366 });
  useEffect(() => { if (status === "CanLoadMore") loadMore(366); }, [status, loadMore]);
  const latest = samples ? samples.at(-1) : liveLatest;
  const results = useMemo(() => samples ? samples.filter(row => row.date >= since) : liveResults, [samples, since, liveResults]);
  const ready = !!samples || status === "Exhausted";
  const chart = useMemo(() => changeView ? buildPriceFeedChangeChart(results) : buildPriceFeedChart(results), [results, changeView]);
  const isolatedTimes = useMemo(() => isolatedSnapshotTimes(results), [results]);
  const first = results[0];
  const last = results.at(-1);
  const includesTotal = chartKeys.includes("total");
  const displayedCount = (row: PriceFeedSnapshot) => includesTotal ? totalPriceFeeds(row) : chartKeys.reduce((sum, key) => sum + seriesCount(row, key), 0);
  const includesAllFeeds = includesTotal || PRICE_FEED_STATUSES.every(key => chartKeys.includes(key));
  const change = ready && first && last && results.length >= 2 && chartKeys.length > 0
    ? displayedCount(last) - displayedCount(first) : null;
  const changePercent = change !== null && first && totalPriceFeeds(first) > 0
    ? (change / totalPriceFeeds(first)) * 100 : null;
  const stale = latest && now - latest.collectedAt > 36 * 60 * 60_000;
  const yScale = priceFeedVisibleScale(chart, chartKeys, changeView ? "change" : "counts");

  const historyChart = !ready ? (
    <div
      className={`flex items-center justify-center rounded-xl bg-white/[0.02] text-sm text-white/70 ${compact ? "h-[180px]" : "mt-4 h-32"}`}
      role="status"
    >
      Loading daily snapshots…
    </div>
  ) : chart.length === 0 || chartKeys.length === 0 ? (
    <div
      className={`flex items-center justify-center text-center text-sm leading-relaxed text-white/70 ${compact ? "h-[180px]" : "mt-4 h-32"}`}
    >
      {chartKeys.length === 0
        ? "Enable a series above to show its history."
        : latest
          ? "No snapshots in this period."
          : "History begins with the first successful daily collection."}
    </div>
  ) : !compact && !changeView ? (
    <PriceFeedCountCharts snapshots={results} visibleKeys={chartKeys} config={series} />
  ) : (
    <ChartContainer
      config={chartSeries}
      className={`${compact ? "min-h-[180px] shrink-0" : "mt-4"} w-full aspect-auto`}
      style={{ height: compact ? 180 : results.length < 2 ? 160 : 240 }}
      aria-label={
        compact
          ? "Total listed price feeds by UTC date, with a zoomed vertical scale"
          : changeView ? "Change in price-feed counts since the first snapshot, scaled to visible series" : "Daily price-feed counts, with a zoomed scale for visible series"
      }
    >
      <LineChart
        accessibilityLayer
        data={chart}
        margin={{ left: 0, right: 12, top: 12, bottom: 8 }}
      >
        <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.12)" />
        <XAxis
          dataKey="time"
          type="number"
          domain={["dataMin", "dataMax"]}
          scale="time"
          tick={{ fill: "#cbd5e1", fontSize: 12, style: { fill: "#cbd5e1" } }}
          tickFormatter={(time) =>
            new Date(time).toLocaleDateString("en-GB", {
              timeZone: "UTC",
              day: "numeric",
              month: "short",
            })
          }
          tickLine={false}
          axisLine={false}
          minTickGap={35}
        />
        <YAxis
          domain={yScale.domain}
          ticks={yScale.ticks}
          allowDecimals={false}
          tickCount={5}
          tick={{ fill: "#cbd5e1", fontSize: 12, style: { fill: "#cbd5e1" } }}
          tickFormatter={(value) => (changeView ? signedNumber : number).format(value)}
          tickLine={false}
          axisLine={false}
          width={60}
        />
        {changeView && <ReferenceLine y={0} stroke="rgba(255,255,255,0.4)" strokeDasharray="4 4" />}
        <ChartTooltip
          content={({ active, payload, label }) =>
            active && payload?.some((item) => item.value != null) ? (
              <div className="rounded-xl border border-white/25 bg-[#241b35] p-3 text-xs text-white shadow-lg">
                <p className="mb-2 text-white/75">
                  {utcDate(Number(label))} · UTC
                </p>
                {payload
                  .filter((item) => item.value != null)
                  .map((item) => (
                    <p
                      key={String(item.dataKey)}
                      className="mt-1 flex justify-between gap-6"
                      style={{ color: item.color }}
                    >
                      <span>{item.name}</span>
                      <span className="font-medium tabular-nums">
                        {changeView ? <>
                          <span className="mr-2 text-white/65">{number.format(item.payload.counts[item.dataKey as PriceFeedSeries])} total</span>{" "}
                          {signedNumber.format(Number(item.value))} {Math.abs(Number(item.value)) === 1 ? "feed" : "feeds"}
                        </> : number.format(Number(item.value))}
                      </span>
                    </p>
                  ))}
              </div>
            ) : null
          }
        />
        {chartKeys.map((key) => (
          <Line
            key={key}
            type="linear"
            dataKey={key}
            name={series[key].label}
            stroke={chartSeries[key].color}
            strokeWidth={key === "total" ? 3 : 2.5}
            dot={
              compact || results.length <= 31 ? (
                { r: 2.5, fill: chartSeries[key].color, stroke: "#241b35", strokeWidth: 1.5 }
              ) : isolatedTimes.size ? (
                <IsolatedSnapshotDot times={isolatedTimes} />
              ) : (
                false
              )
            }
            activeDot={{ r: 5 }}
            connectNulls={false}
            isAnimationActive={false}
          />
        ))}
      </LineChart>
    </ChartContainer>
  );

  if (compact) {
    return (
      <section
        className="flex min-w-0 flex-col gap-5"
        aria-labelledby={titleId}
      >
        <div>
          <p className="font-data text-[11px] uppercase tracking-[0.25em] text-cyan-300/60">
            Network growth · 30D
          </p>
          <h3
            id={titleId}
            className="font-display mt-1 text-xl text-white sm:text-2xl"
          >
            Price feeds
          </h3>
        </div>
        <div className="min-h-[108px] border-t border-white/8 pt-4">
          <p className="text-xs text-[#a8a1bf]">Total listed feeds</p>
          <div className="mt-1 flex flex-wrap items-end justify-between gap-x-3 gap-y-1">
            <p
              className="font-data text-3xl font-medium tabular-nums text-white"
              title={
                latest
                  ? `Collected ${new Date(latest.collectedAt).toUTCString()}`
                  : undefined
              }
            >
              {latest ? number.format(totalPriceFeeds(latest)) : "—"}
            </p>
            {change !== null && first && last && (
              <div className="pb-0.5 text-right text-[10px] leading-relaxed" title={`${utcDate(Date.parse(`${first.date}T00:00:00Z`))} – ${utcDate(Date.parse(`${last.date}T00:00:00Z`))} · UTC`}>
                <p className={`font-data tabular-nums ${change > 0 ? "text-cyan-200" : change < 0 ? "text-rose-300" : "text-[#a8a1bf]"}`}>
                  {change === 0 ? "No net change" : <>{change > 0 ? "+" : ""}{number.format(change)} feeds{changePercent !== null && <> ({change > 0 ? "+" : ""}{changePercent.toLocaleString("en-US", { maximumFractionDigits: 2 })}%)</>}</>}
                </p>
                <p className="text-[#a8a1bf]">since {new Date(`${first.date}T00:00:00Z`).toLocaleDateString("en-GB", { timeZone: "UTC", day: "numeric", month: "short" })}</p>
              </div>
            )}
          </div>
          <dl className="mt-2 grid grid-cols-3 gap-2 text-[10px]">
            {PRICE_FEED_STATUSES.map((key) => (
              <div key={key} className="min-w-0">
                <dt className="text-[#a8a1bf]">{series[key].label}</dt>
                <dd
                  className="font-data mt-0.5 tabular-nums"
                  style={{ color: series[key].color }}
                >
                  {latest ? number.format(latest[key]) : "—"}
                </dd>
              </div>
            ))}
          </dl>
        </div>
        <div>
          {ready && chart.length > 0 && (
            <div className="mb-1 flex items-center justify-between gap-2 text-[10px] text-[#a8a1bf]">
              <span>Daily totals · UTC</span>
              <span>Zoomed scale</span>
            </div>
          )}
          {historyChart}
        </div>
        {stale && (
          <p role="status" className="text-xs text-amber-300">
            Collection is overdue. Showing the last successful snapshot.
          </p>
        )}
      </section>
    );
  }

  return (
    <section className="min-w-0 rounded-2xl border border-white/15 bg-white/[0.025] p-5 sm:p-6" aria-labelledby={titleId}>
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div>
          <h3 id={titleId} className="text-sm font-medium text-white/85">{compact ? "Total listed price feeds" : "Total listed feeds"}</h3>
          <div className="mt-2 flex flex-wrap items-baseline gap-3">
            <p className="text-4xl font-medium tracking-tight tabular-nums text-white sm:text-5xl">{latest ? number.format(totalPriceFeeds(latest)) : "—"}</p>
            <span className="text-sm text-white/65">across all three statuses</span>
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
        <div className={`mt-4 grid gap-4 ${changeView ? "grid-cols-3" : "grid-cols-2 lg:grid-cols-4"}`} role="group" aria-label="Price feed chart series">
          {availableSeries.map(key => {
            const selected = visible.includes(key);
            return (
              <div key={key} className="relative min-w-0">
              <Button variant="ghost" aria-pressed={selected}
                aria-label={`${series[key].label}: ${latest ? number.format(seriesCount(latest, key)) : "unavailable"}. ${selected ? "Hide" : "Show"} series`}
                onClick={() => setVisible(current => current.includes(key) ? current.filter(value => value !== key) : [...current, key])}
                className={`h-auto w-full min-w-0 flex-col items-start gap-2 rounded-none border-b-2 px-0 py-3 text-left focus-visible:ring-cyan-300 hover:bg-white/5 ${selected ? "" : "opacity-60"}`}
                style={{ borderColor: selected ? series[key].color : "rgba(255,255,255,0.2)" }}>
                <span className="flex min-h-8 min-w-0 items-center gap-2 pr-7 sm:min-h-7">
                  <span className="flex size-4 shrink-0 items-center justify-center rounded border" style={{ borderColor: series[key].color, color: series[key].color }}>
                    {selected && <Check className="size-3.5" aria-hidden="true" />}
                  </span>
                  <span className="whitespace-normal text-xs sm:text-sm" style={{ color: series[key].color }}>{series[key].label}</span>
                </span>
                {changeView && <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="text-2xl font-medium tabular-nums text-white">{latest ? number.format(seriesCount(latest, key)) : "—"}</span>
                  {ready && first && last && results.length >= 2 && <span className="font-data text-xs tabular-nums" style={{ color: series[key].color }}>
                    {signedNumber.format(seriesCount(last, key) - seriesCount(first, key))} {Math.abs(seriesCount(last, key) - seriesCount(first, key)) === 1 ? "feed" : "feeds"}
                  </span>}
                </span>}
              </Button>
              <StatusHint status={key} />
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs leading-relaxed text-white/70" aria-live="polite">
        <p>{change !== null && first && last ? <>
          <span className={change >= 0 ? "text-cyan-200" : "text-rose-300"}>{change > 0 ? "+" : ""}{number.format(change)} {includesAllFeeds ? "listed" : "selected"} {Math.abs(change) === 1 ? "feed" : "feeds"}</span>
          {" · "}{utcDate(Date.parse(`${first.date}T00:00:00Z`))} – {utcDate(Date.parse(`${last.date}T00:00:00Z`))}
        </> : ready ? "Trend changes appear after two daily snapshots." : "Loading history…"}</p>
        <div className="flex gap-1 rounded-xl border border-white/20 p-1" role="group" aria-label="Price feed chart view">
          {(["change", "counts"] as const).map(value => <Button
            key={value} size="sm" variant="ghost" aria-pressed={view === value} onClick={() => setView(value)}
            className={`h-7 rounded-lg px-3 text-xs focus-visible:ring-cyan-300 ${view === value ? "bg-white/15 text-white" : "text-white/70 hover:bg-white/10 hover:text-white"}`}>
            {value === "change" ? "Change" : "Counts"}
          </Button>)}
        </div>
      </div>

      <p className="mt-3 text-xs text-white/60">
        {changeView
          ? first ? `Change in feeds since ${utcDate(Date.parse(`${first.date}T00:00:00Z`))} · each series starts at 0` : "Change in feeds · each series starts at 0"
          : "Each series has its own count scale · Charts share the same dates"}
        {changeView && " · Scale follows visible series"}
      </p>
      {historyChart}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-white/15 pt-4 text-xs leading-relaxed text-white/65">
        <p title={!samples && latest ? new Date(latest.collectedAt).toUTCString() : undefined}>{samples ? "Sample data · fictional daily snapshots" : latest === undefined ? "Loading collection status…" : latest ? `Collected ${new Date(latest.collectedAt).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "UTC" })} UTC` : "Awaiting the first collection"}</p>
        {!samples && <a href="https://app.pyth.com/explore/all" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-white/80 hover:text-cyan-200 focus-visible:outline-2 focus-visible:outline-cyan-300">Source: Pyth Explore <ArrowUpRight className="size-3" aria-hidden="true" /></a>}
      </div>
      {stale && <p role="status" className="mt-2 text-sm text-amber-300">Collection is overdue. Showing the last successful snapshot.</p>}
      {!compact && <details className="mt-3 text-xs leading-relaxed text-white/65">
        <summary className="cursor-pointer rounded focus-visible:outline-2 focus-visible:outline-cyan-300">About these counts</summary>
        <p className="mt-2">{samples ? "These fictional counts demonstrate the chart after 90 daily snapshots. They are generated for this preview and are not stored in the database." : "Collected daily at 04:15 UTC. Total listed = stable + coming soon + inactive. History starts with the first collection, with gaps for missed days."}</p>
        <dl className="mt-3 space-y-2">
          {PRICE_FEED_STATUSES.map(key => <div key={key}><dt className="inline font-medium" style={{ color: series[key].color }}>{series[key].label}: </dt><dd className="inline">{series[key].description}</dd></div>)}
        </dl>
        <a href="https://docs.pyth.network/price-feeds/pro/symbology-reference#pricing--data-quality" target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1 rounded text-white/80 hover:text-cyan-200 focus-visible:outline-2 focus-visible:outline-cyan-300">Pyth&apos;s status definitions <ArrowUpRight className="size-3" aria-hidden="true" /></a>
      </details>}
    </section>
  );
}
