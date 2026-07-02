"use client";

import { PortfolioSummary } from "@/components/portfolio-summary";
import { MetricCards } from "@/components/metric-cards";
import { GeneralSummary } from "@/components/general-summary";
import { DashboardSkeleton } from "@/components/dashboard-skeleton";
import { PageMasthead } from "@/components/page-masthead";
import { SectionRule } from "@/components/section-rule";
import { useAppLoading } from "@/components/app-loading-context";
import { useWalletInfosStore } from "@/store/store";
import { usePythPrice } from "@/hooks/use-pyth-price";

export default function Dashboard() {
  const { wallets } = useWalletInfosStore();
  const pythPrice = usePythPrice();
  const { isLoading } = useAppLoading();

  // Show skeleton only briefly while initial load (don't block forever)
  // If wallets are empty, show skeleton, otherwise show content
  const showSkeleton = isLoading && wallets.length === 0;

  const totalStaked = wallets.reduce((sum, wallet) => {
    return sum + (wallet.stakingInfo?.totalStakedPyth || 0);
  }, 0);

  const totalClaimableRewards = wallets.reduce((sum, wallet) => {
    return sum + (wallet.stakingInfo?.claimableRewards || 0);
  }, 0);

  const connectedWallets = wallets.length;

  const validatorSets = wallets.map(
    (wallet) =>
      wallet.stakingInfo?.StakeForEachPublisher.map(
        (publisher) => publisher.publisherKey
      ) || []
  );
  const uniqueValidators = new Set(
    validatorSets.flat().filter((v) => v !== "")
  );
  const uniqueValidatorSize = uniqueValidators.size;

  const totalGovernance =
    (wallets[wallets.length - 1]?.stakingInfo?.generalStats?.totalGovernance ||
      0) / 1e9;

  const oisTotalStaked =
    (wallets[wallets.length - 1]?.stakingInfo?.generalStats?.totalStaked || 0) /
    1e6;
  const rewardsDistributed =
    (wallets[wallets.length - 1]?.stakingInfo?.generalStats
      ?.rewardsDistributed || 0) / 1e6;

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
            Your PYTH staking, <em>in one place.</em>
          </>
        }
        description="A live snapshot of every connected wallet: staked balance, claimable rewards, and the validators securing your exposure across the network."
      />

      <section className="space-y-7">
        <SectionRule
          index="01"
          title="Portfolio Summary"
          description={`${connectedWallets} connected wallet${connectedWallets === 1 ? "" : "s"} · ${totalStaked.toFixed(0)} PYTH staked`}
        />
        <PortfolioSummary
          connectedWallets={connectedWallets}
          totalStaked={totalStaked}
          totalClaimableRewards={totalClaimableRewards}
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
          totalClaimableRewards={totalClaimableRewards}
        />
      </section>

      <section className="space-y-7 pb-2">
        <SectionRule
          index="03"
          title="General Information"
          description={`Network-wide figures across ${uniqueValidatorSize} unique validators.`}
        />
        <GeneralSummary
          totalGovernance={totalGovernance.toFixed(1)}
          oisTotalStaked={oisTotalStaked.toFixed(0)}
          rewardsDistributed={rewardsDistributed.toFixed(1)}
        />
      </section>
    </div>
  );
}
