"use client"

import { useState } from "react"
import { Sidebar } from "@/components/sidebar"
import { TopHeader } from "@/components/top-header"
import { PortfolioSummary } from "@/components/portfolio-summary"
import { MetricCards } from "@/components/metric-cards"
import { WalletSection } from "@/components/wallet-section"

// Mock data
const mockWallets = [
  {
    id: "1",
    address: "8xhM...j9dk",
    name: "Main Wallet",
    totalStaked: 2540,
    stakingApy: 12.8,
    rewardsEarned: 157.34,
    validators: 2,
  },
  {
    id: "2",
    address: "3ahN...k2dF",
    name: "Secondary Wallet",
    totalStaked: 970,
    stakingApy: 14.1,
    rewardsEarned: 82.45,
    validators: 2,
  },
]

const mockValidators = [
  {
    id: "1",
    name: "Validator Alpha",
    status: "active",
    yourStake: 1500,
    commission: "5%",
    apy: "12.5%",
  },
  {
    id: "2",
    name: "Validator Beta",
    status: "active",
    yourStake: 1040,
    commission: "7%",
    apy: "14.2%",
  },
]

export default function Dashboard() {
  const [currentView, setCurrentView] = useState<"dashboard" | "wallets">("dashboard")
  const [selectedWallet, setSelectedWallet] = useState("Main Wallet")
  const [wallets, setWallets] = useState(mockWallets)

  const totalStaked = wallets.reduce((sum, wallet) => sum + wallet.totalStaked, 0)
  const totalUnstaking = 120
  const totalRewards = wallets.reduce((sum, wallet) => sum + wallet.rewardsEarned, 0)
  const connectedWallets = wallets.length
  const activeValidators = 4

  const handleAddWallet = (address: string, name: string) => {
    const newWallet = {
      id: Date.now().toString(),
      address: address.slice(0, 4) + "..." + address.slice(-4),
      name,
      totalStaked: 0,
      stakingApy: 0,
      rewardsEarned: 0,
      validators: 0,
    }
    setWallets([...wallets, newWallet])
  }

  const handleRemoveWallet = (walletId: string) => {
    setWallets(wallets.filter((w) => w.id !== walletId))
    const removedWallet = wallets.find((w) => w.id === walletId)
    if (removedWallet && selectedWallet === removedWallet.name) {
      const remainingWallets = wallets.filter((w) => w.id !== walletId)
      if (remainingWallets.length > 0) {
        setSelectedWallet(remainingWallets[0].name)
      }
    }
  }

  return (
    <div className="flex h-screen bg-[#0f1419]">
      <Sidebar currentView={currentView} onViewChange={setCurrentView} />

      <div className="flex-1 flex flex-col">
        <TopHeader
          selectedWallet={selectedWallet}
          onWalletChange={setSelectedWallet}
          wallets={wallets}
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
              <MetricCards totalStaked={totalStaked} totalUnstaking={totalUnstaking} totalRewards={totalRewards} />
            </>
          ) : (
            <div className="space-y-6">
              {wallets.map((wallet) => (
                <WalletSection key={wallet.id} wallet={wallet} validators={mockValidators} />
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
