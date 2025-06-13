"use client";

import { useState } from "react";
import { Sidebar } from "@/components/sidebar";
import { TopHeader } from "@/components/top-header";
import { PortfolioSummary } from "@/components/portfolio-summary";
import { MetricCards } from "@/components/metric-cards";
import { useWalletInfosStore } from "@/store/store";
import { GeneralSummary } from "@/components/general-summary";
// Mock data

export default function Dashboard() {
  const [currentView, setCurrentView] = useState<"dashboard" | "wallets">(
    "dashboard"
  );
  const { wallets } = useWalletInfosStore();

  const totalStaked = wallets.reduce((sum, wallet) => {
    return sum + (wallet.stakingInfo?.totalStakedPyth || 0);
  }, 0);

  const totalUnstaking = 120;
  const totalRewards = wallets.reduce((sum, wallet) => {
    return sum + (wallet.stakingInfo?.claimableRewards || 0);
  }, 0);

  const connectedWallets = wallets.length;

  const activeValidators = 4;

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
                activeValidators={activeValidators}
              >
                PortfolioSummary
              </PortfolioSummary>
              <MetricCards
                totalStaked={totalStaked}
                totalUnstaking={totalUnstaking}
                totalRewards={totalRewards}
              />
              <GeneralSummary
                totalGovernance={
                  wallets[wallets.length - 1]?.stakingInfo?.generalStats
                    ?.totalGovernance || 0
                }
                oisTotalStaked={
                  wallets[wallets.length - 1]?.stakingInfo?.generalStats
                    ?.totalStaked || 0
                }
                rewardsDistributed={
                  wallets[wallets.length - 1]?.stakingInfo?.generalStats
                    ?.rewardsDistributed || 0
                }
              >
                General Information
              </GeneralSummary>
            </>
          ) : (
            <div className="space-y-6">
              {/* {wallets.map((wallet) => (
                <WalletSection
                  key={wallet.id}
                  wallet={wallet}
                  validators={mockValidators}
                />
              ))} */}
              hi
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
