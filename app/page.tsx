"use client";

import { PortfolioSummary } from "@/components/portfolio-summary";
import { MetricCards } from "@/components/metric-cards";
import { DashboardSkeleton } from "@/components/dashboard-skeleton";
import { PageMasthead } from "@/components/page-masthead";
import { SectionRule } from "@/components/section-rule";
import { useAppLoading } from "@/components/app-loading-context";
import { useWalletInfosStore } from "@/store/store";
import { usePythPrice } from "@/hooks/use-pyth-price";
import { getGovernancePortfolioTotal } from "@/lib/wallet-storage";

export default function Dashboard() {
  const { wallets } = useWalletInfosStore();
  const pythPrice = usePythPrice();
  const { isLoading } = useAppLoading();

  // Show skeleton only briefly while initial load (don't block forever)
  // If wallets are empty, show skeleton, otherwise show content
  const showSkeleton = isLoading && wallets.length === 0;

  const totalStaked = getGovernancePortfolioTotal(wallets);

  const connectedWallets = wallets.length;

  // Show skeleton only if loading and no wallets
  if (showSkeleton) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="w-full min-w-0 space-y-16 sm:space-y-20">
      <PageMasthead
        eyebrow="Portfolio Overview"
        title={
          <>
            Your PYTH governance stake, <em>in one place.</em>
          </>
        }
        description="Track PYTH governance balances across your wallets, with active stake, warmup, unstaking, and current market value."
      />

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
        />
      </section>

      <section className="space-y-7">
        <SectionRule
          index="02"
          title="Market Metrics"
          description="Live PYTH price and wallet spread."
        />
        <MetricCards
          pythPrice={pythPrice}
          totalStaked={totalStaked}
        />
      </section>
    </div>
  );
}
