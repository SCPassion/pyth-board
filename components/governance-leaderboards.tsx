"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { ChevronDown } from "lucide-react";

const integer = new Intl.NumberFormat("en-US");
const date = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
type Cooldown = { amount: string; startAt: number; endAt: number };

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
      <span className="text-center">Cooldown starts<br /><time dateTime={new Date(period.startAt).toISOString()} title={new Date(period.startAt).toUTCString()} className="text-white/80">{date.format(period.startAt)}</time></span>
      <span className="text-right">Available to withdraw<br /><time dateTime={new Date(period.endAt).toISOString()} title={new Date(period.endAt).toUTCString()} className="text-white/80">{date.format(period.endAt)}</time></span>
    </div>
  </div>;
}

export function GovernanceLeaderboards() {
  const snapshot = useQuery(api.pythGovernanceStakers.leaderboard, {});
  const largest = snapshot?.topStakers[0] ? BigInt(snapshot.topStakers[0].amount) : 0n;
  const panel = "min-w-0 rounded-2xl border border-white/10 bg-white/[0.025] p-5 sm:p-6";
  const empty = snapshot === undefined ? "Loading rankings…" : snapshot === null ? "Awaiting the first daily ranking collection." : "No qualifying positions in this snapshot.";
  return <section aria-labelledby="governance-activity-title" className="space-y-4">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 id="governance-activity-title" className="text-lg font-medium text-white/90">Governance staking activity</h2>
        <p className="mt-1 text-sm text-white/65">The largest governance stakes and amounts awaiting withdrawal.</p>
      </div>
      {snapshot && <p className="text-xs text-white/55">Updated {new Date(snapshot.collectedAt).toLocaleString("en-GB", { timeZone: "UTC" })} UTC</p>}
    </div>
    {snapshot && Date.now() - snapshot.collectedAt > 36 * 60 * 60 * 1000 && <p role="status" className="text-sm text-amber-300">Collection is overdue. Showing the last successful rankings.</p>}
    <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-2">
      <section aria-labelledby="top-governance-stakers" className={panel}>
        <h3 id="top-governance-stakers" className="text-sm font-medium text-white/90">Top 10 PYTH stakers</h3>
        <p className="mt-1 text-xs text-white/60">Voting-eligible governance stake · By owner</p>
        <p className="mt-3 text-[11px] text-white/50">Bar lengths compare amounts with the largest stake.</p>
        {snapshot?.topStakers.length ? <ol className="mt-5 space-y-5">
          {snapshot.topStakers.map((row, i) => {
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
      <section aria-labelledby="top-governance-unstaking" className={panel}>
        <h3 id="top-governance-unstaking" className="text-sm font-medium text-white/90">Top 10 PYTH unstaking</h3>
        <p className="mt-1 text-xs text-white/60">Pending + active governance cooldown · By owner</p>
        <p className="mt-3 text-[11px] text-white/50">Select a row for cooldown dates · Status at collection</p>
        {snapshot?.topUnstaking.length ? <ol className="mt-2 divide-y divide-white/10">
          {snapshot.topUnstaking.map((row, i) => {
            const status = cooldownStatus(row.cooldowns, snapshot.collectedAt);
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
                  <p className="text-[11px] leading-relaxed text-white/55">As of {new Date(snapshot.collectedAt).toLocaleString("en-GB", { timeZone: "UTC" })} UTC · Cooldown dates at 00:00 UTC</p>
                  {row.cooldowns?.length ? <div className="divide-y divide-white/10">{row.cooldowns.map(period => <div key={period.startAt} className="py-2">
                    {row.cooldowns!.length > 1 && <p className="mt-2 text-xs tabular-nums text-white/80">{formatPyth(period.amount)} PYTH</p>}
                    <CooldownTimeline period={period} asOf={snapshot.collectedAt} />
                  </div>)}</div> : <p className="mt-3 text-xs text-white/55">Cooldown dates will appear after the next collection.</p>}
                </div>
              </details>
            </li>;
          })}
        </ol> : <p className="mt-5 text-sm text-white/65">{empty}</p>}
      </section>
    </div>
    <p className="text-xs leading-relaxed text-white/60">Daily at 15:00 UTC · Governance only; Oracle Integrity Staking is excluded. Pending cooldown still carries voting power, so wallets and amounts can appear in both lists. Fully unlocked positions are excluded. Availability indicates when cooldown ends; withdrawal requires a separate wallet action.</p>
  </section>;
}
