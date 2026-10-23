"use client";

import { useEffect, useId, useState } from "react";
import { useQuery } from "convex/react";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { api } from "@/convex/_generated/api";
import { ChartContainer, ChartTooltip } from "@/components/ui/chart";
import { IsolatedSnapshotDot } from "@/components/isolated-snapshot-dot";
import { isolatedSnapshotTimes } from "@/lib/growth/chartHistory";
import { formatHolderTokens, holderHistoryChart, holderHistoryDomain, type HolderHistory } from "@/lib/growth/holderHistory";
import type { HolderPeriod } from "@/lib/growth/holderRankings";

const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 2 });
const shortDate = (time: number) => new Date(time).toLocaleDateString("en-GB", { timeZone: "UTC", day: "numeric", month: "short" });
const snapshotTime = (time: number) => new Date(time).toLocaleString("en-GB", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

export function PythHolderHistory({ owner, days }: { owner: string; days: HolderPeriod }) {
  const history = useQuery(api.pythHolderRankings.history, { owner, days });
  return <PythHolderHistoryChart history={history} days={days} />;
}

export function PythHolderHistoryChart({ history, days }: { history: HolderHistory | null | undefined; days: HolderPeriod }) {
  const titleId = useId();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);
  const chart = holderHistoryChart(history?.points ?? []);
  const recorded = chart.filter(point => point.amount !== null);
  const isolatedTimes = isolatedSnapshotTimes(recorded);
  const stale = history && now - history.collectedAt > 36 * 60 * 60 * 1000;

  return <section aria-labelledby={titleId} className="mt-5 border-t border-white/10 pt-5">
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div>
        <h4 id={titleId} className="text-sm font-medium text-white/90">PYTH holdings over time</h4>
        <p className="mt-1 text-xs text-white/60">{days === 1 ? "24 hours" : `${days} days`} · Daily snapshots · UTC</p>
      </div>
      {history && <p className={`text-xs ${stale ? "text-amber-200" : "text-white/60"}`}>
        Last collected {snapshotTime(history.collectedAt)} UTC{stale ? " · Overdue" : ""}
      </p>}
    </div>
    {history === undefined ? <div role="status" className="mt-4 flex h-60 items-center justify-center rounded-lg bg-white/[0.025] text-sm text-white/65">Loading wallet history…</div>
      : !history || recorded.length === 0 ? <p role="status" className="flex h-60 items-center justify-center text-center text-sm text-white/65">No recorded balances for this wallet in the selected period.</p>
      : <>
        <ChartContainer config={{ balance: { label: "PYTH balance", color: "#67e8f9" } }} className="mt-4 h-60 w-full aspect-auto" aria-label="Daily PYTH balances for the selected wallet">
          <LineChart accessibilityLayer data={chart} margin={{ left: 0, right: 24, top: 12, bottom: 8 }}>
            <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.1)" />
            <XAxis dataKey="time" type="number" domain={["dataMin", "dataMax"]} scale="time" ticks={chart.map(point => point.time)} interval="preserveStartEnd" tickFormatter={shortDate} tick={{ fill: "#cbd5e1", fontSize: 11, style: { fill: "#cbd5e1" } }} tickLine={false} axisLine={false} minTickGap={36} />
            <YAxis dataKey="balance" domain={holderHistoryDomain} tickFormatter={value => compact.format(value)} tick={{ fill: "#cbd5e1", fontSize: 11, style: { fill: "#cbd5e1" } }} tickLine={false} axisLine={false} width={64} />
            <ChartTooltip content={({ active, payload }) => {
              const point = payload?.[0]?.payload as (typeof chart)[number] | undefined;
              if (!active || !point || point.amount === null || point.collectedAt === null) return null;
              return <div className="rounded-xl border border-white/20 bg-[#241b35] p-3 text-xs text-white shadow-xl">
                <p className="text-white/70">{snapshotTime(point.collectedAt)} UTC</p>
                <p className="mt-1 font-data text-sm tabular-nums text-cyan-200">{formatHolderTokens(point.amount)} PYTH</p>
              </div>;
            }} />
            <Line type="linear" dataKey="balance" stroke="#67e8f9" strokeWidth={2} dot={isolatedTimes.size ? <IsolatedSnapshotDot times={isolatedTimes} /> : false} activeDot={{ r: 5 }} connectNulls={false} isAnimationActive={false} />
          </LineChart>
        </ChartContainer>
        {recorded.length === 1 && <p role="status" className="mt-2 text-xs text-white/65">Only one snapshot is available. A trend will appear after more daily collections.</p>}
        <p className="mt-2 text-xs leading-relaxed text-white/55">Native PYTH balance · Missing collections and days outside the tracked top 100 appear as gaps.</p>
        <details className="mt-3 text-xs text-white/65">
          <summary className="w-fit cursor-pointer rounded py-1 focus-visible:outline-2 focus-visible:outline-cyan-300">View recorded balances</summary>
          <div className="mt-2 max-h-48 overflow-auto rounded-lg border border-white/10">
            <table className="w-full text-left tabular-nums">
              <caption className="sr-only">Recorded balances for the selected wallet. Missing dates are unavailable.</caption>
              <thead><tr className="border-b border-white/10"><th scope="col" className="px-3 py-2 font-medium">Date (UTC)</th><th scope="col" className="px-3 py-2 text-right font-medium">PYTH balance</th></tr></thead>
              <tbody>{chart.map(point => <tr key={point.date} className="border-b border-white/5 last:border-0"><th scope="row" className="whitespace-nowrap px-3 py-2 font-normal">{point.date}</th><td className="px-3 py-2 text-right">{point.amount === null ? "Unavailable" : formatHolderTokens(point.amount)}</td></tr>)}</tbody>
            </table>
          </div>
        </details>
      </>}
  </section>;
}
