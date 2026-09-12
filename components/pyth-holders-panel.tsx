"use client";

import { useEffect, useState } from "react";
import { usePaginatedQuery, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { ChartContainer, ChartTooltip } from "@/components/ui/chart";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";

const DAY = 86_400_000;
const number = new Intl.NumberFormat("en-US");
export function PythHoldersPanel() {
  const [period, setPeriod] = useState<"30D" | "90D" | "ALL">("30D");
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()),60_000); return () => clearInterval(timer); },[]);
  const since = period === "ALL" ? "0000-01-01" : new Date(now - (period === "30D" ? 29 : 89) * DAY).toISOString().slice(0,10);
  const latest = useQuery(api.pythHolders.latest, {});
  const { results, status, loadMore } = usePaginatedQuery(api.pythHolders.history, {since}, {initialNumItems:366});
  useEffect(() => { if (status === "CanLoadMore") loadMore(366); },[status,loadMore]);
  const ready = status === "Exhausted";
  const first = results[0];
  const last = results.at(-1);
  const change = ready && results.length >= 2 && last && first ? last.holders-first.holders : null;
  const chart = results.flatMap((row,i) => {
    const time = Date.parse(`${row.date}T00:00:00Z`);
    const point = {time,holders:row.holders};
    // Break the line at missed days without inventing holder values.
    return i > 0 && time-Date.parse(`${results[i-1].date}T00:00:00Z`) > DAY
      ? [{time:time-DAY,holders:null},point] : [point];
  });
  const stale = latest && now-latest.collectedAt > 36*60*60*1000;
  return <section className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.025] p-5 sm:p-6" aria-labelledby="holder-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="holder-title" className="text-sm font-medium text-white/80">PYTH Holders</h2>
          <p className="mt-1 text-xs text-white/60">Native token owners · Daily at 03:00 UTC</p>
          <p className="mt-3 text-4xl font-medium tracking-tight tabular-nums text-white sm:text-5xl">{latest ? number.format(latest.holders) : "—"}</p>
          <p className="mt-3 text-xs text-white/70">{latest === undefined ? "Loading collection status…" : latest ? `Last collected ${new Date(latest.collectedAt).toLocaleString("en-GB",{timeZone:"UTC"})} UTC` : "Awaiting the first daily collection"}</p>
          {stale && <p role="status" className="mt-2 text-sm text-amber-300">Collection is overdue. Showing the last successful snapshot.</p>}
        </div>
        <div className="flex gap-1 rounded-xl border border-white/15 p-1" aria-label="History period">
          {(["30D","90D","ALL"] as const).map(value=><button key={value} type="button" aria-pressed={period===value} onClick={()=>setPeriod(value)} className={`rounded-lg px-3 py-2 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-cyan-300 ${period===value ? "bg-white/15 text-white" : "text-white/70 hover:bg-white/5"}`}>{value}</button>)}
        </div>
      </div>
      <p className="mt-5 min-h-10 text-xs leading-relaxed text-white/80">{change !== null && first ? <><span className={change>=0 ? "text-cyan-300" : "text-rose-300"}>{change>0?"+":""}{number.format(change)} holders ({change>0?"+":""}{(100*change/first.holders).toFixed(2)}%)</span> · across available {period === "ALL" ? "history" : period+" history"}</> : ready ? "Period change will appear after two daily collections." : "Loading history…"}</p>
      {ready && chart.length === 0 ? <div className="flex mt-4 h-60 items-center justify-center text-center text-sm text-white/65">{latest ? "No snapshots in this period." : "Your history starts with the first successful collection. No earlier data is backfilled."}</div> :
        <ChartContainer config={{holders:{label:"PYTH Holders",color:"#67e8f9"}}} className="mt-4 h-60 w-full aspect-auto">
          <LineChart accessibilityLayer data={chart} margin={{left:0,right:8,top:12,bottom:8}}>
            <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.1)" />
            <XAxis dataKey="time" type="number" domain={["dataMin","dataMax"]} scale="time" tickFormatter={t=>new Date(t).toLocaleDateString("en-GB",{timeZone:"UTC",day:"numeric",month:"short"})} tickLine={false} axisLine={false} minTickGap={35} />
            <YAxis domain={["auto","auto"]} allowDecimals={false} tickFormatter={n=>number.format(n)} tickLine={false} axisLine={false} width={66} />
            <ChartTooltip content={({active,payload,label})=>active && payload?.[0]?.value != null ? <div className="rounded-xl border border-white/20 bg-[#241b35] p-3 text-sm text-white"><p>{new Date(Number(label)).toLocaleDateString("en-GB",{timeZone:"UTC",year:"numeric",month:"short",day:"numeric"})} UTC</p><p className="mt-1 text-cyan-300">{number.format(Number(payload[0].value))} holders</p></div> : null} />
            <Line type="linear" dataKey="holders" stroke="#67e8f9" strokeWidth={2} dot={{r:3}} connectNulls={false} isAnimationActive={false} />
          </LineChart>
        </ChartContainer>}
    </section>;
}
