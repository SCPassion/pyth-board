"use client";

import Link from "next/link";
import { ArrowUpRight, WalletCards } from "lucide-react";
import { PortfolioSummary } from "@/components/portfolio-summary";
import { MetricCards } from "@/components/metric-cards";
import { DashboardSkeleton } from "@/components/dashboard-skeleton";
import { PageMasthead } from "@/components/page-masthead";
import { SectionRule } from "@/components/section-rule";
import { useAppLoading } from "@/components/app-loading-context";
import { useWalletInfosStore } from "@/store/store";
import { usePythPrice } from "@/hooks/use-pyth-price";
import { usePythPriceHistory } from "@/hooks/use-pyth-price-history";
import { getGovernancePortfolioTotal } from "@/lib/wallet-storage";
import { getPriceChange } from "@/lib/pyth-price-history";
import { DashboardProtocolCharts } from "@/components/dashboard-protocol-charts";

function AddWalletPrompt() {
  return (
    <div className="flex flex-col gap-5 rounded-[28px] border border-white/10 bg-[linear-gradient(135deg,rgba(182,88,165,0.28)_0%,rgba(65,30,220,0.22)_100%)] p-6 shadow-[0_20px_55px_rgba(8,5,18,0.2)] sm:flex-row sm:items-center sm:justify-between sm:p-7">
      <div className="flex items-start gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/10">
          <WalletCards className="h-5 w-5 text-white" aria-hidden />
        </div>
        <div className="min-w-0 space-y-1">
          <p className="font-display text-xl text-white sm:text-2xl">
            Track your governance stake
          </p>
          <p className="max-w-xl text-sm leading-relaxed text-white/70">
            Add a Solana wallet to see its active, warming-up and unstaking
            PYTH, and what it&apos;s worth at the current price. Wallets are
            saved only in this browser.
          </p>
        </div>
      </div>
      <Link
        href="/wallets"
        className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-2xl bg-[#23144d] px-5 py-3 text-sm font-semibold text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)] transition-colors hover:bg-[#2a1958] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-300"
      >
        Add a wallet <ArrowUpRight className="h-4 w-4" aria-hidden />
      </Link>
    </div>
  );
}

export default function Dashboard() {
  const { wallets } = useWalletInfosStore();
  const livePythPrice = usePythPrice();
  const { history: priceHistory, isRateLimited } = usePythPriceHistory();
  // CoinGecko's live quote is often rate-limited in the browser; fall back to
  // the latest hourly point from the server-fetched 24h history.
  const pythPrice = livePythPrice ?? priceHistory.at(-1)?.price ?? null;
  const { isLoading } = useAppLoading();

  // Show skeleton only briefly while initial load (don't block forever)
  // If wallets are empty, show skeleton, otherwise show content
  const showSkeleton = isLoading && wallets.length === 0;

  const totalStaked = getGovernancePortfolioTotal(wallets);
  const priceChange = getPriceChange(priceHistory, livePythPrice);

  const connectedWallets = wallets.length;
  const hasWallets = connectedWallets > 0;

  // Show skeleton only if loading and no wallets
  if (showSkeleton) {
    return <DashboardSkeleton />;
  }

  const protocolOverview = <DashboardProtocolCharts />;

  return (
    <div className="w-full min-w-0 space-y-16 sm:space-y-20">
      <PageMasthead
        eyebrow={hasWallets ? "Portfolio Overview" : "Pyth Network Overview"}
        title={
          hasWallets ? (
            <>
              Your PYTH governance stake, <em>in one place.</em>
            </>
          ) : (
            <>
              Pyth Network, <em>at a glance.</em>
            </>
          )
        }
        description={
          hasWallets
            ? "Track PYTH governance balances across your wallets, with active stake, warmup, unstaking, and current market value."
            : "Price feed growth, on-chain PYTH buybacks and reported revenue, plus your own governance stake once you add a wallet."
        }
      />

      {hasWallets ? (
        <section className="space-y-7">
          <SectionRule
            index="01"
            title="Portfolio Summary"
            description={`${connectedWallets} tracked wallet${connectedWallets === 1 ? "" : "s"} · ${totalStaked === null ? "Balances unavailable" : `${totalStaked.toLocaleString("en-US", { maximumFractionDigits: 0 })} PYTH in governance`}`}
          />
          <PortfolioSummary
            connectedWallets={connectedWallets}
            totalStaked={totalStaked}
            pythPrice={pythPrice}
            pythPrice24hAgo={priceChange?.startPrice ?? null}
          />
        </section>
      ) : (
        <section className="space-y-7">
          <SectionRule
            index="01"
            title="Protocol Overview"
            description="Price feeds, on-chain buybacks, and reported revenue, at a glance."
          />
          {protocolOverview}
        </section>
      )}

      <section className="space-y-7">
        <SectionRule
          index="02"
          title="Market Metrics"
          description={
            hasWallets
              ? "Live PYTH price and wallet spread."
              : "Live PYTH price and its last 24 hours."
          }
        />
        <MetricCards
          pythPrice={pythPrice}
          totalStaked={totalStaked}
          priceHistory={priceHistory}
          isRateLimited={isRateLimited}
          priceChange={priceChange}
        />
      </section>

      {hasWallets ? (
        <section className="space-y-7">
          <SectionRule
            index="03"
            title="Protocol Overview"
            description="Price feeds, on-chain buybacks, and reported revenue, at a glance."
          />
          {protocolOverview}
        </section>
      ) : (
        <section className="space-y-7">
          <SectionRule
            index="03"
            title="Your Portfolio"
            description="No wallets tracked yet."
          />
          <AddWalletPrompt />
        </section>
      )}
    </div>
  );
}
