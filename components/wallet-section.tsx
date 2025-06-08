"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Search } from "lucide-react"

interface Wallet {
  id: string
  address: string
  name: string
  totalStaked: number
  stakingApy: number
  rewardsEarned: number
  validators: number
}

interface Validator {
  id: string
  name: string
  status: string
  yourStake: number
  commission: string
  apy: string
}

interface WalletSectionProps {
  wallet: Wallet
  validators: Validator[]
}

export function WalletSection({ wallet, validators }: WalletSectionProps) {
  return (
    <div className="space-y-6">
      <Card className="bg-[#2a2f3e] border-gray-700">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-2xl font-bold text-white">{wallet.name}</h3>
              <p className="text-gray-400 font-mono text-sm">{wallet.address}</p>
            </div>
            <div className="text-right">
              <Button variant="outline" size="sm" className="border-red-500 text-red-400 hover:bg-red-500/10 mb-2">
                Remove Wallet
              </Button>
              <p className="text-2xl font-bold text-white">{wallet.totalStaked.toLocaleString()} PYTH</p>
              <p className="text-gray-400 text-sm">Total Staked</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-6 mb-6">
            <div>
              <p className="text-gray-400 text-sm">Staking APY</p>
              <p className="text-2xl font-bold text-green-400">{wallet.stakingApy}%</p>
            </div>
            <div>
              <p className="text-gray-400 text-sm">Rewards Earned</p>
              <p className="text-2xl font-bold text-white">{wallet.rewardsEarned} PYTH</p>
            </div>
            <div>
              <p className="text-gray-400 text-sm">Validators</p>
              <p className="text-2xl font-bold text-white">{wallet.validators}</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-xl font-bold text-white">Staked Validators</h4>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search validators..."
                  className="pl-10 bg-[#1a1f2e] border-gray-600 text-white w-64"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="grid grid-cols-6 gap-4 text-gray-400 text-sm font-medium pb-2 border-b border-gray-700">
                <div>Name</div>
                <div>Status</div>
                <div>Your Stake</div>
                <div>Commission</div>
                <div>APY</div>
                <div></div>
              </div>

              {validators.map((validator) => (
                <div
                  key={validator.id}
                  className="grid grid-cols-6 gap-4 items-center py-3 hover:bg-gray-800/50 rounded-lg px-2"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-blue-500/20 rounded-full flex items-center justify-center">
                      <span className="text-blue-400 text-sm font-bold">V</span>
                    </div>
                    <span className="text-white">{validator.name}</span>
                  </div>
                  <div>
                    <Badge className="bg-green-500/20 text-green-400 border-green-500/30">{validator.status}</Badge>
                  </div>
                  <div className="text-white font-medium">{validator.yourStake.toLocaleString()} PYTH</div>
                  <div className="text-white">{validator.commission}</div>
                  <div className="text-green-400 font-medium">{validator.apy}</div>
                  <div>
                    <Button size="sm" className="bg-purple-600 hover:bg-purple-700">
                      Manage
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
