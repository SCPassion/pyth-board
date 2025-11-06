"use client";

import { PortfolioSummary } from "@/components/portfolio-summary";
import { MetricCards } from "@/components/metric-cards";
import { GeneralSummary } from "@/components/general-summary";
import { DashboardSkeleton } from "@/components/dashboard-skeleton";
import { useAppLoading } from "@/components/app-layout";
import { useWalletInfosStore } from "@/store/store";
import { usePythPrice } from "@/hooks/use-pyth-price";
import { Wallet } from "lucide-react";

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
    <div className="space-y-6">
      <PortfolioSummary
        connectedWallets={connectedWallets}
        totalStaked={totalStaked}
        uniqueValidatorSize={uniqueValidatorSize}
        pythPrice={pythPrice}
      >
        Portfolio Summary
      </PortfolioSummary>
      <MetricCards pythPrice={pythPrice} totalStaked={totalStaked} />
      <GeneralSummary
        totalGovernance={totalGovernance.toFixed(1)}
        oisTotalStaked={oisTotalStaked.toFixed(0)}
        rewardsDistributed={rewardsDistributed.toFixed(1)}
      >
        General Information
      </GeneralSummary>
    </div>
  );
}
