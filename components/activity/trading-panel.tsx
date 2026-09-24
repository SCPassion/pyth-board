"use client";
import { routerLabel } from "@/lib/tracker/routers/registry";
import { useEffect, useState } from "react";
import { usePaginatedQuery, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ArrowUpDown,
  ExternalLink,
  Activity,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  WINDOWS,
  PRODUCTS,
  tokenName,
  type Window,
} from "@/lib/tracker/config";
import { addTotals, emptyTotals, units, type Totals } from "@/lib/tracker/analytics";
import type { Trade, Product } from "@/lib/tracker/types";
import { TradingMethodology } from "./trading-methodology";
const format = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });
const compact = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 2,
});
const short = (s: string) => `${s.slice(0, 5)}…${s.slice(-5)}`;
const date = (t: number) =>
  new Date(t).toLocaleString("en-GB", {
    timeZone: "UTC",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
const dayDate = (t: number) =>
  new Date(t).toLocaleDateString("en-GB", {
    timeZone: "UTC",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
const panel = "rounded-2xl border border-white/10 bg-white/[0.025] p-5 sm:p-6";
const LIQUIDITY_BOT = "MfDuWeqSHEqTFVYZ7LoexgAK9dxk7cy4DFJWjWMGVWa";
const productLabel = (p: Product) =>
  p === "UNKNOWN_JUPITER"
    ? "Unclassified Jupiter"
    : p[0] + p.slice(1).toLowerCase();
export function TradingPanel() {
  const [window, setWindow] = useState<Window>("24h");
  const [to, setTo] = useState(() => Math.floor(Date.now() / 60000) * 60000);
  const [side, setSide] = useState<"BUY" | "SELL" | "">("");
  const [product, setProduct] = useState<Product | "">("");
  const [tradeView, setTradeView] = useState<"all" | "withoutBot">("all");
  const [selected, setSelected] = useState<Trade | null>(null);
  useEffect(() => {
    const timer = setInterval(
      () => setTo(Math.floor(Date.now() / 60000) * 60000),
      60000,
    );
    return () => clearInterval(timer);
  }, []);
  const health = useQuery(api.trackerQueries.health, {});
  const overview = useQuery(api.trackerQueries.overview, { window, to });
  const botOverview = useQuery(
    api.trackerQueries.ownerOverview,
    tradeView === "withoutBot" ? { owner: LIQUIDITY_BOT, window, to } : "skip",
  );
  const rankings = useQuery(api.trackerQueries.rankings, {
    window,
    to,
    ...(tradeView === "withoutBot" ? { excludeOwner: LIQUIDITY_BOT } : {}),
  });
  const from = window === "since"
    ? (health?.activationTime ?? to - WINDOWS["24h"])
    : to - WINDOWS[window];
  const { results, status, loadMore } = usePaginatedQuery(
    api.trackerQueries.recent,
    { from, to, ...(side ? { side } : {}), ...(product ? { product } : {}) },
    { initialNumItems: 20 },
  );
  const active = health?.activationTime != null;
  const adjusted = tradeView === "withoutBot";
  const summary = overview && (!adjusted || botOverview?.complete)
    ? adjusted
      ? addTotals(overview.summary, botOverview!.summary, -1)
      : overview.summary
    : undefined;
  const count = summary ? summary.buyCount + summary.sellCount : 0;
  const delayed = !!(
    health?.enabled &&
    health.oldestPendingAt &&
    to - health.oldestPendingAt > 180000
  );
  const webhookSilent = !!(
    health?.enabled &&
    (!health.lastWebhookAt || to - health.lastWebhookAt > 600000)
  );
  const showNumbers = active && overview?.complete && (!adjusted || botOverview?.complete);
  const chartDaily = window === "since" && to - (overview?.from ?? from) > WINDOWS["30d"];
  const botSeries = new Map(botOverview?.series.map((point) => [point.time, point]));
  const chartData = (overview && (!adjusted || botOverview?.complete) ? overview.series : []).map((point) => {
    const totals = adjusted
      ? addTotals(point, botSeries.get(point.time) ?? emptyTotals(), -1)
      : point;
    return { time: point.time, buy: units(totals.buyRaw), sell: -units(totals.sellRaw) };
  }) ?? [];
  const chartExtent = Math.max(
    1,
    ...chartData.flatMap((point) => [point.buy, -point.sell]),
  );
  const metrics = [
    {
      label: "PYTH bought",
      value: showNumbers ? compact.format(units(summary!.buyRaw)) : "—",
      icon: ArrowDownLeft,
      color: "text-cyan-200",
    },
    {
      label: "PYTH sold",
      value: showNumbers ? compact.format(units(summary!.sellRaw)) : "—",
      icon: ArrowUpRight,
      color: "text-rose-300",
    },
    {
      label: "Net PYTH flow",
      value: showNumbers
        ? compact.format(
            units(
              (BigInt(summary!.buyRaw) - BigInt(summary!.sellRaw)).toString(),
            ),
          )
        : "—",
      icon: ArrowUpDown,
      color: "text-white",
    },
    {
      label: "USD volume",
      value:
        showNumbers && summary!.valuedCount
          ? `$${compact.format(summary!.buyUsd + summary!.sellUsd)}`
          : "—",
      icon: Activity,
      color: "text-violet-200",
    },
  ];
  return (
    <div className="space-y-7">
      <div className="flex flex-wrap items-end justify-between gap-5 border-b border-white/10 pb-5">
        <div>
          <p className="font-data text-[10px] uppercase tracking-[0.24em] text-cyan-300/80">Observed executions</p>
          <h2 className="mt-2 font-display text-2xl italic text-white sm:text-3xl">PYTH trading</h2>
          <p className="mt-2 text-sm text-white/60">
            Verified buys and sells received by the indexer.
          </p>
          <a href="#activity-methodology" className="mt-2 inline-block text-xs text-cyan-200 underline decoration-cyan-200/40 underline-offset-4 hover:text-cyan-100">
            See supported routers and pools
          </a>
        </div>
        <div
          className="flex flex-wrap gap-1 rounded-xl border border-white/15 bg-white/[0.025] p-1"
          aria-label="Trading period"
        >
          {[...Object.keys(WINDOWS), "since"].map((w) => (
            <button
              key={w}
              onClick={() => setWindow(w as Window)}
              aria-pressed={window === w}
              disabled={w === "since" && !active}
              className={`rounded-lg px-3 py-2 text-xs font-medium focus-visible:outline-2 focus-visible:outline-cyan-300 disabled:cursor-not-allowed disabled:opacity-40 ${window === w ? "bg-white/15 text-white" : "text-white/65 hover:bg-white/5"}`}
            >
              {w === "since" ? "Since start" : w}
            </button>
          ))}
        </div>
      </div>
      <section
        aria-label="Trading data status"
        className="flex flex-wrap items-center gap-x-5 gap-y-2 border-l-2 border-cyan-300/50 bg-white/[0.025] px-4 py-3 text-xs leading-relaxed text-white/65"
      >
        <p role="status" className="flex items-center gap-2 text-white">
          <span
            aria-hidden
            className={`h-2 w-2 shrink-0 rounded-full ${health?.enabled && !delayed && !webhookSilent ? "bg-cyan-300" : delayed || webhookSilent ? "bg-amber-300" : "bg-white/40"}`}
          />
          <span className="font-medium">
            {health === undefined
              ? "Loading collection status…"
              : !active
                ? "Collection not started"
                : !health.enabled
                  ? "Collection paused"
                  : delayed
                    ? "Processing delayed"
                    : webhookSilent
                      ? "Webhook delivery quiet"
                      : "Collection active"}
          </span>
          {health !== undefined && (
            <span className="text-white/55">
              {!active
                ? "No trade history yet."
                : !health.enabled
                  ? "Stored trades only."
                  : delayed
                    ? "Queue over three minutes behind."
                    : webhookSilent
                      ? "No webhook in 10 minutes."
                      : "Processing new deliveries."}
            </span>
          )}
        </p>
        {health?.activationTime && (
          <p>History starts {date(health.activationTime)} UTC.</p>
        )}
        {active && health?.activationTime && health.activationTime > from && (
          <p>Earlier trades in this period are not included.</p>
        )}
      </section>
      {overview && !overview.complete && (
        <p role="status" className="text-sm text-amber-200">
          This period exceeds the current summary processing limit. Totals are
          unavailable.
        </p>
      )}
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="font-data text-[10px] uppercase tracking-[0.22em] text-white/45">Selected period</p>
          <h3 className="mt-1 text-sm font-medium text-white/85">
            {adjusted ? "Excluding identified liquidity bot" : "All observed trades"}
          </h3>
        </div>
        <div className="flex gap-1 rounded-xl border border-white/20 p-1" role="group" aria-label="Trade totals view">
          {([ ["all", "All trades"], ["withoutBot", "Excluding bot"] ] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setTradeView(value)}
              aria-pressed={tradeView === value}
              className={`rounded-lg px-3 py-2 text-xs font-medium focus-visible:outline-2 focus-visible:outline-cyan-300 ${tradeView === value ? "bg-cyan-300/20 text-cyan-100" : "text-white/65 hover:bg-white/5"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <p className="-mt-4 text-xs leading-relaxed text-white/55">
        {adjusted ? "Totals, chart, and rankings omit one attributed wallet. Recent trades still show every recorded execution." : "Totals, chart, and rankings include every recorded execution."}{" "}
        <a href={`https://solscan.io/account/${LIQUIDITY_BOT}`} target="_blank" rel="noreferrer" className="text-cyan-200 underline underline-offset-2">
          Solscan labels the wallet as Wintermute Automated Liquidity Bot.
        </a>
      </p>
      {adjusted && botOverview && !botOverview.complete && (
        <p role="status" className="text-sm text-amber-200">
          The adjusted view exceeds the current summary processing limit.
        </p>
      )}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {metrics.map((m) => (
          <div className="rounded-2xl border border-white/10 bg-white/[0.035] px-4 py-5 sm:px-5" key={m.label}>
            <div className="flex items-center justify-between gap-2 text-xs text-white/60">
              {m.label}
              <m.icon className={`h-4 w-4 ${m.color}`} />
            </div>
            <p
              className={`mt-4 font-data text-2xl font-medium tracking-tight tabular-nums sm:text-3xl ${m.color}`}
            >
              {m.value}
            </p>
          </div>
        ))}
      </div>
      <p className="-mt-3 text-xs leading-relaxed text-white/55">
        Net flow is bought PYTH minus sold PYTH in observed swap executions.
        It does not measure total market demand or changes in all holders’
        balances. The adjusted view excludes only the wallet linked above; it may
        still include other liquidity providers.{" "}
        {showNumbers && count > 0 &&
          `USD valuation available for ${summary!.valuedCount} of ${count} trades.`}
      </p>
      <section className={panel}>
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-medium">Buy and sell flow</h3>
            <p className="mt-1 text-xs text-white/55">{chartDaily ? "Daily" : "Hourly"} PYTH · buys above zero, sells below</p>
          </div>
          <p className="flex gap-4 text-xs text-white/65">
            <span className="text-cyan-200">● Buys</span>
            <span className="text-rose-300">● Sells</span>
          </p>
        </div>
        {chartData.length && showNumbers ? (
          <div className="h-64 sm:h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                accessibilityLayer
                data={chartData}
                stackOffset="sign"
              >
                <defs>
                  <linearGradient id="activityBuyFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#67e8f9" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#67e8f9" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="activitySellFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#fda4af" stopOpacity={0.02} />
                    <stop offset="100%" stopColor="#fda4af" stopOpacity={0.3} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="rgba(255,255,255,.1)" />
                <ReferenceLine y={0} stroke="rgba(255,255,255,.55)" />
                <XAxis
                  dataKey="time"
                  tickFormatter={chartDaily ? dayDate : date}
                  minTickGap={50}
                  tick={{ fill: "#b8b4c6", fontSize: 11 }}
                />
                <YAxis
                  domain={[-chartExtent, chartExtent]}
                  tickFormatter={(n) => compact.format(Number(n))}
                  tick={{ fill: "#b8b4c6", fontSize: 11 }}
                />
                <Tooltip
                  labelFormatter={(v) => (chartDaily ? dayDate : date)(Number(v))}
                  formatter={(value, name) => [
                    `${format.format(Math.abs(Number(value)))} PYTH`,
                    name,
                  ]}
                  contentStyle={{
                    background: "#241b35",
                    border: "1px solid #777",
                    borderRadius: 12,
                  }}
                />
                <Area
                  name="Bought PYTH"
                  dataKey="buy"
                  stackId="pyth-volume"
                  type="linear"
                  stroke="#67e8f9"
                  strokeWidth={2}
                  fill="url(#activityBuyFill)"
                  isAnimationActive={false}
                />
                <Area
                  name="Sold PYTH"
                  dataKey="sell"
                  stackId="pyth-volume"
                  type="linear"
                  stroke="#fda4af"
                  strokeWidth={2}
                  fill="url(#activitySellFill)"
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <Empty
            text={
              overview
                ? overview.complete
                  ? adjusted && botOverview === undefined
                    ? "Loading adjusted trading volume…"
                    : "Executed trading volume will appear here as trades are collected."
                  : "This period exceeds the current summary processing limit."
                : "Loading trading volume…"
            }
          />
        )}
      </section>
      <section className={panel}>
        <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
          <h3 className="text-sm font-medium">Recent trades</h3>
          <div className="flex gap-2">
            <select
              aria-label="Trade side"
              value={side}
              onChange={(e) => setSide(e.target.value as typeof side)}
              className="rounded-lg border border-white/25 bg-[#241b35] px-3 py-2 text-xs"
            >
              <option value="">All sides</option>
              <option value="BUY">Buys</option>
              <option value="SELL">Sells</option>
            </select>
            <select
              aria-label="Execution product"
              value={product}
              onChange={(e) => setProduct(e.target.value as typeof product)}
              className="max-w-44 rounded-lg border border-white/25 bg-[#241b35] px-3 py-2 text-xs"
            >
              <option value="">All products</option>
              {PRODUCTS.map((p) => (
                <option key={p} value={p}>
                  {productLabel(p)}
                </option>
              ))}
            </select>
          </div>
        </div>
        {results.length ? (
          <div className="overflow-x-auto">
            <table className="w-full whitespace-nowrap text-left text-xs">
              <thead className="border-b border-white/15 text-white/60">
                <tr>
                  {[
                    "Time · UTC",
                    "Side",
                    "PYTH",
                    "Counter asset",
                    "USD",
                    "Product",
                    "Owner",
                    "Details",
                  ].map((h) => (
                    <th className="px-3 py-3 font-normal" key={h}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {results.map((t) => (
                  <tr className="border-b border-white/10" key={t.tradeId}>
                    <td className="px-3 py-4 text-white/70">
                      {date(t.blockTime)}
                    </td>
                    <td
                      className={`px-3 py-4 ${t.side === "BUY" ? "text-cyan-200" : "text-rose-300"}`}
                    >
                      {t.side}
                    </td>
                    <td className="px-3 py-4 tabular-nums">
                      {format.format(units(t.pythAmountRaw))}
                    </td>
                    <td className="px-3 py-4">
                      {format.format(
                        units(t.counterAmountRaw, t.counterDecimals),
                      )}{" "}
                      {tokenName(t.counterMint)}
                    </td>
                    <td className="px-3 py-4">
                      {t.usdValue === null
                        ? "—"
                        : `$${format.format(t.usdValue)}`}
                    </td>
                    <td className="px-3 py-4">
                      {routerLabel(t.router)} · {productLabel(t.product)}
                    </td>
                    <td className="px-3 py-4">
                      {t.owner ? (
                        <div className="flex items-center gap-2">
                          <a
                            href={`https://solscan.io/account/${t.owner}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-cyan-200"
                          >
                            {short(t.owner)}
                          </a>
                          {t.owner === LIQUIDITY_BOT && (
                            <span className="rounded border border-cyan-200/30 px-1.5 py-0.5 text-[10px] text-cyan-100" title="Solscan-labeled Wintermute Automated Liquidity Bot">
                              Bot
                            </span>
                          )}
                        </div>
                      ) : (
                        "Unresolved"
                      )}
                    </td>
                    <td className="px-3 py-4">
                      <button
                        onClick={() => setSelected(t)}
                        className="text-cyan-200 underline underline-offset-4"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            text={
              status === "LoadingFirstPage"
                ? "Loading trades…"
                : active
                  ? "No matching trades in this period."
                  : "No trading history yet."
            }
          />
        )}
        {status === "CanLoadMore" && (
          <Button
            variant="outline"
            className="mt-5"
            onClick={() => loadMore(20)}
          >
            Load more trades
          </Button>
        )}
        {status === "LoadingMore" && (
          <p className="mt-4 text-xs text-white/65">Loading more trades…</p>
        )}
      </section>
      <div className="grid gap-5 lg:grid-cols-2">
        <Ranking
          title="Top net buyers"
          rows={rankings?.buyers}
          complete={rankings?.complete}
        />
        <Ranking
          title="Top net sellers"
          rows={rankings?.sellers}
          complete={rankings?.complete}
        />
      </div>
      <TradingMethodology />
      <Dialog
        open={!!selected}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto border-white/25 bg-[#241b35] text-white sm:max-w-2xl">
          <DialogTitle>Execution details</DialogTitle>
          <DialogDescription className="text-white/65">
            Economic trade, routing, and ownership evidence.
          </DialogDescription>
          {selected && (
            <div className="space-y-4 text-sm">
              <p className="text-lg">
                {routerLabel(selected.router)} · {selected.side}{" "}
                {format.format(units(selected.pythAmountRaw))} PYTH
              </p>
              <a
                className="inline-flex items-center gap-2 text-cyan-200"
                href={`https://solscan.io/tx/${selected.signature}`}
                target="_blank"
                rel="noreferrer"
              >
                View transaction <ExternalLink className="h-3 w-3" />
              </a>
              <p className="break-all text-xs text-white/60">
                {selected.tradeId}
              </p>
              <p>
                Owner: {selected.owner ?? "Unresolved"}
                <br />
                Owner confidence: {selected.ownerConfidence}
                <br />
                Execution confidence: {selected.classificationConfidence}
              </p>
              <p className="break-all text-white/70">
                Execution authority:{" "}
                {selected.executionAuthority ?? "Unavailable"}
                <br />
                Order: {selected.orderKey ?? "Unavailable"}
              </p>
              <h4 className="font-medium">Route legs</h4>
              {selected.routeLegs.length ? (
                selected.routeLegs.map((r, i) => (
                  <p key={i}>
                    {i + 1}. {tokenName(r.inputMint)} →{" "}
                    {tokenName(r.outputMint)}{" "}
                    <span className="text-white/60">
                      {r.dexName ?? r.dexProgramId ?? "Venue unresolved"}
                    </span>
                  </p>
                ))
              ) : (
                <p className="text-white/60">Route details unavailable.</p>
              )}
              <p className="text-xs text-white/60">
                Valuation: {selected.priceSource ?? "Unavailable"}
                {selected.priceTimestamp
                  ? ` · ${date(selected.priceTimestamp)} UTC`
                  : ""}
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
function Empty({ text }: { text: string }) {
  return (
    <div className="flex min-h-44 items-center justify-center text-center text-sm text-white/60">
      {text}
    </div>
  );
}
function Ranking({
  title,
  rows,
  complete,
}: {
  title: string;
  rows?: ({ owner: string } & Totals)[];
  complete?: boolean;
}) {
  return (
    <section className={panel}>
      <h3 className="mb-5 text-sm font-medium">{title}</h3>
      {complete === false ? (
        <p className="text-sm text-amber-200">
          Rankings unavailable for this period’s data volume.
        </p>
      ) : rows?.length ? (
        rows.map((r, i) => (
          <div className="border-b border-white/10 py-3" key={r.owner}>
            <div className="flex justify-between gap-3 text-sm">
              <a
                href={`https://solscan.io/account/${r.owner}`}
                target="_blank"
                rel="noreferrer"
                className="text-cyan-200"
              >
                {i + 1}. {short(r.owner)}
              </a>
              <span className="tabular-nums">
                {compact.format(
                  units((BigInt(r.buyRaw) - BigInt(r.sellRaw)).toString()),
                )}
              </span>
            </div>
            <p className="mt-1 text-xs text-white/55">
              Bought {compact.format(units(r.buyRaw))} · Sold{" "}
              {compact.format(units(r.sellRaw))} · {r.buyCount + r.sellCount}{" "}
              trades
            </p>
          </div>
        ))
      ) : (
        <p className="text-sm text-white/60">
          {rows ? "No attributed wallets in this period." : "Loading rankings…"}
        </p>
      )}
      <p className="mt-5 text-xs text-white/55">
        Net PYTH · high / medium confidence owners only.
      </p>
    </section>
  );
}
