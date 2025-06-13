"use client";

import { useEffect, useState } from "react";
import { Sidebar } from "@/components/sidebar";
import { TopHeader } from "@/components/top-header";
import { PortfolioSummary } from "@/components/portfolio-summary";
import { MetricCards } from "@/components/metric-cards";
import { useWalletInfosStore } from "@/store/store";
import { GeneralSummary } from "@/components/general-summary";
import { WalletSection } from "@/components/wallet-section";

// Mock data

export default function Dashboard() {
  const [currentView, setCurrentView] = useState<"dashboard" | "wallets">(
    "dashboard"
  );
  const { wallets, setWallets } = useWalletInfosStore();

  useEffect(() => {
    if (localStorage.getItem("wallets")) {
      const storedWallets = localStorage.getItem("wallets");
      if (storedWallets) {
        const parsedWallets = JSON.parse(storedWallets);
        setWallets(parsedWallets);
      }
    } else {
      localStorage.setItem("wallets", JSON.stringify(wallets));
    }
  }, []);

  const totalStaked = wallets.reduce((sum, wallet) => {
    return sum + (wallet.stakingInfo?.totalStakedPyth || 0);
  }, 0);

  const totalUnstaking = 120;
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

  console.log(
    { totalGovernance, oisTotalStaked, rewardsDistributed },
    "General Stats"
  );

  return (
    <div className="flex h-screen bg-[#0f1419]">
      <Sidebar currentView={currentView} onViewChange={setCurrentView} />

      <div className="flex-1 flex flex-col">
        <TopHeader />

        <main className="flex-1 overflow-auto p-6 space-y-6">
          {currentView === "dashboard" ? (
            <>
              <PortfolioSummary
                connectedWallets={connectedWallets}
                totalStaked={totalStaked}
                uniqueValidatorSize={uniqueValidatorSize}
              >
                {wallets.length === 0
                  ? "Please add a wallet to view details."
                  : "Portfolio Summary"}
              </PortfolioSummary>
              <MetricCards
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
          ) : (
            <div className="space-y-6">
              {wallets.map((wallet) => (
                <WalletSection key={wallet.id} wallet={wallet} />
              ))}
              {wallets.length === 0 && (
                <div className="text-center text-gray-400">
                  No wallets found. Please add a wallet to view details.
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
