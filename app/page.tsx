"use client";

import { PortfolioSummary } from "@/components/portfolio-summary";
import { MetricCards } from "@/components/metric-cards";
import { GeneralSummary } from "@/components/general-summary";
import { useWalletInfosStore } from "@/store/store";
import { usePythPrice } from "@/hooks/use-pyth-price";

export default function Dashboard() {
  console.log("Dashboard component rendered");

  const { wallets } = useWalletInfosStore();
  const pythPrice = usePythPrice();

  const totalStaked = wallets.reduce((sum, wallet) => {
    return sum + (wallet.stakingInfo?.totalStakedPyth || 0);
  }, 0);

  const totalRewards = wallets.reduce((sum, wallet) => {
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

  return (
    <>
      <PortfolioSummary
        connectedWallets={connectedWallets}
        totalStaked={totalStaked}
        uniqueValidatorSize={uniqueValidatorSize}
        pythPrice={pythPrice}
      >
        {wallets.length === 0
          ? "Please add a wallet to view details."
          : "Portfolio Summary"}
      </PortfolioSummary>
      <MetricCards
        pythPrice={pythPrice}
        totalStaked={totalStaked}
        totalRewards={totalRewards}
      />
      <GeneralSummary
        totalGovernance={totalGovernance.toFixed(1)}
        oisTotalStaked={oisTotalStaked.toFixed(0)}
        rewardsDistributed={rewardsDistributed.toFixed(1)}
      >
        General Information
      </GeneralSummary>
    </>
  );
}
