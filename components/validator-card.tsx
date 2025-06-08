"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ExternalLink, TrendingUp, Percent, Coins } from "lucide-react"

interface Validator {
  id: string
  name: string
  commission: string
  apy: string
  stakedAmount: number
  status: string
}

interface ValidatorCardProps {
  validator: Validator
  showWalletSpecific?: boolean
}

export function ValidatorCard({ validator, showWalletSpecific = false }: ValidatorCardProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-500/10 text-green-500 border-green-500/20"
      case "inactive":
        return "bg-red-500/10 text-red-500 border-red-500/20"
      default:
        return "bg-gray-500/10 text-gray-500 border-gray-500/20"
    }
  }

  return (
    <Card className="transition-all duration-200 hover:shadow-lg hover:scale-[1.02]">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg">{validator.name}</CardTitle>
            <Badge className={getStatusColor(validator.status)} variant="outline">
              {validator.status}
            </Badge>
          </div>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
            <ExternalLink className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <Percent className="h-3 w-3" />
              Commission
            </div>
            <div className="font-semibold">{validator.commission}</div>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <TrendingUp className="h-3 w-3" />
              APY
            </div>
            <div className="font-semibold text-green-500">{validator.apy}</div>
          </div>
        </div>

        <div className="space-y-1">
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <Coins className="h-3 w-3" />
            {showWalletSpecific ? "Your Stake" : "Total Staked"}
          </div>
          <div className="font-semibold text-lg">{validator.stakedAmount.toLocaleString()} PYTH</div>
        </div>

        {showWalletSpecific && (
          <div className="flex gap-2 pt-2">
            <Button size="sm" variant="outline" className="flex-1">
              Stake More
            </Button>
            <Button size="sm" variant="outline" className="flex-1">
              Unstake
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
