"use client";

import { useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { SectionRule } from "@/components/section-rule";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { buildDouroRevenueSeries, buildProductRevenueSeries } from "@/lib/pyth-pro/history";
import type { ParsedDouroReport, RevenueRow } from "@/lib/pyth-pro/forum";
import { formatPythAmount, formatUsd, formatUsdPerPyth } from "@/lib/buyback/format";
import {
  ArrowUpRight,
  BarChart3,
  FileText,
  Loader2,
  Radio,
  ReceiptText,
} from "lucide-react";
import {
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

function compactUsd(value: number | null | undefined) {
  if (value === null || value === undefined) return "-";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDate(value: number) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}

function MetricCard({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: typeof BarChart3;
  label: string;
  value: string;
  detail?: string;
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
          {detail ? (
            <p className="mt-2 text-xs leading-relaxed text-[#a8a1bf]">
              {detail}
            </p>
          ) : null}
        </div>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-cyan-300/10 text-cyan-200 ring-1 ring-cyan-200/20">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

function RevenueLinesChart({
  data,
}: {
  data: ReturnType<typeof buildDouroRevenueSeries>;
}) {
  return (
    <div className="flex h-full flex-col gap-5">
      <div>
        <p className="font-data text-[11px] uppercase tracking-[0.25em] text-cyan-300/60">
          Monthly & cumulative
        </p>
        <h3 className="font-display mt-1 text-xl text-white sm:text-2xl">
          Revenue trend
        </h3>
      </div>
      <div className="aspect-[16/10] min-h-[260px] w-full">
        <ChartContainer
          className="!block h-full w-full min-w-0 aspect-auto"
          config={{
            monthlyGrossRevenueUsd: { label: "Monthly Gross", color: "#67e8f9" },
            monthlyDaoShareUsd: { label: "DAO Share", color: "#c084fc" },
            cumulativeGrossRevenueUsd: {
              label: "Cumulative Gross",
              color: "#86efac",
            },
          }}
        >
          <LineChart data={data} margin={{ left: 0, right: 10, top: 14, bottom: 6 }}>
            <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
            <XAxis
              dataKey="label"
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
            <Line
              type="monotone"
              dataKey="monthlyGrossRevenueUsd"
              name="Monthly Gross"
              stroke="var(--color-monthlyGrossRevenueUsd)"
              strokeWidth={2.5}
              dot={{ r: 3 }}
              connectNulls={false}
            />
            <Line
              type="monotone"
              dataKey="monthlyDaoShareUsd"
              name="DAO Share"
              stroke="var(--color-monthlyDaoShareUsd)"
              strokeWidth={2.5}
              dot={{ r: 3 }}
              connectNulls={false}
            />
            <Line
              type="monotone"
              dataKey="cumulativeGrossRevenueUsd"
              name="Cumulative Gross"
              stroke="var(--color-cumulativeGrossRevenueUsd)"
              strokeWidth={2.5}
              dot={{ r: 3 }}
            />
          </LineChart>
        </ChartContainer>
      </div>
    </div>
  );
}

function ProductLinesChart({
  series,
}: {
  series: ReturnType<typeof buildProductRevenueSeries>;
}) {
  return (
    <div className="flex h-full flex-col gap-5">
      <div>
        <p className="font-data text-[11px] uppercase tracking-[0.25em] text-cyan-300/60">
          Product mix
        </p>
        <h3 className="font-display mt-1 text-xl text-white sm:text-2xl">
          Product revenue lines
        </h3>
      </div>
      <div className="aspect-[16/10] min-h-[260px] w-full">
        <ChartContainer className="!block h-full w-full min-w-0 aspect-auto" config={{}}>
          <LineChart
            data={series.points}
            margin={{ left: 0, right: 10, top: 14, bottom: 6 }}
          >
            <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
            <XAxis
              dataKey="label"
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
            {series.products.map((product, index) => (
              <Line
                key={product}
                type="monotone"
                dataKey={product}
                name={product}
                stroke={PRODUCT_COLORS[index % PRODUCT_COLORS.length]}
                strokeWidth={2.5}
                dot={{ r: 3 }}
                connectNulls={false}
              />
            ))}
          </LineChart>
        </ChartContainer>
      </div>
    </div>
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

export default function PythProPage() {
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
  const productSeries = useMemo(
    () => buildProductRevenueSeries(sortedReports),
    [sortedReports]
  );
  const latestBreakdownReport = [...sortedReports]
    .reverse()
    .find((report) => report.monthlyRevenueRows.length > 0);
  const latestCumulativeRows =
    latestBreakdownReport?.cumulativeRevenueRows.length
      ? latestBreakdownReport.cumulativeRevenueRows
      : [];

  if (!reports) {
    return (
      <div className="flex min-h-[420px] items-center justify-center text-[#a8a1bf]">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Loading Pyth Pro reports...
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
              Pyth Pro &middot; Douro Labs
            </p>
            <h1 className="font-display text-3xl italic text-white sm:text-4xl lg:text-5xl">
              Pyth Pro Reports
            </h1>
            <p className="max-w-2xl text-sm leading-relaxed text-white/70 sm:text-base">
              Monthly DAO revenue distributions and product-level Pyth Pro
              revenue disclosed through the Pyth forum.
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
        <SectionRule index="01" title="Pyth Pro Summary" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            icon={ReceiptText}
            label="Latest DAO Distribution"
            value={compactUsd(latest?.distribution?.usdValue)}
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
            value={compactUsd(latest?.monthlyGrossRevenueUsd)}
            detail={latest?.reportPeriodLabel ?? latest?.title}
          />
          <MetricCard
            icon={Radio}
            label="Cumulative Gross"
            value={compactUsd(latest?.cumulativeGrossRevenueUsd)}
            detail={latest ? `through ${formatDate(latest.createdAtMs)}` : undefined}
          />
          <MetricCard
            icon={FileText}
            label="Reports Synced"
            value={String(reports.length)}
            detail={latest ? `latest synced ${formatDate(latest.syncedAtMs)}` : undefined}
          />
        </div>
      </section>

      <section className="space-y-5">
        <SectionRule index="02" title="Revenue Trends" />
        <div className="grid grid-cols-1 divide-y divide-white/10 overflow-hidden rounded-[30px] border border-white/10 bg-[linear-gradient(148deg,rgba(255,255,255,0.06)_0%,rgba(255,255,255,0.02)_100%)] shadow-[0_20px_50px_rgba(9,5,20,0.18)] xl:grid-cols-2 xl:divide-x xl:divide-y-0">
          <div className="min-w-0 p-5 sm:p-7">
            <RevenueLinesChart data={revenueSeries} />
          </div>
          <div className="min-w-0 p-5 sm:p-7">
            <ProductLinesChart series={productSeries} />
          </div>
        </div>
      </section>

      <section className="space-y-5">
        <SectionRule index="03" title="Revenue Breakdown" />
        {latestBreakdownReport ? (
          <div className="space-y-5">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="font-display text-2xl text-white">
                  {latestBreakdownReport.title.replace("Pyth Pro: ", "")}
                </h2>
                <p className="text-sm text-[#a8a1bf]">
                  Product rows appear only when the source report includes them.
                </p>
              </div>
              {latestBreakdownReport.distribution?.twapUsd ? (
                <p className="font-data text-xs tabular-nums text-cyan-300/70">
                  {formatUsdPerPyth(latestBreakdownReport.distribution.twapUsd)}
                </p>
              ) : null}
            </div>
            <RevenueTable rows={latestBreakdownReport.monthlyRevenueRows} />
            {latestCumulativeRows.length > 0 ? (
              <RevenueTable rows={latestCumulativeRows} />
            ) : null}
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
        <SectionRule index="05" title="About Pyth Pro Reports" />
        <div className="grid grid-cols-1 gap-x-8 gap-y-4 text-sm leading-relaxed text-[#b4aec8] sm:text-[15px] lg:grid-cols-[1fr_1px_1fr]">
          <p>
            The sync job checks the Pyth Pro category feed by slug and fetches
            full topic bodies only when a Douro Labs report is new or its forum
            cursor changes.
          </p>
          <div className="hidden bg-white/10 lg:block" aria-hidden />
          <p>
            Revenue breakdown tables are modeled dynamically, so new product
            rows can appear in future reports without changing the dashboard
            structure.
          </p>
        </div>
      </section>
    </div>
  );
}
