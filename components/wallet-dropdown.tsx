"use client";

import type React from "react";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Trash2, X } from "lucide-react";
import { WalletInfo } from "@/types/pythTypes";

interface WalletDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  walletInfos: WalletInfo[];
  onAddWallet: (address: string, name: string) => void;
  onRemoveWallet: (walletId: string) => void;
}

export function WalletDropdown({
  isOpen,
  onClose,
  walletInfos,
  onAddWallet,
  onRemoveWallet,
}: WalletDropdownProps) {
  const [showAddForm, setShowAddForm] = useState(false);

  if (!isOpen) return null;

  function handleAddWallet(formData: FormData) {
    const name = formData.get("wallet-name") as string;
    const address = formData.get("wallet-address") as string;
    const stakingAddress = formData.get("staking-address") as string;

    console.log({ name, address, stakingAddress });
    setShowAddForm(false);
  }

  const handleRemoveWallet = (walletId: string, e: React.MouseEvent) => {};

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40" onClick={onClose} />

      {/* Dropdown */}
      <Card className="absolute top-full right-0 mt-2 w-96 bg-[#2a2f3e] border-gray-700 z-50">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-white text-lg">
            Manage walletInfos
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="text-gray-400 hover:text-white"
          >
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Wallet List */}
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {walletInfos.map((wallet) => (
              <div
                key={wallet.id}
                className={`p-3 rounded-lg border cursor-pointer transition-all ${"bg-[#1a1f2e] border-gray-700 hover:border-gray-600"}`}
                onClick={() => {
                  onClose();
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center">
                      {/* Wallet Icon */}
                    </div>
                    <div>
                      <p className="text-white font-medium">{wallet.name}</p>
                      <p className="text-gray-400 text-sm font-mono">
                        {wallet.address}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
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
                <div className="mt-2 text-sm text-gray-400">
                  {wallet.stakingInfo?.totalStakedPyth} PYTH staked
                </div>
              </div>
            ))}
          </div>

          {/* Add Wallet Form */}
          {showAddForm ? (
            <form
              action={handleAddWallet}
              className="space-y-3 p-3 bg-[#1a1f2e] rounded-lg border border-gray-700"
            >
              <div>
                <Label htmlFor="wallet-name" className="text-gray-300">
                  Wallet Name
                </Label>
                <Input
                  id="wallet-name"
                  name="wallet-name"
                  type="text"
                  placeholder="e.g., Trading Wallet"
                  className="bg-[#2a2f3e] border-gray-600 text-white"
                  required
                />
              </div>
              <div>
                <Label htmlFor="wallet-address" className="text-gray-300">
                  Solana Wallet Address
                </Label>
                <Input
                  id="wallet-address"
                  name="wallet-address"
                  type="text"
                  placeholder="Enter Solana wallet address"
                  className="bg-[#2a2f3e] border-gray-600 text-white font-mono text-sm"
                  required
                />
              </div>
              <div>
                <Label htmlFor="wallet-address" className="text-gray-300">
                  Staking Account Address
                </Label>
                <Input
                  id="staking-address"
                  name="staking-address"
                  type="text"
                  placeholder="Enter your pyth staking address"
                  className="bg-[#2a2f3e] border-gray-600 text-white font-mono text-sm"
                  required
                />
              </div>
              <div className="flex gap-2">
                <Button
                  type="submit"
                  size="sm"
                  className="bg-purple-600 hover:bg-purple-700"
                >
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
            <Button
              onClick={() => setShowAddForm(true)}
              className="w-full bg-purple-600 hover:bg-purple-700 gap-2"
            >
              <Plus className="h-4 w-4" />
              Add New Wallet
            </Button>
          )}
        </CardContent>
      </Card>
    </>
  );
}
