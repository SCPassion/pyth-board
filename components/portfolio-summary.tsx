"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Wallet, TrendingUp, Users } from "lucide-react"

interface PortfolioSummaryProps {
  connectedWallets: number
  totalStaked: number
  activeValidators: number
}

export function PortfolioSummary({ connectedWallets, totalStaked, activeValidators }: PortfolioSummaryProps) {
  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-white">Portfolio Summary</h2>

      <div className="grid grid-cols-3 gap-6">
        <Card className="bg-[#2a2f3e] border-gray-700">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-purple-500/20 rounded-lg flex items-center justify-center">
                <Wallet className="h-6 w-6 text-purple-400" />
              </div>
              <div>
                <p className="text-gray-400 text-sm">Connected Wallets</p>
                <p className="text-3xl font-bold text-white">{connectedWallets}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#2a2f3e] border-gray-700">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-blue-400" />
              </div>
              <div>
                <p className="text-gray-400 text-sm">Total Staked</p>
                <p className="text-3xl font-bold text-white">{totalStaked.toLocaleString()} PYTH</p>
                <p className="text-green-400 text-sm">+13.2% APY</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#2a2f3e] border-gray-700">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-green-500/20 rounded-lg flex items-center justify-center">
                <Users className="h-6 w-6 text-green-400" />
              </div>
              <div>
                <p className="text-gray-400 text-sm">Active Validators</p>
                <p className="text-3xl font-bold text-white">{activeValidators}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
