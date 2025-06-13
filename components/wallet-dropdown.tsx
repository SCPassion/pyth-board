"use client";

import type React from "react";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader, Plus, Trash2, X } from "lucide-react";
import { PythStakingInfo } from "@/types/pythTypes";
import { useWalletInfosStore } from "@/store/store";
import { getOISStakingInfo } from "@/action/pythActions";

interface WalletDropdownProps {
  isOpen: boolean;
  onClose: () => void;
}

export function WalletDropdown({ isOpen, onClose }: WalletDropdownProps) {
  const { wallets, addWallet, removeWallet } = useWalletInfosStore();
  const [showAddForm, setShowAddForm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  console.log(wallets, "wallets from store");

  console.log(showAddForm, "showAddForm state");
  // Change handleAddWallet to a client-side handler
  function handleAddWallet(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const name = formData.get("wallet-name") as string;
    const address = formData.get("wallet-address") as string;
    const stakingAddress = formData.get("staking-address") as string;

    if (
      wallets.some((wallet) => wallet.address === address) ||
      wallets.some((wallet) => wallet.stakingAddress === stakingAddress)
    ) {
      onClose();
      alert("This wallet address is already added.");
      return;
    }
    fetchPythStakingInfo(address, stakingAddress, name);
  }

  async function fetchPythStakingInfo(
    walletAddress: string,
    stakingAddress: string,
    name: string
  ) {
    setIsLoading(true);
    try {
      const pythStakingInfo: PythStakingInfo = await getOISStakingInfo(
        walletAddress,
        stakingAddress
      );

      if (!pythStakingInfo) {
        throw new Error("Failed to fetch Pyth staking info");
      }

      // add wallets
      addWallet({
        id: walletAddress,
        name: name,
        address: walletAddress,
        stakingAddress: stakingAddress,
        stakingInfo: pythStakingInfo,
      });

      localStorage.setItem(
        "wallets",
        JSON.stringify([
          ...wallets,
          {
            id: walletAddress,
            name: name,
            address: walletAddress,
            stakingAddress: stakingAddress,
            stakingInfo: pythStakingInfo,
          },
        ])
      );
    } catch (error) {
      console.error("Error fetching Pyth staking info:", error);
      alert(
        "Failed to fetch staking info. Please check the wallet address and try again."
      );
    } finally {
      setIsLoading(false);
      setShowAddForm(false);
    }
  }

  return (
    <>
      {/* Dropdown */}
      <Card className="absolute top-full right-0 mt-2 w-96 bg-[#2a2f3e] border-gray-700 z-50">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-white text-lg">Manage wallets</CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="text-gray-400 hover:text-white cursor-pointer"
          >
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {wallets.map((wallet) => (
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
                    <div className="flex flex-col gap-2">
                      <p className="text-white font-medium">
                        Name: {wallet.name}
                      </p>
                      <p className="text-gray-400 text-sm font-mono">
                        Solana address:{" "}
                        {wallet.address.slice(0, 5) +
                          "..." +
                          wallet.address.slice(-4)}
                      </p>
                      <p className="text-gray-400 text-sm font-mono">
                        Staking account:{" "}
                        {wallet.stakingAddress.slice(0, 5) +
                          "..." +
                          wallet.stakingAddress.slice(-4)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        removeWallet(wallet.id);
                        localStorage.setItem(
                          "wallets",
                          JSON.stringify(
                            wallets.filter((w) => w.id !== wallet.id)
                          )
                        );
                        onClose();
                      }}
                      className="text-red-400 hover:text-red-300 hover:bg-red-500/10 cursor-pointer"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="mt-2 text-sm text-gray-400">
                  Staked $PYTH: {wallet.stakingInfo?.totalStakedPyth.toFixed(2)}
                </div>
              </div>
            ))}
          </div>

          {/* Add Wallet Form */}
          {showAddForm ? (
            <form
              onSubmit={handleAddWallet}
              className="space-y-3 p-3 bg-[#1a1f2e] rounded-lg border border-gray-700"
            >
              <div className="space-y-4">
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
              <div className="space-y-4">
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
              <div className="space-y-4">
                <Label htmlFor="staking-address" className="text-gray-300">
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
              <div className="flex gap-2 items-center">
                <Button
                  type="submit"
                  size="sm"
                  className="bg-purple-600 hover:bg-purple-700"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <Loader className="animate-spin h-4 w-4 mr-2" />
                  ) : null}
                  Add Wallet
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAddForm(false)}
                  className="border-gray-600 text-gray-300"
                  disabled={isLoading}
                >
                  Cancel
                </Button>
              </div>
            </form>
          ) : (
            <Button
              onClick={() => setShowAddForm(true)}
              className="w-full bg-purple-600 hover:bg-purple-700 gap-2 cursor-pointer"
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
