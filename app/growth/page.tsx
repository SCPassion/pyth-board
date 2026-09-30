import { GovernanceStakersPanel } from "@/components/governance-stakers-panel";
import { GovernanceLeaderboards } from "@/components/governance-leaderboards";
import { PythHoldersPanel } from "@/components/pyth-holders-panel";
import { PythHolderLeaderboard } from "@/components/pyth-holder-leaderboard";
import { PageMasthead } from "@/components/page-masthead";

export default function GrowthPage() {
  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <PageMasthead
        eyebrow="Network / Growth"
        title="PYTH ownership, over time."
        description="Native holders and governance participation, at a glance."
        right={<span className="text-xs text-white/70">Daily snapshots · UTC</span>}
      />
      <div className="grid grid-cols-1 items-stretch gap-5 lg:grid-cols-2">
        <PythHoldersPanel />
        <GovernanceStakersPanel />
      </div>
      <p className="text-sm leading-relaxed text-white/70">
        Governance stakers counts voting-eligible stake owners: each owner with a positive LOCKED or PREUNLOCKING governance position counts once. UNLOCKING and UNLOCKED positions do not count because they no longer carry governance voting power.
      </p>
      <PythHolderLeaderboard />
      <GovernanceLeaderboards />
      <details open className="group rounded-2xl border border-white/10 bg-white/[0.025]">
        <summary className="cursor-pointer rounded-2xl px-5 py-4 text-sm font-medium text-white/85 focus-visible:outline-2 focus-visible:outline-cyan-300 sm:px-6">
          How these metrics are counted
          <span className="ml-3 hidden text-xs font-normal text-white/55 sm:inline">Definitions, collection times &amp; limitations</span>
        </summary>
        <div className="space-y-5 border-t border-white/10 px-5 py-5 text-sm leading-relaxed text-white/70 sm:px-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <section className="space-y-2" aria-labelledby="holder-methodology">
              <h2 id="holder-methodology" className="font-medium text-cyan-200">Native PYTH holders · 03:00 UTC</h2>
              <p>Unique Solana owners with a positive native PYTH SPL token balance. Zero-balance accounts are excluded, and multiple token accounts belonging to one owner count once.</p>
              <p>The top 100 eligible owners are ranked by their combined native token account balances during the same scan. We retain 35 days of rankings and compare the same owner across calendar dates; missing owners have no inferred previous balance. Entity labels and an optional pooled-custody filter apply within the tracked top 100. Filtering does not fetch replacement owners. Changing custody classifications starts a new comparison baseline. Staking positions are not attributed back to their beneficial owners.</p>
              <p>Exchanges, custodians, and staking contracts may hold tokens for multiple people, so this does not count every individual beneficial owner.</p>
            </section>
            <section className="space-y-2" aria-labelledby="governance-methodology">
              <h2 id="governance-methodology" className="font-medium text-violet-200">Governance stakers · 15:00 UTC</h2>
              <p>We scan current Pyth staking positions through Helius RPC and apply the staking SDK’s voting-token eligibility rules. Any positive governance amount qualifies; there is no 1 PYTH minimum.</p>
              <p>LOCKED positions are active, and PREUNLOCKING positions are awaiting the start of cooldown; both carry voting power. LOCKING (pending activation), UNLOCKING (in cooldown), and UNLOCKED positions are excluded. Depositing PYTH without a qualifying governance position does not count.</p>
              <p>Each owner address counts once across all qualifying positions, staking accounts, and scan pages. This counts addresses, not individual people, transaction signers, delegates, or actual voters. Owners using OIS count only if they also have qualifying governance stake.</p>
              <p>Both governance rankings track up to 100 addresses, with a shared control for showing the top 10, 50, or 100. The unstaking chart can group the selected addresses by cooldown finish date or rank them by owner. Full all-owner cooldown totals are shown separately for context. A cooldown finishing makes PYTH available to withdraw, but does not mean it was withdrawn or sold.</p>
            </section>
          </div>
          <p className="border-t border-white/10 pt-4 text-xs leading-relaxed">Both metrics are collected independently through Helius RPC and displayed from stored daily snapshots. History starts with the first successful collection; earlier dates are not backfilled, and missed days remain gaps. Each scan spans a short collection window, not a single fixed Solana slot. Governance scans crossing a Pyth epoch or UTC day are rejected. Period changes compare available snapshots, and each chart uses its own count scale.</p>
        </div>
      </details>
    </div>
  );
}
