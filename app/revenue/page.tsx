"use client";

import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { SectionRule } from "@/components/section-rule";
import { ChartLegend } from "@/components/chart-legend";
import { RevenueTrendChart } from "@/components/revenue-trend-chart";
import { formatCompactUsd as compactUsd } from "@/lib/buyback/format";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { buildRevenueBreakdownSections } from "@/lib/pyth-pro/breakdown";
import {
  getDefaultProductRevenueKeys,
  toggleVisibleSeries,
} from "@/lib/pyth-pro/chart-visibility";
import {
  buildDouroDistributionSeries,
  buildDouroRevenueSeries,
  buildProductRevenueSeries,
} from "@/lib/pyth-pro/history";
import type { ParsedDouroReport, RevenueRow } from "@/lib/pyth-pro/forum";
import { formatPythAmount, formatUsd, formatUsdPerPyth } from "@/lib/buyback/format";
import {
  ArrowUpRight,
  BarChart3,
  Landmark,
  Loader2,
  Radio,
  ReceiptText,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { buildRevenueSummary, toShareOfTotalPoints } from "@/lib/pyth-pro/summary";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from "recharts";

type PythProReport = ParsedDouroReport & {
  _id: string;
  _creationTime: number;
  syncedAtMs: number;
};

const PRODUCT_COLORS = [
  "#67e8f9",
  "#c084fc",
  "#86efac",
  "#fbbf24",
  "#f472b6",
  "#93c5fd",
];

// Pin known products to a color so adding a new stream never reshuffles them.
const PRODUCT_COLOR_BY_NAME: Record<string, string> = {
  "Pyth Pro": "#67e8f9",
  LaaS: "#c084fc",
  Indices: "#86efac",
  Marketplace: "#fbbf24",
};
const PINNED_COLORS = new Set(Object.values(PRODUCT_COLOR_BY_NAME));
const FALLBACK_PRODUCT_COLORS = PRODUCT_COLORS.filter(
  (color) => !PINNED_COLORS.has(color)
);

function hasProductValue(
  point: Record<string, number | string | null>,
  products: string[]
) {
  return products.some((product) => typeof point[product] === "number");
}

function formatDate(value: number) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}

function ChangePill({ changePct }: { changePct: number }) {
  const isUp = changePct >= 0;
  const Arrow = isUp ? TrendingUp : TrendingDown;
  return (
    <span
      className={`font-data inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] tabular-nums ring-1 ${
        isUp
          ? "bg-emerald-300/10 text-emerald-200 ring-emerald-200/20"
          : "bg-rose-300/10 text-rose-200 ring-rose-200/20"
      }`}
      title="Change vs. previous report"
    >
      <Arrow className="h-3 w-3" aria-hidden />
      {isUp ? "+" : ""}
      {changePct.toFixed(1)}%
      <span className="text-white/45">MoM</span>
    </span>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  detail,
  changePct,
}: {
  icon: typeof BarChart3;
  label: string;
  value: string;
  detail?: string;
  changePct?: number | null;
}) {
  return (
    <div className="rounded-[26px] border border-white/10 bg-[linear-gradient(148deg,rgba(255,255,255,0.065)_0%,rgba(255,255,255,0.025)_100%)] p-5 shadow-[0_20px_50px_rgba(9,5,20,0.18)]">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="font-data text-[11px] uppercase tracking-[0.22em] text-cyan-300/60">
            {label}
          </p>
          <p className="font-data mt-3 break-words text-2xl font-semibold tabular-nums text-white sm:text-3xl">
            {value}
          </p>
          {detail || (changePct !== null && changePct !== undefined) ? (
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs leading-relaxed text-[#a8a1bf]">
              {changePct !== null && changePct !== undefined ? (
                <ChangePill changePct={changePct} />
              ) : null}
              {detail ? <span>{detail}</span> : null}
            </div>
          ) : null}
        </div>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-cyan-300/10 text-cyan-200 ring-1 ring-cyan-200/20">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

type ProductChartView = "stacked" | "share" | "lines";

const PRODUCT_CHART_VIEWS: Array<{ key: ProductChartView; label: string }> = [
  { key: "stacked", label: "Stacked" },
  { key: "share", label: "Share" },
  { key: "lines", label: "Lines" },
];

const tooltipRow = (name: unknown, formatted: string) => (
  <div className="flex w-full items-center justify-between gap-5">
    <span className="text-[#b4aec8]">{String(name)}</span>
    <span className="font-data tabular-nums text-white">{formatted}</span>
  </div>
);

function ProductLinesChart({
  series,
}: {
  series: ReturnType<typeof buildProductRevenueSeries>;
}) {
  const defaultLineKeys = useMemo(
    () => getDefaultProductRevenueKeys(series),
    [series]
  );
  const [view, setView] = useState<ProductChartView>("stacked");
  // null = the view's default selection; set once the reader toggles a series.
  const [selectedKeys, setSelectedKeys] = useState<string[] | null>(null);
  const visibleKeys =
    selectedKeys ?? (view === "lines" ? defaultLineKeys : series.products);
  const changeView = (nextView: ProductChartView) => {
    setView(nextView);
    setSelectedKeys(null);
  };

  const isVisible = (key: string) => visibleKeys.includes(key);
  const isPrimaryAxis = (product: string) =>
    series.primaryAxisProducts.includes(product);
  const hasPrimaryAxis = series.primaryAxisProducts.some(isVisible);
  const hasSecondaryAxis = series.secondaryProducts.some(isVisible);
  const toggleSeries = (key: string) => {
    setSelectedKeys(toggleVisibleSeries(visibleKeys, key));
  };
  const unpinnedProducts = series.products.filter(
    (product) => !PRODUCT_COLOR_BY_NAME[product]
  );
  const productColor = (product: string) =>
    PRODUCT_COLOR_BY_NAME[product] ??
    FALLBACK_PRODUCT_COLORS[
      Math.max(unpinnedProducts.indexOf(product), 0) %
        FALLBACK_PRODUCT_COLORS.length
    ];
  // Bar views start at the first report that breaks revenue out by product.
  const firstProductIndex = Math.max(
    series.points.findIndex((point) => hasProductValue(point, series.products)),
    0
  );
  const barPoints = series.points.slice(firstProductIndex);
  const visibleProducts = useMemo(
    () => series.products.filter((product) => visibleKeys.includes(product)),
    [series.products, visibleKeys]
  );
  const sharePoints = useMemo(
    () => toShareOfTotalPoints(series.points, visibleProducts).slice(firstProductIndex),
    [series.points, visibleProducts, firstProductIndex]
  );
  const legendOrder =
    view === "lines"
      ? [...series.primaryAxisProducts, ...series.secondaryProducts]
      : series.products;
  const legendItems = legendOrder.map((product) => ({
    key: product,
    label: product,
    color: productColor(product),
    note:
      view === "lines"
        ? isPrimaryAxis(product)
          ? "left axis"
          : "right axis"
        : undefined,
    active: isVisible(product),
    onToggle: () => toggleSeries(product),
  }));
  const axisProps = {
    tickLine: false,
    axisLine: false,
    tick: { fill: "#8f88a9", fontSize: 11 },
  } as const;

  return (
    <div className="flex h-full flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-data text-[11px] uppercase tracking-[0.25em] text-cyan-300/60">
            Product mix
          </p>
          <h3 className="font-display mt-1 text-xl text-white sm:text-2xl">
            {view === "share" ? "Revenue share by product" : "Product revenue"}
          </h3>
        </div>
        <div
          role="group"
          aria-label="Product chart view"
          className="flex rounded-full border border-white/10 bg-white/[0.03] p-0.5"
        >
          {PRODUCT_CHART_VIEWS.map((option) => (
            <button
              key={option.key}
              type="button"
              aria-pressed={view === option.key}
              onClick={() => changeView(option.key)}
              className={`font-data rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.14em] transition-colors ${
                view === option.key
                  ? "bg-white/10 text-white"
                  : "text-[#8f88a9] hover:text-white"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
      <ChartLegend items={legendItems} />
      <div className="aspect-[16/10] min-h-[260px] w-full">
        <ChartContainer className="!block h-full w-full min-w-0 aspect-auto" config={{}}>
          {view === "lines" ? (
            <LineChart
              data={series.points}
              margin={{ left: 0, right: 10, top: 14, bottom: 6 }}
            >
              <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
              <XAxis dataKey="label" {...axisProps} />
              {hasPrimaryAxis ? (
                <YAxis
                  yAxisId="primary"
                  width={58}
                  {...axisProps}
                  tickFormatter={(value) => compactUsd(Number(value))}
                />
              ) : null}
              {hasSecondaryAxis ? (
                <YAxis
                  yAxisId="secondary"
                  orientation="right"
                  width={58}
                  {...axisProps}
                  tickFormatter={(value) => compactUsd(Number(value))}
                />
              ) : null}
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    className="border-white/10 bg-[#241b35] text-white"
                    formatter={(value, name) =>
                      tooltipRow(name, compactUsd(Number(value)))
                    }
                  />
                }
              />
              {visibleProducts.map((product) => (
                <Line
                  key={product}
                  yAxisId={isPrimaryAxis(product) ? "primary" : "secondary"}
                  type="monotone"
                  dataKey={product}
                  name={product}
                  stroke={productColor(product)}
                  strokeWidth={2.5}
                  dot={{ r: 3 }}
                  connectNulls={false}
                />
              ))}
            </LineChart>
          ) : (
            <BarChart
              data={view === "share" ? sharePoints : barPoints}
              margin={{ left: 0, right: 10, top: 14, bottom: 6 }}
            >
              <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
              <XAxis dataKey="label" {...axisProps} />
              <YAxis
                width={58}
                {...axisProps}
                domain={view === "share" ? [0, 100] : undefined}
                ticks={view === "share" ? [0, 25, 50, 75, 100] : undefined}
                tickFormatter={(value) =>
                  view === "share"
                    ? `${Number(value)}%`
                    : compactUsd(Number(value))
                }
              />
              <ChartTooltip
                cursor={{ fill: "rgba(255,255,255,0.04)" }}
                content={
                  <ChartTooltipContent
                    className="border-white/10 bg-[#241b35] text-white"
                    formatter={(value, name) =>
                      tooltipRow(
                        name,
                        view === "share"
                          ? `${Number(value).toFixed(1)}%`
                          : compactUsd(Number(value))
                      )
                    }
                  />
                }
              />
              {visibleProducts.map((product, index) => (
                <Bar
                  key={product}
                  dataKey={product}
                  name={product}
                  stackId="products"
                  fill={productColor(product)}
                  fillOpacity={0.78}
                  maxBarSize={42}
                  radius={
                    index === visibleProducts.length - 1 ? [6, 6, 0, 0] : 0
                  }
                />
              ))}
            </BarChart>
          )}
        </ChartContainer>
      </div>
    </div>
  );
}

function DistributionChart({
  data,
}: {
  data: ReturnType<typeof buildDouroDistributionSeries>;
}) {
  return (
    <div className="flex h-full flex-col gap-5">
      <div>
        <p className="font-data text-[11px] uppercase tracking-[0.25em] text-cyan-300/60">
          DAO payments
        </p>
        <h3 className="font-display mt-1 text-xl text-white sm:text-2xl">
          Distributions to DAO
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-[#a8a1bf]">
          Since{" "}
          <a
            href="https://forum.pyth.network/t/passed-co-pip-104-pyth-pro-governance-payment-currency-flexibility/2480"
            target="_blank"
            rel="noopener noreferrer"
            className="text-cyan-300 underline decoration-cyan-300/30 underline-offset-4 transition-colors hover:text-white"
          >
            CO-PIP-104
          </a>
          , DAO distributions can also be paid in PYTH tokens. DAO/operator
          splits are 60/40 for Pyth Pro subscriptions, 90/10 for Listing as a
          Service, and 60/40 for Pyth Data Marketplace.
        </p>
      </div>
      <div className="h-[190px] w-full sm:aspect-[16/5] sm:h-auto sm:min-h-[260px]">
        <ChartContainer
          className="!block h-full w-full min-w-0 aspect-auto"
          config={{
            usdValue: { label: "USD Value", color: "#86efac" },
          }}
        >
          <BarChart data={data} margin={{ left: 0, right: 0, top: 14, bottom: 6 }}>
            <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
            <XAxis
              dataKey="label"
              interval="preserveStartEnd"
              minTickGap={18}
              tickLine={false}
              axisLine={false}
              tick={{ fill: "#8f88a9", fontSize: 11 }}
            />
            <YAxis
              width={58}
              tickLine={false}
              axisLine={false}
              tick={{ fill: "#8f88a9", fontSize: 11 }}
              tickFormatter={(value) => compactUsd(Number(value))}
            />
            <ChartTooltip
              cursor={{ fill: "rgba(255,255,255,0.04)" }}
              content={
                <ChartTooltipContent
                  className="border-white/10 bg-[#241b35] text-white"
                  formatter={(value, name, item) => {
                    const point = item.payload as
                      | ReturnType<typeof buildDouroDistributionSeries>[number]
                      | undefined;
                    return (
                      <div className="grid w-full gap-1">
                        {tooltipRow(name, compactUsd(Number(value)))}
                        {point?.tokenSymbol === "PYTH" && point.tokenAmount
                          ? tooltipRow(
                              "Paid in",
                              `${formatPythAmount(point.tokenAmount)} PYTH`
                            )
                          : point?.tokenSymbol
                            ? tooltipRow("Paid in", point.tokenSymbol)
                            : null}
                      </div>
                    );
                  }}
                />
              }
            />
            <Bar
              dataKey="usdValue"
              name="USD Value"
              fill="rgba(134,239,172,0.72)"
              maxBarSize={42}
              radius={[6, 6, 0, 0]}
            />
          </BarChart>
        </ChartContainer>
      </div>
    </div>
  );
}

function DistributionTable({
  data,
}: {
  data: ReturnType<typeof buildDouroDistributionSeries>;
}) {
  const formatPaymentAmount = (
    point: ReturnType<typeof buildDouroDistributionSeries>[number]
  ) => {
    if (point.tokenSymbol === "PYTH" && point.tokenAmount) {
      return `${formatPythAmount(point.tokenAmount)} PYTH`;
    }

    if (point.tokenSymbol === "USDC") {
      return compactUsd(point.usdValue);
    }

    return "-";
  };

  const rows = [...data].reverse();

  return (
    <>
      <div className="grid gap-3 sm:hidden">
        {rows.map((point) => (
          <a
            key={`${point.timestampMs}-${point.tokenSymbol}-mobile`}
            href={point.reportUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-[22px] border border-white/10 bg-[#2b223d]/70 p-4 transition-colors hover:border-cyan-300/35"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-display text-lg text-white">
                  {point.label}
                </p>
                <p className="mt-1 text-xs uppercase tracking-[0.18em] text-cyan-300/60">
                  {point.tokenSymbol} payment
                </p>
              </div>
              <ArrowUpRight className="mt-1 h-4 w-4 shrink-0 text-[#8f88a9]" />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-[#8f88a9]">Amount</p>
                <p className="font-data mt-1 tabular-nums text-white">
                  {formatPaymentAmount(point)}
                </p>
              </div>
              <div>
                <p className="text-xs text-[#8f88a9]">USD value</p>
                <p className="font-data mt-1 tabular-nums text-white">
                  {compactUsd(point.usdValue)}
                </p>
              </div>
              <div className="col-span-2">
                <p className="text-xs text-[#8f88a9]">TWAP</p>
                <p className="font-data mt-1 tabular-nums text-cyan-300/70">
                  {point.twapUsd ? formatUsdPerPyth(point.twapUsd) : "-"}
                </p>
              </div>
            </div>
          </a>
        ))}
      </div>
      <div className="hidden overflow-hidden rounded-[26px] border border-white/10 bg-[#2b223d]/70 sm:block">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-white/10 text-[11px] uppercase tracking-[0.18em] text-cyan-300/60">
              <tr>
                <th className="px-4 py-3 font-medium">Month</th>
                <th className="px-4 py-3 font-medium">Payment Token</th>
                <th className="px-4 py-3 font-medium">Amount</th>
                <th className="px-4 py-3 font-medium">USD value</th>
                <th className="px-4 py-3 font-medium">TWAP</th>
                <th className="px-4 py-3 font-medium">Source</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/8">
              {rows.map((point) => (
                <tr key={`${point.timestampMs}-${point.tokenSymbol}`}>
                  <td className="px-4 py-3 font-medium text-white">
                    {point.label}
                  </td>
                  <td className="font-data px-4 py-3 text-[#d8d1ea]">
                    {point.tokenSymbol}
                  </td>
                  <td className="font-data px-4 py-3 tabular-nums text-[#d8d1ea]">
                    {formatPaymentAmount(point)}
                  </td>
                  <td className="font-data px-4 py-3 tabular-nums text-[#d8d1ea]">
                    {compactUsd(point.usdValue)}
                  </td>
                  <td className="font-data px-4 py-3 tabular-nums text-cyan-300/70">
                    {point.twapUsd ? formatUsdPerPyth(point.twapUsd) : "-"}
                  </td>
                  <td className="px-4 py-3">
                    <a
                      href={point.reportUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[#d8d1ea] transition-colors hover:text-white"
                    >
                      Report
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function RevenueTable({ rows }: { rows: RevenueRow[] }) {
  const visibleRows = rows.filter((row) => !row.isTotal);
  const total = rows.find((row) => row.isTotal);
  const tableRows = total ? [...visibleRows, total] : visibleRows;

  return (
    <div className="overflow-hidden rounded-[26px] border border-white/10 bg-[#2b223d]/70">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[680px] text-left text-sm">
          <thead className="border-b border-white/10 text-[11px] uppercase tracking-[0.18em] text-cyan-300/60">
            <tr>
              <th className="px-4 py-3 font-medium">Product</th>
              <th className="px-4 py-3 font-medium">Gross</th>
              <th className="px-4 py-3 font-medium">DAO Share</th>
              <th className="px-4 py-3 font-medium">Douro Labs</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/8">
            {tableRows.map((row) => (
              <tr key={`${row.product}-${row.isTotal ? "total" : "row"}`}>
                <td className="px-4 py-3 text-white">
                  {row.product}
                  {row.splitLabel ? (
                    <span className="ml-2 text-xs text-[#8f88a9]">
                      {row.splitLabel}
                    </span>
                  ) : null}
                </td>
                <td className="font-data px-4 py-3 tabular-nums text-[#d8d1ea]">
                  {row.grossRevenueUsd !== undefined
                    ? formatUsd(row.grossRevenueUsd)
                    : "-"}
                </td>
                <td className="font-data px-4 py-3 tabular-nums text-[#d8d1ea]">
                  {row.daoShareUsd !== undefined ? formatUsd(row.daoShareUsd) : "-"}
                  {row.daoSharePyth !== undefined ? (
                    <span className="ml-2 text-xs text-cyan-300/70">
                      {formatPythAmount(row.daoSharePyth)} PYTH
                    </span>
                  ) : null}
                </td>
                <td className="font-data px-4 py-3 tabular-nums text-[#d8d1ea]">
                  {row.douroLabsUsd !== undefined
                    ? formatUsd(row.douroLabsUsd)
                    : "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function RevenuePage() {
  const reports = useQuery(api.pythPro.listReports, { limit: 24 }) as
    | PythProReport[]
    | undefined;

  const sortedReports = useMemo(
    () => [...(reports ?? [])].sort((a, b) => a.createdAtMs - b.createdAtMs),
    [reports]
  );
  const latest = sortedReports.at(-1);
  const revenueSeries = useMemo(
    () => buildDouroRevenueSeries(sortedReports),
    [sortedReports]
  );
  const distributionSeries = useMemo(
    () => buildDouroDistributionSeries(sortedReports),
    [sortedReports]
  );
  const productSeries = useMemo(
    () => buildProductRevenueSeries(sortedReports),
    [sortedReports]
  );
  const summary = useMemo(
    () => buildRevenueSummary(sortedReports),
    [sortedReports]
  );
  // Month label parsed from the report title (e.g. "Oct 2026"), not the post date.
  const latestLabel = revenueSeries.at(-1)?.label;
  const breakdownOptions = useMemo(
    () =>
      sortedReports
        .map((report, index) => ({
          report,
          label: revenueSeries[index]?.label ?? report.title,
        }))
        .filter(({ report }) => report.monthlyRevenueRows.length > 0)
        .reverse(),
    [sortedReports, revenueSeries]
  );
  const [selectedBreakdownId, setSelectedBreakdownId] = useState<number | null>(
    null
  );
  const breakdownReport =
    breakdownOptions.find(({ report }) => report.topicId === selectedBreakdownId)
      ?.report ?? breakdownOptions[0]?.report;
  const breakdownSections = breakdownReport
    ? buildRevenueBreakdownSections({
        monthlyRows: breakdownReport.monthlyRevenueRows,
        cumulativeRows: breakdownReport.cumulativeRevenueRows,
        reportPeriodLabel: breakdownReport.reportPeriodLabel,
      })
    : [];

  if (!reports) {
    return (
      <div className="flex min-h-[420px] items-center justify-center text-[#a8a1bf]">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Loading revenue reports...
      </div>
    );
  }

  return (
    <div className="w-full min-w-0 space-y-10 overflow-x-hidden">
      <header className="relative border-b border-white/10 pb-7">
        <div
          aria-hidden
          className="absolute -top-1 left-0 h-px w-full bg-gradient-to-r from-cyan-400/70 via-fuchsia-400/60 to-transparent"
        />
        <div className="flex flex-col gap-6 pt-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0 space-y-2">
            <p className="font-data text-[11px] uppercase tracking-[0.32em] text-cyan-300/70">
              Revenue Streams &middot; Douro Labs
            </p>
            <h1 className="font-display text-3xl italic text-white sm:text-4xl lg:text-5xl">
              Revenue Streams
            </h1>
            <p className="max-w-2xl text-sm leading-relaxed text-white/70 sm:text-base">
              DAO revenue distributions and product-level revenue from Pyth Pro,
              LaaS, Pyth Marketplace, indices, and future streams disclosed
              through the Pyth forum.
            </p>
          </div>
          <a
            href="https://forum.pyth.network/c/pyth-pro"
            target="_blank"
            rel="noopener noreferrer"
            className="font-data inline-flex items-center gap-2 rounded-full border border-white/15 px-4 py-2 text-[11px] uppercase tracking-[0.18em] text-white/80 transition-colors hover:border-white/35 hover:text-white"
          >
            Source
            <ArrowUpRight className="h-3.5 w-3.5" />
          </a>
        </div>
      </header>

      <section className="space-y-5">
        <SectionRule index="01" title="Revenue Summary" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            icon={ReceiptText}
            label="Latest DAO Distribution"
            value={compactUsd(summary.latestDistributionUsd)}
            changePct={summary.distributionChangePct}
            detail={
              latest?.distribution?.tokenSymbol === "PYTH" &&
              latest.distribution.tokenAmount
                ? `${formatPythAmount(latest.distribution.tokenAmount)} PYTH`
                : latest?.distribution?.tokenSymbol
            }
          />
          <MetricCard
            icon={BarChart3}
            label="Latest Gross Revenue"
            value={compactUsd(summary.latestGrossRevenueUsd)}
            changePct={summary.grossRevenueChangePct}
            detail={latestLabel}
          />
          <MetricCard
            icon={Radio}
            label="Cumulative Gross"
            value={compactUsd(summary.cumulativeGrossRevenueUsd)}
            detail={latestLabel ? `through ${latestLabel}` : undefined}
          />
          <MetricCard
            icon={Landmark}
            label="Cumulative DAO Share"
            value={compactUsd(summary.cumulativeDaoShareUsd)}
            detail={
              summary.totalPythDistributed > 0
                ? `${formatPythAmount(summary.totalPythDistributed)} PYTH received`
                : latestLabel
                  ? `through ${latestLabel}`
                  : undefined
            }
          />
        </div>
      </section>

      <section className="space-y-5">
        <SectionRule index="02" title="Revenue Trends" />
        <p className="text-sm leading-relaxed text-[#a8a1bf]">
          DAO share reflects the CO-PIP-104 revenue splits across products;
          distributions may be paid in USDC or PYTH depending on the source
          report.
        </p>
        <div className="space-y-5">
          <div className="grid grid-cols-1 divide-y divide-white/10 overflow-hidden rounded-[30px] border border-white/10 bg-[linear-gradient(148deg,rgba(255,255,255,0.06)_0%,rgba(255,255,255,0.02)_100%)] shadow-[0_20px_50px_rgba(9,5,20,0.18)] xl:grid-cols-2 xl:divide-x xl:divide-y-0">
            <div className="min-w-0 p-5 sm:p-7">
              <RevenueTrendChart data={revenueSeries} />
            </div>
            <div className="min-w-0 p-5 sm:p-7">
              <ProductLinesChart series={productSeries} />
            </div>
          </div>
          <div className="overflow-hidden rounded-[30px] border border-white/10 bg-[linear-gradient(148deg,rgba(255,255,255,0.06)_0%,rgba(255,255,255,0.02)_100%)] shadow-[0_20px_50px_rgba(9,5,20,0.18)]">
            <div className="min-w-0 p-5 sm:p-7">
              {distributionSeries.length > 0 ? (
                <div className="space-y-5">
                  <DistributionChart data={distributionSeries} />
                  <DistributionTable data={distributionSeries} />
                </div>
              ) : (
                <div className="rounded-[26px] border border-white/10 bg-[#2b223d]/70 p-6 text-sm text-[#a8a1bf]">
                  No DAO distribution data has been synced yet.
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-5">
        <SectionRule index="03" title="Revenue Breakdown" />
        {breakdownReport ? (
          <div className="space-y-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div className="min-w-0">
                <h2 className="font-display text-2xl text-white">
                  <a
                    href={breakdownReport.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 transition-colors hover:text-cyan-200"
                  >
                    {breakdownReport.title.replace("Pyth Pro: ", "")}
                    <ArrowUpRight className="h-4 w-4 shrink-0 text-[#8f88a9]" />
                  </a>
                </h2>
                <p className="text-sm text-[#a8a1bf]">
                  Product rows appear only when the source report includes them.
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-3 sm:justify-end">
                {breakdownReport.distribution?.twapUsd ? (
                  <p className="font-data text-xs tabular-nums text-cyan-300/70">
                    {formatUsdPerPyth(breakdownReport.distribution.twapUsd)}
                  </p>
                ) : null}
                {breakdownOptions.length > 1 ? (
                  <label className="font-data flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-cyan-300/60">
                    Month
                    <select
                      value={breakdownReport.topicId}
                      onChange={(event) =>
                        setSelectedBreakdownId(Number(event.target.value))
                      }
                      className="rounded-full border border-white/15 bg-[#2b223d] px-3 py-1.5 text-xs normal-case tracking-normal text-white outline-none transition-colors hover:border-white/35 focus-visible:border-cyan-300/60"
                    >
                      {breakdownOptions.map(({ report, label }) => (
                        <option key={report.topicId} value={report.topicId}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
              </div>
            </div>
            <div className="space-y-5">
              {breakdownSections.map((section) => (
                <div key={section.key} className="space-y-3">
                  <div>
                    <h3 className="font-display text-xl text-white">
                      {section.title}
                    </h3>
                    <p className="text-xs text-[#8f88a9]">
                      {section.description}
                    </p>
                  </div>
                  <RevenueTable rows={section.rows} />
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="rounded-[26px] border border-white/10 bg-[#2b223d]/70 p-6 text-sm text-[#a8a1bf]">
            No product-level revenue breakdown has been synced yet.
          </div>
        )}
      </section>

      <section className="space-y-5">
        <SectionRule index="04" title="Report Archive" />
        <div className="grid gap-3">
          {[...sortedReports].reverse().map((report) => (
            <a
              key={report.topicId}
              href={report.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group grid gap-3 rounded-[24px] border border-white/10 bg-[#2b223d]/70 p-4 transition-colors hover:border-cyan-300/35 hover:bg-[#312642]/80 sm:grid-cols-[1fr_auto] sm:items-center"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-white">
                  {report.title}
                </p>
                <p className="mt-1 text-xs text-[#8f88a9]">
                  {formatDate(report.createdAtMs)}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4 text-left sm:text-right">
                <div>
                  <p className="text-[11px] text-[#8f88a9]">Distribution</p>
                  <p className="font-data tabular-nums text-[#d8d1ea]">
                    {compactUsd(report.distribution?.usdValue)}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-[#8f88a9]">Cumulative</p>
                  <p className="font-data tabular-nums text-[#d8d1ea]">
                    {compactUsd(report.cumulativeGrossRevenueUsd)}
                  </p>
                </div>
              </div>
            </a>
          ))}
        </div>
      </section>

      <section className="space-y-5 pb-2">
        <SectionRule index="05" title="About Revenue Reports" />
        <div className="grid grid-cols-1 gap-x-8 gap-y-4 text-sm leading-relaxed text-[#b4aec8] sm:text-[15px] lg:grid-cols-[1fr_1px_1fr]">
          <p>
            The sync job checks the forum category feed by slug and fetches
            full Douro Labs report bodies only when a report is new or its
            forum cursor changes.
          </p>
          <div className="hidden bg-white/10 lg:block" aria-hidden />
          <p>
            Revenue breakdown tables are modeled dynamically, so new streams
            such as marketplace fees, LaaS, indices, or future products can
            appear without changing the dashboard structure.
          </p>
        </div>
      </section>
    </div>
  );
}
