"use client";

import type React from "react";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader, Plus, Trash2, X } from "lucide-react";
import { PythStakingInfo } from "@/types/pythTypes";
import { useWalletInfosStore } from "@/store/store";
import { getOISStakingInfo } from "@/action/pythActions";
import { StakingHelpPopup } from "@/components/staking-help-popup";
import toast from "react-hot-toast";

interface WalletDropdownProps {
  isOpen: boolean;
  onClose: () => void;
}

export function WalletDropdown({ isOpen, onClose }: WalletDropdownProps) {
  const { wallets, addWallet, removeWallet } = useWalletInfosStore();
  const [showAddForm, setShowAddForm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Handle click outside to close dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        onClose();
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

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
      toast.error("This wallet address is already added.", {
        duration: 4000,
        style: {
          background: "#7f1d1d",
          color: "#f1f5f9",
          border: "1px solid #991b1b",
        },
      });
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

      // Success toast
      toast.success(`Wallet "${name}" added successfully!`, {
        duration: 4000,
        style: {
          background: "#065f46",
          color: "#f1f5f9",
          border: "1px solid #047857",
        },
      });
    } catch (error) {
      console.error("Error fetching Pyth staking info:", error);

      // Error toast with different styling
      toast.error(
        "Failed to add wallet. Please check the addresses and try again.",
        {
          duration: 5000,
          style: {
            background: "#7f1d1d",
            color: "#f1f5f9",
            border: "1px solid #991b1b",
          },
        }
      );
    } finally {
      setIsLoading(false);
      setShowAddForm(false);
    }
  }

  return (
    <>
      {/* Dropdown */}
      <Card
        ref={dropdownRef}
        className="absolute top-full right-2 sm:right-0 mt-2 w-80 sm:w-96 bg-[#2a2f3e] border-gray-700 z-50 max-h-[calc(100vh-6rem)] sm:max-h-[calc(100vh-8rem)] overflow-y-auto"
      >
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-white text-base sm:text-lg">
            Manage wallets
          </CardTitle>
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
          <div className="space-y-2">
            {wallets.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="w-12 h-12 bg-gray-700 rounded-full flex items-center justify-center mb-3">
                  <Plus className="w-6 h-6 text-gray-400" />
                </div>
                <p className="text-gray-400 text-sm">No wallets connected</p>
                <p className="text-gray-500 text-xs mt-1">
                  Add your first wallet below
                </p>
              </div>
            ) : (
              wallets.map((wallet) => (
                <div
                  key={wallet.id}
                  className="p-3 rounded-lg border transition-all duration-300 bg-[#1a1f2e] border-gray-700 hover:border-purple-400 hover:shadow-lg hover:shadow-purple-500/30 group"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className="w-6 h-6 sm:w-8 sm:h-8 bg-blue-500/20 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:bg-blue-500/30 transition-colors">
                        {/* Wallet Icon */}
                      </div>
                      <div className="flex flex-col gap-1 sm:gap-2 min-w-0 flex-1">
                        <p className="text-white font-medium text-sm sm:text-base group-hover:text-purple-100 transition-colors">
                          {wallet.name}
                        </p>
                        <p className="text-gray-400 text-xs sm:text-sm font-mono break-all group-hover:text-gray-300 transition-colors">
                          Solana:{" "}
                          {wallet.address.slice(0, 5) +
                            "..." +
                            wallet.address.slice(-4)}
                        </p>
                        <p className="text-gray-400 text-xs sm:text-sm font-mono break-all group-hover:text-gray-300 transition-colors">
                          Staking:{" "}
                          {wallet.stakingAddress.slice(0, 5) +
                            "..." +
                            wallet.stakingAddress.slice(-4)}
                        </p>
                        <p className="text-gray-400 text-xs sm:text-sm group-hover:text-green-300 transition-colors">
                          Staked:{" "}
                          {wallet.stakingInfo?.totalStakedPyth.toFixed(2)} PYTH
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeWallet(wallet.id);
                          localStorage.setItem(
                            "wallets",
                            JSON.stringify(
                              wallets.filter((w) => w.id !== wallet.id)
                            )
                          );
                          toast.success(
                            `Wallet "${wallet.name}" removed successfully!`,
                            {
                              duration: 3000,
                              style: {
                                background: "#065f46",
                                color: "#f1f5f9",
                                border: "1px solid #047857",
                              },
                            }
                          );
                          onClose();
                        }}
                        className="text-red-400 hover:text-red-300 hover:bg-red-500/10 cursor-pointer p-1 group-hover:bg-red-500/20 transition-all duration-200"
                      >
                        <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Add Wallet Form */}
          {showAddForm ? (
            <form
              onSubmit={handleAddWallet}
              className="space-y-3 p-3 bg-[#1a1f2e] rounded-lg border border-gray-700 flex-shrink-0 hover:border-purple-400 hover:shadow-lg hover:shadow-purple-500/30 transition-all duration-300"
            >
              <div className="space-y-2 sm:space-y-4">
                <Label htmlFor="wallet-name" className="text-gray-300 text-sm">
                  Wallet Name
                </Label>
                <Input
                  id="wallet-name"
                  name="wallet-name"
                  type="text"
                  placeholder="e.g., Trading Wallet"
                  className="bg-[#2a2f3e] border-gray-600 text-white text-sm"
                  required
                />
              </div>
              <div className="space-y-2 sm:space-y-4">
                <Label
                  htmlFor="wallet-address"
                  className="text-gray-300 text-sm"
                >
                  Solana Wallet Address
                </Label>
                <Input
                  id="wallet-address"
                  name="wallet-address"
                  type="text"
                  placeholder="Enter Solana wallet address"
                  className="bg-[#2a2f3e] border-gray-600 text-white font-mono text-xs sm:text-sm"
                  required
                />
              </div>
              <div className="space-y-2 sm:space-y-4">
                <div className="flex items-center gap-2 mb-1 sm:mb-2">
                  <Label
                    htmlFor="staking-address"
                    className="text-gray-300 text-sm"
                  >
                    Staking Account Address
                  </Label>
                  <StakingHelpPopup />
                </div>
                <Input
                  id="staking-address"
                  name="staking-address"
                  type="text"
                  placeholder="Enter your pyth staking address"
                  className="bg-[#2a2f3e] border-gray-600 text-white font-mono text-xs sm:text-sm"
                  required
                />
              </div>
              <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
                <Button
                  type="submit"
                  size="sm"
                  className="bg-purple-600 hover:bg-purple-700 w-full sm:w-auto hover:shadow-lg hover:shadow-purple-500/30 transition-all duration-300"
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
                  className="border-gray-600 text-gray-300 w-full sm:w-auto hover:border-gray-500 hover:bg-gray-700 hover:text-white transition-all duration-300"
                  disabled={isLoading}
                >
                  Cancel
                </Button>
              </div>
            </form>
          ) : (
            <Button
              onClick={() => setShowAddForm(true)}
              className="w-full bg-purple-600 hover:bg-purple-700 gap-2 cursor-pointer hover:shadow-lg hover:shadow-purple-500/30 transition-all duration-300"
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
