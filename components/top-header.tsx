"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { ChevronDown } from "lucide-react"
import { WalletDropdown } from "@/components/wallet-dropdown"

interface Wallet {
  id: string
  address: string
  name: string
  totalStaked: number
  stakingApy: number
  rewardsEarned: number
  validators: number
}

interface TopHeaderProps {
  selectedWallet: string
  onWalletChange: (wallet: string) => void
  wallets: Wallet[]
  onAddWallet: (address: string, name: string) => void
  onRemoveWallet: (walletId: string) => void
}

export function TopHeader({ selectedWallet, onWalletChange, wallets, onAddWallet, onRemoveWallet }: TopHeaderProps) {
  const [showWalletDropdown, setShowWalletDropdown] = useState(false)

  return (
    <header className="h-16 border-b border-gray-800 bg-[#1a1f2e] flex items-center justify-between px-6 relative">
      <div className="flex items-center gap-6">
        <h1 className="text-white text-xl font-medium">Dashboard</h1>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative">
          <Button
            variant="ghost"
            className="text-white gap-2 bg-green-500/10 hover:bg-green-500/20"
            onClick={() => setShowWalletDropdown(!showWalletDropdown)}
          >
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            {selectedWallet}
            <ChevronDown className="h-4 w-4" />
          </Button>

          <WalletDropdown
            isOpen={showWalletDropdown}
            onClose={() => setShowWalletDropdown(false)}
            wallets={wallets}
            selectedWallet={selectedWallet}
            onSelectWallet={onWalletChange}
            onAddWallet={onAddWallet}
            onRemoveWallet={onRemoveWallet}
          />
        </div>
      </div>
    </header>
  )
}
