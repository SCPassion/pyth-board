import { GovernanceStakersPanel } from "@/components/governance-stakers-panel";
import { GovernanceLeaderboards } from "@/components/governance-leaderboards";
import { PythHoldersPanel } from "@/components/pyth-holders-panel";
import { PythHolderLeaderboard } from "@/components/pyth-holder-leaderboard";
import { PageMasthead } from "@/components/page-masthead";
import { PriceFeedsPanel } from "@/components/price-feeds-panel";
import { SectionRule } from "@/components/section-rule";
import Link from "next/link";
import { priceFeedPreview } from "@/lib/growth/priceFeedPreview";
import { createPageMetadata } from "@/lib/seo";

export async function generateMetadata({ searchParams }: { searchParams: Promise<{ preview?: string }> }) {
  const preview = (await searchParams).preview === "sample";
  return createPageMetadata("/growth", { index: !preview });
}

export default async function GrowthPage({ searchParams }: { searchParams: Promise<{ preview?: string }> }) {
  const preview = (await searchParams).preview === "sample";
  const samples = preview ? priceFeedPreview(new Date().toISOString().slice(0, 10)) : undefined;
  return (
    <div className="mx-auto w-full max-w-7xl space-y-8">
      <PageMasthead
        eyebrow="Network / Growth"
        title="Network growth"
        description="Price feed coverage, native holders, and governance participation."
        compact
        right={<span className="text-xs text-white/70">Daily snapshots · UTC</span>}
      />
      {preview && <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-300/25 bg-amber-300/5 px-4 py-3 text-sm text-amber-100">
        <p>Sample preview · 90 days of fictional price-feed history. Ownership data below is live.</p>
        <Link href="/growth" className="rounded underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-amber-200">Return to live data</Link>
      </div>}
      <section className="space-y-4">
        <SectionRule index="01" title="Price feed coverage" />
        <PriceFeedsPanel samples={samples} />
      </section>
      <section className="space-y-6">
        <SectionRule index="02" title="Ownership & participation" />
        <div className="grid grid-cols-1 items-stretch gap-5 lg:grid-cols-2">
          <PythHoldersPanel />
          <GovernanceStakersPanel />
        </div>
        <PythHolderLeaderboard />
        <GovernanceLeaderboards />
        <details className="group rounded-2xl border border-white/10 bg-white/[0.025]">
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
                <p>The bubble map and list show owners with a known, nonzero net PYTH change over 24 hours, 7 days, or 30 days, and can rank the largest increases or reductions. These rankings include only the latest top 100 owners with a known balance on both dates. Bubbles can be sized by balance or absolute net change and dragged within the map; their positions do not indicate relationships. Balance changes do not establish purchases or sales.</p>
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
      </section>
    </div>
  );
}
