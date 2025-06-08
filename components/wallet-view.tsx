"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ValidatorCard } from "@/components/validator-card"
import { Copy, ExternalLink, Trash2, Coins, TrendingUp, Clock } from "lucide-react"
import { useState } from "react"

interface Wallet {
  id: string
  address: string
  name: string
  totalStaked: number
  totalRewards: number
  unstaking: number
  validators: number
}

interface Validator {
  id: string
  name: string
  commission: string
  apy: string
  stakedAmount: number
  status: string
}

interface WalletViewProps {
  wallet: Wallet
  validators: Validator[]
  onRemoveWallet: (walletId: string) => void
}

export function WalletView({ wallet, validators, onRemoveWallet }: WalletViewProps) {
  const [showConfirmDelete, setShowConfirmDelete] = useState(false)

  const formatAddress = (address: string) => {
    return `${address.slice(0, 8)}...${address.slice(-8)}`
  }

  const copyAddress = () => {
    navigator.clipboard.writeText(wallet.address)
  }

  const handleRemove = () => {
    onRemoveWallet(wallet.id)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">{wallet.name}</h1>
          <div className="flex items-center gap-2 text-muted-foreground">
            <span className="font-mono text-sm">{formatAddress(wallet.address)}</span>
            <Button variant="ghost" size="sm" onClick={copyAddress} className="h-6 w-6 p-0">
              <Copy className="h-3 w-3" />
            </Button>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
              <ExternalLink className="h-3 w-3" />
            </Button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowConfirmDelete(true)}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Remove Wallet
          </Button>
        </div>
      </div>

      {/* Wallet Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="transition-all duration-200 hover:shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Staked Amount</CardTitle>
            <Coins className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{wallet.totalStaked.toLocaleString()} PYTH</div>
            <p className="text-xs text-muted-foreground">Across {wallet.validators} validators</p>
          </CardContent>
        </Card>

        <Card className="transition-all duration-200 hover:shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Rewards</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">{wallet.totalRewards.toLocaleString()} PYTH</div>
            <p className="text-xs text-muted-foreground">
              +{((wallet.totalRewards / wallet.totalStaked) * 100).toFixed(1)}% return
            </p>
          </CardContent>
        </Card>

        <Card className="transition-all duration-200 hover:shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Unstaking</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-500">{wallet.unstaking.toLocaleString()} PYTH</div>
            <p className="text-xs text-muted-foreground">
              {wallet.unstaking > 0 ? "14 days remaining" : "No pending unstakes"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Validators for this wallet */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold tracking-tight">Staked Validators</h2>
          <Badge variant="secondary">{validators.length} Active</Badge>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {validators.map((validator) => (
            <ValidatorCard key={validator.id} validator={validator} showWalletSpecific />
          ))}
        </div>
      </div>

      {/* Confirm Delete Dialog */}
      {showConfirmDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md mx-4">
            <CardHeader>
              <CardTitle>Remove Wallet</CardTitle>
              <CardDescription>
                Are you sure you want to remove "{wallet.name}"? This action cannot be undone.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowConfirmDelete(false)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleRemove}>
                Remove
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
