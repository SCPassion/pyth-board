"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { ChevronDown } from "lucide-react";
import { AddressRankSearch } from "@/components/address-rank-search";

const integer = new Intl.NumberFormat("en-US");
const fullDate = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
type Cooldown = { amount: string; startAt: number; endAt: number };
type ScheduledCooldown = { endAt: number; amount: string; owners: number };
type UnstakingOwner = { owner: string; amount: string; cooldowns?: Cooldown[] };

function cooldownStatus(periods: Cooldown[] | undefined, asOf: number) {
  if (!periods?.length) return { label: "Dates pending", color: "bg-white/5 text-white/60" };
  if (periods.every(period => asOf < period.startAt)) return { label: "Pending cooldown", color: "bg-amber-300/10 text-amber-200" };
  if (periods.every(period => asOf >= period.endAt)) return { label: "Available to withdraw", color: "bg-emerald-300/10 text-emerald-200" };
  if (periods.every(period => asOf >= period.startAt && asOf < period.endAt)) return { label: "In cooldown", color: "bg-cyan-300/10 text-cyan-200" };
  return { label: "Mixed cooldowns", color: "bg-violet-300/10 text-violet-200" };
}

// PYTH has six decimals. Preserve every token unit in the displayed amount.
function formatPyth(amount: string) {
  const raw = BigInt(amount);
  const fraction = (raw % 1_000_000n).toString().padStart(6, "0").replace(/0+$/, "");
  return integer.format(raw / 1_000_000n) + (fraction ? `.${fraction}` : "");
}

function Wallet({ owner }: { owner: string }) {
  return <a href={`https://solscan.io/account/${owner}`} target="_blank" rel="noopener noreferrer" title={owner}
    aria-label={`View wallet ${owner} on Solscan`}
    className="rounded text-sm font-medium text-cyan-200 hover:text-cyan-100 focus-visible:outline-2 focus-visible:outline-cyan-300">
    {owner.slice(0, 5)}…{owner.slice(-5)}
  </a>;
}

function CooldownTimeline({ period, asOf }: { period: Cooldown; asOf: number }) {
  const pending = asOf < period.startAt;
  const ended = asOf >= period.endAt;
  const progress = Math.max(0, Math.min(100, 100 * (asOf - period.startAt) / (period.endAt - period.startAt)));
  return <div className="mt-3">
    <div className="mb-2 flex items-center justify-between gap-2 text-[11px]">
      <span className={`rounded-full px-2 py-0.5 font-medium ${pending ? "bg-amber-300/10 text-amber-200" : ended ? "bg-emerald-300/10 text-emerald-200" : "bg-cyan-300/10 text-cyan-200"}`}>
        {pending ? "Pending cooldown" : ended ? "Available to withdraw" : "In cooldown"}
      </span>
      <span className="text-white/50">{pending ? "Voting power retained" : "No voting power"}</span>
    </div>
    <div aria-hidden="true" className="flex items-center gap-1.5">
      <span className="h-2 w-2 shrink-0 rounded-full bg-amber-300" />
      <span className={`h-0.5 flex-1 ${pending ? "bg-amber-300/35" : "bg-cyan-300/70"}`} />
      <span className={`h-2 w-2 shrink-0 rounded-full ${pending ? "border border-white/30" : "bg-cyan-300"}`} />
      <span className="h-0.5 flex-1 overflow-hidden bg-white/10"><span className="block h-full bg-cyan-300" style={{ width: `${progress}%` }} /></span>
      <span className={`h-2 w-2 shrink-0 rounded-full ${ended ? "bg-emerald-300" : "border border-white/30"}`} />
    </div>
    <div className="mt-2 grid grid-cols-3 gap-2 text-[10px] leading-relaxed text-white/55 sm:text-[11px]">
      <span>Requested</span>
      <span className="text-center">Cooldown starts<br /><time dateTime={new Date(period.startAt).toISOString()} title={new Date(period.startAt).toUTCString()} className="text-white/80">{fullDate.format(period.startAt)}</time></span>
      <span className="text-right">Available to withdraw<br /><time dateTime={new Date(period.endAt).toISOString()} title={new Date(period.endAt).toUTCString()} className="text-white/80">{fullDate.format(period.endAt)}</time></span>
    </div>
  </div>;
}

function CooldownSchedule({ periods, owners, asOf, limit }: { periods: ScheduledCooldown[] | undefined; owners: UnstakingOwner[]; asOf: number; limit: number }) {
  if (periods === undefined) return <p className="mt-5 text-sm text-white/65">The full cooldown schedule will appear after the next collection.</p>;
  if (!periods.length) return <p className="mt-5 text-sm text-white/65">No governance cooldowns are pending in this snapshot.</p>;
  const selected = periods.map(period => {
    const ranked = owners.slice(0, limit).flatMap(owner => owner.cooldowns?.filter(cooldown => cooldown.endAt === period.endAt)
      .map(cooldown => ({ owner: owner.owner, amount: cooldown.amount })) ?? [])
      .sort((a, b) => BigInt(a.amount) === BigInt(b.amount) ? a.owner.localeCompare(b.owner) : BigInt(a.amount) > BigInt(b.amount) ? -1 : 1);
    const amount = ranked.reduce((sum, row) => sum + BigInt(row.amount), 0n);
    return { period, ranked, amount };
  }).filter(row => row.amount > 0n);
  if (!selected.length) return <p className="mt-5 text-sm text-white/65">No cooldown dates are available for the selected addresses in this snapshot.</p>;
  const total = selected.reduce((sum, row) => sum + row.amount, 0n);
  const allOwnersTotal = periods.reduce((sum, period) => sum + BigInt(period.amount), 0n);
  const largest = selected.reduce((max, row) => row.amount > max ? row.amount : max, 0n);
  return <>
    <div className="mt-5 flex flex-wrap items-baseline justify-between gap-3 border-b border-white/10 pb-4">
      <p className="text-xs text-white/60">Top {limit} unstaking addresses · {selected.length} finish {selected.length === 1 ? "date" : "dates"}</p>
      <p className="text-sm tabular-nums text-white/90"><span className="text-white/55">Total </span>{formatPyth(total.toString())} <span className="text-[10px] text-white/45">PYTH</span></p>
    </div>
    <p className="mt-2 text-[11px] text-white/50">All qualifying owners: {formatPyth(allOwnersTotal.toString())} PYTH across {periods.length} dates</p>
    <ol className="mt-2 divide-y divide-white/10">
      {selected.map(({ period, ranked, amount }) => {
        const width = largest > 0n ? Number(amount * 10_000n / largest) / 100 : 0;
        const pending = asOf < period.endAt - 604800000;
        return <li key={period.endAt}>
          <details className="group">
            <summary className="cursor-pointer list-none rounded-lg py-4 focus-visible:outline-2 focus-visible:outline-cyan-300 [&::-webkit-details-marker]:hidden">
              <span className="flex flex-wrap items-start justify-between gap-3">
                <span>
                  <time dateTime={new Date(period.endAt).toISOString()} title={new Date(period.endAt).toUTCString()} className="text-sm font-medium text-white/90">{fullDate.format(period.endAt)}</time>
                  <span className="mt-1 flex items-center gap-1.5 text-[11px] text-white/55"><span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${pending ? "bg-amber-300" : "bg-cyan-300"}`} />{pending ? "Cooldown pending" : "In cooldown"} · {ranked.length} of {period.owners} owners</span>
                </span>
                <span className="flex items-center gap-2 text-sm tabular-nums text-white/90">{formatPyth(amount.toString())} <span className="text-[10px] text-white/45">PYTH</span><ChevronDown aria-hidden="true" className="ml-1 h-4 w-4 shrink-0 text-white/50 transition-transform group-open:rotate-180" /></span>
              </span>
              <span aria-hidden="true" className="mt-3 block h-2.5 overflow-hidden rounded-full bg-white/[0.06]">
                <span className={`block h-full rounded-full ${pending ? "bg-amber-300" : "bg-cyan-300"}`} style={{ width: `${width}%` }} />
              </span>
            </summary>
            <div className="mb-4 rounded-xl border border-white/10 bg-white/[0.025] px-4 py-3">
              <p className="text-[11px] leading-relaxed text-white/55">Selected top {limit}: {formatPyth(amount.toString())} PYTH · All {period.owners} owners: {formatPyth(period.amount)} PYTH{ranked.length > 10 ? " · Scroll for more addresses" : ""}</p>
              <ol tabIndex={ranked.length > 10 ? 0 : undefined} aria-label={`Ranked unstaking addresses for ${fullDate.format(period.endAt)}`}
                className={`mt-2 divide-y divide-white/10 ${ranked.length > 10 ? "max-h-80 overflow-y-auto overscroll-contain pr-2 focus-visible:rounded-lg focus-visible:outline-2 focus-visible:outline-cyan-300" : ""}`}>
                {ranked.map((row, i) => <li key={row.owner} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 py-2 text-xs">
                  <span className="flex items-baseline gap-3"><span className="w-4 tabular-nums text-white/45">{i + 1}</span><Wallet owner={row.owner} /></span>
                  <span className="tabular-nums text-white/85">{formatPyth(row.amount)} <span className="text-[10px] text-white/45">PYTH</span></span>
                </li>)}
              </ol>
            </div>
          </details>
        </li>;
      })}
    </ol>
  </>;
}

function UnstakingAddresses({ owners, asOf, limit }: { owners: UnstakingOwner[]; asOf: number; limit: number }) {
  if (!owners.length) return <p className="mt-5 text-sm text-white/65">No governance cooldowns are pending in this snapshot.</p>;
  const rows = owners.slice(0, limit);
  return <>
    <p className="mt-4 text-xs text-white/60">Showing {rows.length} of {owners.length} ranked addresses · Select a row for cooldown dates{rows.length > 10 ? " · Scroll for more" : ""}</p>
    <AddressRankSearch onLookup={address => {
      const rank = owners.findIndex(row => row.owner === address);
      if (rank >= 0 && rank < limit) return {
        message: `Rank #${rank + 1} in the selected Top ${limit} unstaking addresses · ${formatPyth(owners[rank].amount)} PYTH in pending or active governance cooldowns.`, tone: "found",
      };
      if (rank >= 0) return { message: `Rank #${rank + 1} in this snapshot, outside the selected Top ${limit}. Choose a larger Top list to see it.`, tone: "info" };
      if (owners.length < limit) return { message: `Not among the ${owners.length} unstaking addresses stored in this snapshot. A new collection is needed to check the full Top ${limit}.`, tone: "info" };
      return { message: `Not in the selected Top ${limit}. This snapshot tracks only the top ${owners.length} unstaking addresses; smaller cooldowns may still exist.`, tone: "info" };
    }} />
    <ol tabIndex={rows.length > 10 ? 0 : undefined} aria-label="Ranked PYTH unstaking addresses"
      className={`mt-2 divide-y divide-white/10 ${rows.length > 10 ? "max-h-[38rem] overflow-y-auto overscroll-contain pr-2 focus-visible:rounded-lg focus-visible:outline-2 focus-visible:outline-cyan-300" : ""}`}>
      {rows.map((row, i) => {
        const status = cooldownStatus(row.cooldowns, asOf);
        return <li key={row.owner}>
          <details className="group">
            <summary className="flex cursor-pointer list-none items-center gap-3 rounded-lg py-3 focus-visible:outline-2 focus-visible:outline-cyan-300 [&::-webkit-details-marker]:hidden">
              <span className="w-4 shrink-0 text-xs tabular-nums text-white/45">{i + 1}</span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <Wallet owner={row.owner} />
                  <span className="text-sm tabular-nums text-white/90">{formatPyth(row.amount)} <span className="text-[10px] text-white/45">PYTH</span></span>
                </span>
                <span className={`mt-1.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${status.color}`}>{status.label}</span>
              </span>
              <ChevronDown aria-hidden="true" className="h-4 w-4 shrink-0 text-white/50 transition-transform group-open:rotate-180" />
            </summary>
            <div className="mb-3 ml-7 rounded-xl border border-white/10 bg-white/[0.025] px-3 py-3 sm:px-4">
              <p className="text-[11px] leading-relaxed text-white/55">As of {new Date(asOf).toLocaleString("en-GB", { timeZone: "UTC" })} UTC · Cooldown dates at 00:00 UTC</p>
              {row.cooldowns?.length ? <div className="divide-y divide-white/10">{row.cooldowns.map(period => <div key={period.startAt} className="py-2">
                {row.cooldowns!.length > 1 && <p className="mt-2 text-xs tabular-nums text-white/80">{formatPyth(period.amount)} PYTH</p>}
                <CooldownTimeline period={period} asOf={asOf} />
              </div>)}</div> : <p className="mt-3 text-xs text-white/55">Cooldown dates will appear after the next collection.</p>}
            </div>
          </details>
        </li>;
      })}
    </ol>
  </>;
}

export function GovernanceLeaderboards() {
  const [unstakingView, setUnstakingView] = useState<"time" | "addresses">("time");
  const [addressLimit, setAddressLimit] = useState(10);
  const snapshot = useQuery(api.pythGovernanceStakers.leaderboard, {});
  const stakerRows = snapshot?.topStakers.slice(0, addressLimit) ?? [];
  const largest = snapshot?.topStakers[0] ? BigInt(snapshot.topStakers[0].amount) : 0n;
  const panel = "min-w-0 rounded-2xl border border-white/10 bg-white/[0.025] p-5 sm:p-6";
  const empty = snapshot === undefined ? "Loading rankings…" : snapshot === null ? "Awaiting the first daily ranking collection." : "No qualifying positions in this snapshot.";
  return <section aria-labelledby="governance-activity-title" className="space-y-4">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 id="governance-activity-title" className="text-lg font-medium text-white/90">Governance staking activity</h2>
        <p className="mt-1 text-sm text-white/65">The largest governance stakes and when unstaking amounts become withdrawable.</p>
      </div>
      {snapshot && <p className="text-xs text-white/55">Updated {new Date(snapshot.collectedAt).toLocaleString("en-GB", { timeZone: "UTC" })} UTC</p>}
    </div>
    {snapshot && Date.now() - snapshot.collectedAt > 36 * 60 * 60 * 1000 && <p role="status" className="text-sm text-amber-300">Collection is overdue. Showing the last successful rankings.</p>}
    <div className="flex flex-wrap items-center justify-between gap-3 border-y border-white/10 py-3">
      <p className="text-xs text-white/60">Address rankings in both charts</p>
      <label className="flex items-center gap-2 text-xs text-white/70">Show
        <select value={addressLimit} onChange={event => setAddressLimit(Number(event.target.value))} className="rounded-lg border border-white/15 bg-[#292238] px-3 py-2 text-white focus-visible:outline-cyan-300">
          {[10, 50, 100].map(count => <option key={count} value={count}>Top {count}</option>)}
        </select>
      </label>
    </div>
    <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <section aria-labelledby="top-governance-stakers" className={panel}>
        <h3 id="top-governance-stakers" className="text-sm font-medium text-white/90">Top {addressLimit} PYTH stakers</h3>
        <p className="mt-1 text-xs text-white/60">Voting-eligible governance stake · By owner</p>
        <p className="mt-3 text-[11px] text-white/50">Showing {stakerRows.length} of {snapshot?.topStakers.length ?? 0} ranked addresses · Bar lengths compare amounts with the largest stake.{stakerRows.length > 10 ? " Scroll for more." : ""}</p>
        {!!snapshot && snapshot.topStakers.length < addressLimit && <p role="status" className="mt-2 text-xs leading-relaxed text-amber-200/85">This snapshot contains only {snapshot.topStakers.length} staker addresses. The next governance collection can populate up to 100.</p>}
        <AddressRankSearch onLookup={address => {
          if (!snapshot) return { message: "Awaiting the first governance ranking snapshot.", tone: "info" };
          const rank = snapshot.topStakers.findIndex(row => row.owner === address);
          if (rank >= 0 && rank < addressLimit) return {
            message: `Rank #${rank + 1} in the selected Top ${addressLimit} · ${formatPyth(snapshot.topStakers[rank].amount)} PYTH voting-eligible governance stake.`, tone: "found",
          };
          if (rank >= 0) return { message: `Rank #${rank + 1} in this snapshot, outside the selected Top ${addressLimit}. Choose a larger Top list to see it.`, tone: "info" };
          if (snapshot.topStakers.length < addressLimit) return { message: `Not among the ${snapshot.topStakers.length} staker addresses stored in this snapshot. A new collection is needed to check the full Top ${addressLimit}.`, tone: "info" };
          return { message: `Not in the selected Top ${addressLimit}. This snapshot tracks only the top ${snapshot.topStakers.length}; the address may still have a smaller governance stake.`, tone: "info" };
        }} />
        {stakerRows.length ? <ol tabIndex={stakerRows.length > 10 ? 0 : undefined} aria-label="Ranked PYTH governance stakers"
          className={`mt-5 space-y-5 ${stakerRows.length > 10 ? "max-h-[40rem] overflow-y-auto overscroll-contain pr-2 pb-2 focus-visible:rounded-lg focus-visible:outline-2 focus-visible:outline-cyan-300" : ""}`}>
          {stakerRows.map((row, i) => {
            const width = largest > 0n ? Number(BigInt(row.amount) * 10_000n / largest) / 100 : 0;
            return <li key={row.owner}>
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <div className="flex items-baseline gap-3"><span className="w-4 text-xs tabular-nums text-white/45">{i + 1}</span><Wallet owner={row.owner} /></div>
                <span className="text-sm tabular-nums text-white/90">{formatPyth(row.amount)} <span className="text-[10px] text-white/45">PYTH</span></span>
              </div>
              <div aria-hidden="true" className="ml-7 mt-2 h-2.5 overflow-hidden rounded-full bg-white/[0.06]">
                <div className="h-full rounded-full bg-gradient-to-r from-cyan-400/60 to-cyan-200" style={{ width: `${width}%` }} />
              </div>
            </li>;
          })}
        </ol> : <p className="mt-5 text-sm text-white/65">{empty}</p>}
      </section>
      <section aria-labelledby="governance-cooldown-schedule" className={panel}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 id="governance-cooldown-schedule" className="text-sm font-medium text-white/90">PYTH unstaking</h3>
            <p className="mt-1 text-xs text-white/60">See when cooldowns finish or which addresses have the largest amounts</p>
          </div>
          <div role="group" aria-label="Unstaking view" className="ml-auto inline-flex shrink-0 rounded-lg border border-white/15 bg-white/[0.025] p-0.5 text-xs font-medium">
            <button type="button" aria-pressed={unstakingView === "time"} onClick={() => setUnstakingView("time")}
              className={`rounded-md px-3 py-2 focus-visible:outline-2 focus-visible:outline-cyan-300 ${unstakingView === "time" ? "bg-amber-300 text-[#241b30]" : "text-white/70 hover:text-white"}`}>By date</button>
            <button type="button" aria-pressed={unstakingView === "addresses"} onClick={() => setUnstakingView("addresses")}
              className={`rounded-md px-3 py-2 focus-visible:outline-2 focus-visible:outline-cyan-300 ${unstakingView === "addresses" ? "bg-amber-300 text-[#241b30]" : "text-white/70 hover:text-white"}`}>By address</button>
          </div>
        </div>
        {snapshot ? unstakingView === "time"
          ? <CooldownSchedule periods={snapshot.cooldownSchedule} owners={snapshot.topUnstaking} asOf={snapshot.collectedAt} limit={addressLimit} />
          : <UnstakingAddresses owners={snapshot.topUnstaking} asOf={snapshot.collectedAt} limit={addressLimit} />
          : <p className="mt-5 text-sm text-white/65">{empty}</p>}
        <p className="mt-5 text-[11px] leading-relaxed text-white/50">Dates are 00:00 UTC. By date amounts and bars use the selected top addresses; all-owner totals are shown separately. Availability does not confirm a withdrawal or sale.</p>
      </section>
    </div>
    <p className="text-xs leading-relaxed text-white/60">Daily at 15:00 UTC · Governance only; Oracle Integrity Staking is excluded. Pending cooldown still carries voting power, so wallets and amounts can appear in both lists. Fully unlocked positions are excluded. Availability indicates when cooldown ends; withdrawal requires a separate wallet action.</p>
  </section>;
}
