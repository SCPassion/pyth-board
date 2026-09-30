"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { HOLDER_ENTITY_BY_OWNER, holderView } from "@/lib/growth/holderEntities";
import { holderBarBalances, holderBarWidths } from "@/lib/growth/holderBars";
import type { HolderPeriod } from "@/lib/growth/holderRankings";
import { AddressRankSearch } from "@/components/address-rank-search";

const integer = new Intl.NumberFormat("en-US");
function tokens(value: string, signed = false) {
  const raw = BigInt(value), absolute = raw < 0n ? -raw : raw;
  const fraction = (absolute % 1_000_000n).toString().padStart(6, "0").replace(/0+$/, "");
  return (raw < 0n ? "−" : signed && raw > 0n ? "+" : "") + integer.format(absolute / 1_000_000n) + (fraction ? `.${fraction}` : "");
}

export function PythHolderLeaderboard() {
  const snapshot = useQuery(api.pythHolderRankings.latest, {});
  const [excludePooled, setExcludePooled] = useState(false);
  const [limit, setLimit] = useState(10);
  const [days, setDays] = useState<HolderPeriod>(1);
  const period = snapshot?.periods.find(period => period.days === days);
  const view = holderView(snapshot?.entries ?? [], excludePooled);
  const rows = view.slice(0, limit);
  const largest = view.reduce((maximum, row) => {
    const delta = period?.status === "ready" ? row.changes.find(change => change.days === days)?.amountDelta : null;
    const { current, previous } = holderBarBalances(row.amount, delta);
    return current > maximum ? (current > previous ? current : previous) : previous > maximum ? previous : maximum;
  }, 0n);
  const compact = limit > 10;
  return <section aria-labelledby="ownership-activity-title" className="space-y-4">
    <div>
      <h2 id="ownership-activity-title" className="text-lg font-medium text-white/90">PYTH ownership activity</h2>
      <p className="mt-1 text-sm text-white/65">The largest native PYTH balances and how their holdings change over time.</p>
    </div>
    <div className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.025] p-5 sm:p-6">
    <div className="flex flex-wrap items-baseline justify-between gap-3">
      <h3 id="holder-ranking-title" className="text-base font-medium text-white/90">Top PYTH holders</h3>
      {snapshot && <p className="text-sm text-white/60" title={new Date(snapshot.collectedAt).toUTCString()}>Updated {new Date(snapshot.collectedAt).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "UTC" })} UTC</p>}
    </div>
    <div className="mt-5 flex flex-wrap items-center justify-between gap-4 border-y border-white/10 py-4">
      <label className="flex cursor-pointer items-center gap-2.5 rounded-lg text-sm text-white/80">
        <input type="checkbox" checked={excludePooled} onChange={event => setExcludePooled(event.target.checked)} className="h-4 w-4 accent-cyan-300 focus-visible:outline-cyan-300" />
        Exclude pooled custody
      </label>
      <div className="flex flex-wrap gap-4 text-sm">
        <label className="flex items-center gap-2 text-white/70">Show
          <select value={limit} onChange={event => setLimit(Number(event.target.value))} className="rounded-lg border border-white/15 bg-[#292238] px-3 py-2 text-white focus-visible:outline-cyan-300">
            {[10, 50, 100].map(count => <option key={count} value={count}>Top {count}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-2 text-white/70">Compare
          <select value={days} onChange={event => setDays(Number(event.target.value) as HolderPeriod)} className="rounded-lg border border-white/15 bg-[#292238] px-3 py-2 text-white focus-visible:outline-cyan-300">
            <option value={1}>24 hours</option><option value={7}>7 days</option><option value={30}>30 days</option>
          </select>
        </label>
      </div>
    </div>
    <AddressRankSearch onLookup={address => {
      if (!snapshot) return { message: "Awaiting the first holder ranking snapshot.", tone: "info" };
      const row = view.find(entry => entry.owner === address);
      if (row && row.viewRank <= limit) return {
        message: `Rank #${row.viewRank} in the selected Top ${limit} · ${tokens(row.amount)} PYTH native balance.`, tone: "found",
      };
      if (row) return { message: `Rank #${row.viewRank} in this view, outside the selected Top ${limit}. Choose a larger Top list to see it.`, tone: "info" };
      if (excludePooled && snapshot.entries.some(entry => entry.owner === address)) return {
        message: "This address is in the tracked top 100 but hidden by Exclude pooled custody. Turn off that filter to see its rank.", tone: "info",
      };
      return { message: `Not in the selected Top ${limit}. This snapshot tracks only the top 100 native holders; the address may still hold PYTH outside that ranking.`, tone: "info" };
    }} />
    {snapshot ? <>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p role="status" className="text-sm text-white/65">Showing {rows.length} of {view.length} {excludePooled ? "owners after filtering" : "tracked owners"}{excludePooled ? ` · ${snapshot.entries.length} tracked` : ""}</p>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-white/75" aria-label="Balance bar legend">
          <span className="flex items-center gap-1.5"><span aria-hidden="true" className="h-2.5 w-5 rounded-sm bg-cyan-200" />Retained</span>
          <span className="flex items-center gap-1.5"><span aria-hidden="true" className="h-2.5 w-5 rounded-sm bg-emerald-300" />Added</span>
          <span className="flex items-center gap-1.5"><span aria-hidden="true" className="h-2.5 w-5 rounded-sm border border-dashed border-rose-300 bg-rose-400/10" />Removed</span>
        </div>
      </div>
      {excludePooled && <p className="mt-2 text-sm leading-relaxed text-white/60">Filtered within the tracked top 100; lower-ranked owners are not fetched.</p>}
      {Date.now() - snapshot.collectedAt > 36 * 60 * 60 * 1000 && <p role="status" className="mt-3 text-sm text-amber-200">Collection is overdue. Showing the last successful snapshot.</p>}
      <p role="status" className="mt-3 text-sm leading-relaxed text-white/65">
        {period?.status === "collecting" ? `Collecting history · ${days === 1 ? "24-hour" : `${days}-day`} changes aren’t available yet.` : period?.status === "missing" ? `Snapshot unavailable for ${period.date}. Changes cannot be calculated.` : `Compared with ${period?.collectedAt ? new Date(period.collectedAt).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "UTC" }) : period?.date} UTC`}
      </p>
      <ol aria-label={`${rows.length} PYTH holders in the ${excludePooled ? "custody-filtered" : "all holders"} view`} className={compact ? "mt-2 divide-y divide-white/[0.06]" : "mt-5 space-y-5"}>
        {rows.map(row => {
          const entity = HOLDER_ENTITY_BY_OWNER.get(row.owner);
          const change = row.changes.find(change => change.days === days);
          const delta = change?.amountDelta;
          const rankDelta = excludePooled ? change?.filteredRankDelta : change?.rankDelta;
          const newEntry = period?.status === "ready" && delta == null;
          const color = delta == null || BigInt(delta) === 0n ? "text-white/60" : BigInt(delta) > 0n ? "text-emerald-300" : "text-rose-300";
          const segments = holderBarWidths(row.amount, period?.status === "ready" ? delta : null, largest);
          return <li key={row.owner} className={`grid grid-cols-[1.75rem_minmax(0,1fr)] gap-x-3 ${compact ? "py-3" : ""}`}>
            <div className="pt-0.5 text-xs tabular-nums text-white/45">
              <span>{row.viewRank}</span>
              {rankDelta != null && rankDelta !== 0 && <span className={`mt-1 block text-[10px] ${rankDelta > 0 ? "text-emerald-300" : "text-rose-300"}`} title={`Rank ${rankDelta > 0 ? "improved" : "fell"} by ${Math.abs(rankDelta)}`}>{rankDelta > 0 ? "↑" : "↓"}{Math.abs(rankDelta)}</span>}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <a href={`https://solscan.io/account/${row.owner}`} target="_blank" rel="noopener noreferrer" title={row.owner} aria-label={`View owner ${row.owner} on Solscan`} className="rounded text-sm font-medium text-cyan-200 hover:text-cyan-100 focus-visible:outline-2 focus-visible:outline-cyan-300">{row.owner.slice(0, 5)}…{row.owner.slice(-5)}</a>
                    {newEntry && <span className="rounded-full bg-amber-300/10 px-2 py-0.5 text-[10px] text-amber-200" title={`Not in top 100 on ${period.date}`}>New to top 100</span>}
                  </div>
                  {entity && <a href={entity.source} target="_blank" rel="noopener noreferrer" title={`Solscan attribution · ${entity.category}`} className="mt-1 block rounded text-[11px] text-violet-200 hover:text-violet-100 focus-visible:outline-2 focus-visible:outline-cyan-300">{entity.label}</a>}
                </div>
                <div className="ml-auto text-right tabular-nums">
                  <p className="text-sm text-white/90">{tokens(row.amount)} <span className="text-[10px] text-white/45">PYTH</span></p>
                  <p className={`mt-1 text-xs ${color}`} aria-label={`${days === 1 ? "24-hour" : `${days}-day`} balance change`}>
                    {delta != null ? <>{tokens(delta, true)} <span className="text-[10px]">PYTH</span><span className="ml-2 text-[11px]">({change?.percentageDelta && !change.percentageDelta.startsWith("-") && change.percentageDelta !== "0.00" ? "+" : ""}{change?.percentageDelta}%)</span></> : <span title={newEntry ? `Not in top 100 on ${period.date}; previous balance unknown` : period?.status === "collecting" ? "Collecting history" : "Snapshot unavailable"}>—</span>}
                  </p>
                </div>
              </div>
              <div aria-hidden="true" className={`mt-2 flex overflow-hidden rounded-full bg-white/[0.06] ${compact ? "h-1.5" : "h-2.5"}`}>
                <div className={`h-full shrink-0 bg-gradient-to-r from-cyan-400/60 to-cyan-200 ${segments.added > 0 || segments.removed > 0 ? "rounded-l-full" : "rounded-full"}`} style={{ width: `${segments.retained}%` }} />
                {segments.added > 0 && <div className="h-full shrink-0 rounded-r-full bg-emerald-300" style={{ width: `${segments.added}%` }} />}
                {segments.removed > 0 && <div className="h-full shrink-0 rounded-r-full border border-dashed border-rose-300/80 bg-rose-400/10" style={{ width: `${segments.removed}%` }} />}
              </div>
            </div>
          </li>;
        })}
      </ol>
      <details className="mt-6 border-t border-white/10 text-sm leading-relaxed text-white/65">
        <summary className="cursor-pointer py-4 font-medium text-white/80 focus-visible:outline-cyan-300">About this data</summary>
        <div className="grid gap-5 pb-2 sm:grid-cols-2">
          <div className="space-y-3">
            <p>Native PYTH balances are grouped by token account owner. We record the top 100 daily at 03:00 UTC and retain 35 days of snapshots. Tracking began {snapshot.firstDate}.</p>
            <p>Balance changes compare the same address across daily snapshots, rather than exact rolling intervals. “New to top 100” means absent from the earlier list; its previous balance is unknown. Ranks use the selected view.</p>
            <p>All bars use the largest current or previous balance in this view as their scale. Cyan shows retained PYTH, green shows added PYTH, and dashed red shows removed PYTH. Without history, cyan shows the current balance.</p>
          </div>
          <div className="space-y-3">
            <p>Labels are Solscan public attributions checked on 27 September 2026, not proof of beneficial ownership. An unidentified owner may still belong to an entity.</p>
            <p>The custody filter hides labeled exchange, broker, custodian and staking custody wallets, which can pool tokens for many people. Jump Crypto and Wintermute remain visible as trading firms.</p>
            <p>Filtering applies within the recorded top 100 and does not fetch replacement owners. Changing custody classifications starts a fresh comparison baseline.</p>
          </div>
        </div>
      </details>
    </> : <p role="status" className="mt-5 text-sm text-white/60">{snapshot === undefined ? "Loading holders…" : "Awaiting the first top-100 collection."}</p>}
    </div>
  </section>;
}
