"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface AddWalletDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAddWallet: (address: string, name: string) => void
}

export function AddWalletDialog({ open, onOpenChange, onAddWallet }: AddWalletDialogProps) {
  const [address, setAddress] = useState("")
  const [name, setName] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!address.trim() || !name.trim()) return

    setIsLoading(true)

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000))

    onAddWallet(address.trim(), name.trim())
    setAddress("")
    setName("")
    setIsLoading(false)
    onOpenChange(false)
  }

  const isValidSolanaAddress = (addr: string) => {
    return addr.length >= 32 && addr.length <= 44 && /^[A-Za-z0-9]+$/.test(addr)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add New Wallet</DialogTitle>
          <DialogDescription>Enter your Solana wallet address to start tracking your Pyth staking.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="wallet-name">Wallet Name</Label>
            <Input
              id="wallet-name"
              placeholder="e.g., Main Wallet"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="wallet-address">Wallet Address</Label>
            <Input
              id="wallet-address"
              placeholder="Enter Solana wallet address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="font-mono text-sm"
              required
            />
            {address && !isValidSolanaAddress(address) && (
              <p className="text-sm text-destructive">Please enter a valid Solana address</p>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!address.trim() || !name.trim() || !isValidSolanaAddress(address) || isLoading}
            >
              {isLoading ? "Adding..." : "Add Wallet"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
