"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Plus, Trash2, X } from "lucide-react"

interface WalletDropdownProps {
  isOpen: boolean
  onClose: () => void
  wallets: any[]
  selectedWallet: string
  onSelectWallet: (wallet: string) => void
  onAddWallet: (address: string, name: string) => void
  onRemoveWallet: (walletId: string) => void
}

export function WalletDropdown({
  isOpen,
  onClose,
  wallets,
  selectedWallet,
  onSelectWallet,
  onAddWallet,
  onRemoveWallet,
}: WalletDropdownProps) {
  const [showAddForm, setShowAddForm] = useState(false)
  const [newWalletName, setNewWalletName] = useState("")
  const [newWalletAddress, setNewWalletAddress] = useState("")

  if (!isOpen) return null

  const handleAddWallet = (e: React.FormEvent) => {
    e.preventDefault()
    if (newWalletName.trim() && newWalletAddress.trim()) {
      onAddWallet(newWalletAddress.trim(), newWalletName.trim())
      setNewWalletName("")
      setNewWalletAddress("")
      setShowAddForm(false)
    }
  }

  const handleRemoveWallet = (walletId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    onRemoveWallet(walletId)
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40" onClick={onClose} />

      {/* Dropdown */}
      <Card className="absolute top-full right-0 mt-2 w-96 bg-[#2a2f3e] border-gray-700 z-50">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-white text-lg">Manage Wallets</CardTitle>
          <Button variant="ghost" size="sm" onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Wallet List */}
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {wallets.map((wallet) => (
              <div
                key={wallet.id}
                className={`p-3 rounded-lg border cursor-pointer transition-all ${
                  selectedWallet === wallet.name
                    ? "bg-purple-500/20 border-purple-500/50"
                    : "bg-[#1a1f2e] border-gray-700 hover:border-gray-600"
                }`}
                onClick={() => {
                  onSelectWallet(wallet.name)
                  onClose()
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center">
                      {/* Wallet Icon */}
                    </div>
                    <div>
                      <p className="text-white font-medium">{wallet.name}</p>
                      <p className="text-gray-400 text-sm font-mono">{wallet.address}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {selectedWallet === wallet.name && (
                      <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Active</Badge>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => handleRemoveWallet(wallet.id, e)}
                      className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="mt-2 text-sm text-gray-400">{wallet.totalStaked.toLocaleString()} PYTH staked</div>
              </div>
            ))}
          </div>

          {/* Add Wallet Form */}
          {showAddForm ? (
            <form onSubmit={handleAddWallet} className="space-y-3 p-3 bg-[#1a1f2e] rounded-lg border border-gray-700">
              <div>
                <Label htmlFor="wallet-name" className="text-gray-300">
                  Wallet Name
                </Label>
                <Input
                  id="wallet-name"
                  value={newWalletName}
                  onChange={(e) => setNewWalletName(e.target.value)}
                  placeholder="e.g., Trading Wallet"
                  className="bg-[#2a2f3e] border-gray-600 text-white"
                  required
                />
              </div>
              <div>
                <Label htmlFor="wallet-address" className="text-gray-300">
                  Wallet Address
                </Label>
                <Input
                  id="wallet-address"
                  value={newWalletAddress}
                  onChange={(e) => setNewWalletAddress(e.target.value)}
                  placeholder="Enter Solana wallet address"
                  className="bg-[#2a2f3e] border-gray-600 text-white font-mono text-sm"
                  required
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit" size="sm" className="bg-purple-600 hover:bg-purple-700">
                  Add Wallet
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAddForm(false)}
                  className="border-gray-600 text-gray-300"
                >
                  Cancel
                </Button>
              </div>
            </form>
          ) : (
            <Button onClick={() => setShowAddForm(true)} className="w-full bg-purple-600 hover:bg-purple-700 gap-2">
              <Plus className="h-4 w-4" />
              Add New Wallet
            </Button>
          )}
        </CardContent>
      </Card>
    </>
  )
}
