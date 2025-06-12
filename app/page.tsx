"use client";

import { useState } from "react";
import { Sidebar } from "@/components/sidebar";
import { TopHeader } from "@/components/top-header";
import { PortfolioSummary } from "@/components/portfolio-summary";
import { MetricCards } from "@/components/metric-cards";
import { WalletInfo } from "@/types/pythTypes";

// Mock data

export default function Dashboard() {
  const [currentView, setCurrentView] = useState<"dashboard" | "wallets">(
    "dashboard"
  );
  const [wallets, setWallets] = useState<WalletInfo[]>([]);

  const totalStaked = wallets.reduce((sum, wallet) => {
    return sum + (wallet.stakingInfo?.totalStakedPyth || 0);
  }, 0);

  const totalUnstaking = 120;
  const totalRewards = wallets.reduce((sum, wallet) => {
    return sum + (wallet.stakingInfo?.claimableRewards || 0);
  }, 0);

  const connectedWallets = wallets.length;
  const activeValidators = 4;

  const handleAddWallet = (address: string, name: string) => {
    const newWallet: WalletInfo = {
      id: Date.now().toString(),
      address: address.slice(0, 4) + "..." + address.slice(-4),
      name,
      stakingAddress: address,
      stakingInfo: null, // This would be fetched from the API
    };
    if (wallets.length === 0) {
      setWallets([newWallet]);
      return;
    }
    // If wallets is not null, append the new wallet
    setWallets([...wallets, newWallet]);
  };

  const handleRemoveWallet = (walletId: string) => {
    if (wallets.length === 0) return;
    setWallets(wallets.filter((w) => w.id !== walletId));
    const removedWallet = wallets.find((w) => w.id === walletId);
    if (removedWallet) {
      const remainingWallets = wallets.filter((w) => w.id !== walletId);
    }
  };

  return (
    <div className="flex h-screen bg-[#0f1419]">
      <Sidebar currentView={currentView} onViewChange={setCurrentView} />

      <div className="flex-1 flex flex-col">
        <TopHeader
          walletInfos={wallets}
          onAddWallet={handleAddWallet}
          onRemoveWallet={handleRemoveWallet}
        />

        <main className="flex-1 overflow-auto p-6 space-y-6">
          {currentView === "dashboard" ? (
            <>
              <PortfolioSummary
                connectedWallets={connectedWallets}
                totalStaked={totalStaked}
                activeValidators={activeValidators}
              />
              <MetricCards
                totalStaked={totalStaked}
                totalUnstaking={totalUnstaking}
                totalRewards={totalRewards}
              />
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
